// backend/src/controllers/ordersController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Enrollment from "../models/Enrollment.js";

function canSeeAll(actor){ return actor?.role === "superadmin"; }
function scopeMatch(actor){
  if (canSeeAll(actor)) return {};
  if (actor?.role === "admin" || actor?.role === "teacher") {
    let orgId = actor.orgId;
    if (orgId && typeof orgId === "object" && orgId._id) orgId = orgId._id;
    try { orgId = new Types.ObjectId(String(orgId)); } catch { return { _id: null }; }
    return { orgId };
  }
  return { _id: null };
}

export async function list(req,res){
  try{
    const actor  = req.user;
    const q      = (req.query?.q || "").trim();
    const status = (req.query?.status || "all").toLowerCase();
    const method = (req.query?.method || "all").toLowerCase();
    const dateFrom = req.query?.dateFrom; // "YYYY-MM-DD"
    const dateTo   = req.query?.dateTo;

    const match = {
      ...scopeMatch(actor),
      providerOrderId: { $exists: true, $ne: null },     // treat anything with an order id as an Order
    };
    if (method !== "all") match.method = method;
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date(0);
      const lte = dateTo   ? new Date(`${dateTo}T23:59:59.999Z`)   : new Date();
      match.createdAt = { $gte: gte, $lte: lte };
    }

    const pipe = [
      { $match: match },
      { $group: {
          _id: "$providerOrderId",
          anyCaptured: { $max: { $cond:[ { $eq:["$status","captured"] }, 1, 0 ] } },
          anyFailed:   { $max: { $cond:[ { $eq:["$status","failed"]   }, 1, 0 ] } },
          anyRefund:   { $max: { $cond:[ { $eq:["$status","refunded"] }, 1, 0 ] } },
          total:    { $max: "$amount" },
          currency: { $max: "$currency" },
          method:   { $max: "$method" },
          orgId:    { $max: "$orgId" },
          courseId: { $max: "$courseId" },
          studentId:{ $max: "$studentId" },
          firstAt:  { $min: "$createdAt" },
          lastAt:   { $max: "$createdAt" },
          payments: { $push: {
            id: "$_id",
            amount: "$amount",
            status: "$status",
            providerPaymentId: "$providerPaymentId",
            createdAt: "$createdAt"
          }}
        }
      },
      { $sort: { "_id": -1 } }
    ];

    let rows = await Payment.aggregate(pipe);

    // Map status (+ support "partial_refund" used by UI)
    rows = rows.filter(r=>{
      const st = r.anyRefund ? (r.anyCaptured ? "partial_refund" : "refunded")
                             : r.anyCaptured ? "paid"
                             : r.anyFailed   ? "failed"
                             : "pending";
      if (status !== "all" && st !== status) return false;
      r._derivedStatus = st;
      return true;
    });

    // Hydrate course + user
    const cIds  = rows.map(r=> r.courseId).filter(Boolean);
    const sIds  = rows.map(r=> r.studentId).filter(Boolean);
    const [courses, students] = await Promise.all([
      Course.find({ _id: { $in: cIds } }).select("_id title").lean(),
      User.find({ _id: { $in: sIds } }).select("_id name email").lean(),
    ]);
    const cById = Object.fromEntries(courses.map(c=> [String(c._id), c]));
    const sById = Object.fromEntries(students.map(s=> [String(s._id), s]));

    const out = rows.map(r=>{
      const course  = cById[String(r.courseId)] || {};
      const student = sById[String(r.studentId)] || {};
      return {
        id: r._id,                                  // provider order id
        number: `ORD-${String(r._id).slice(-10)}`,
        userName:  student.name  || "-",
        userEmail: student.email || "-",
        items: [{ id: String(r.courseId), sku: String(r.courseId), name: course.title || "Course", quantity: 1, amount: r.total }],
        subtotal: r.total, tax: 0, total: r.total, currency: r.currency || "INR",
        status: r._derivedStatus,
        paymentMethod: r.method || "razorpay",
        payments: r.payments.map(p=>({ id: p.providerPaymentId || String(p.id), gateway: "razorpay", amount: p.amount, createdAt: p.createdAt, status: p.status })),
        refunds: [], // (add if you later track refund docs/amounts)
        createdAt: r.firstAt,
        updatedAt: r.lastAt,
      };
    });

    const rx = q ? new RegExp(q, "i") : null;
    res.json(rx ? out.filter(o => rx.test(o.number)||rx.test(o.userEmail)||o.items.some(i=>rx.test(i.name))) : out);
  }catch(e){
    console.error("[orders.list]", e);
    res.status(500).json({ ok:false, message:"orders list failed" });
  }
}

// GET /orders/:id
export async function getOne(req,res){
  try{
    const actor = req.user;
    const orderId = String(req.params?.id || "");
    if (!orderId) return res.status(400).json({ ok:false });

    // scope to org (unless superadmin)
    const scope = scopeMatch(actor); // {} | {orgId} | {_id:null}
    const and = [{ providerOrderId: orderId }];
    if (scope.orgId) and.push({ orgId: scope.orgId });
    if (Object.prototype.hasOwnProperty.call(scope, "_id")) and.push(scope); // {_id:null} => match none

    // gather all payments for this order
    const pays = await Payment.find({ $and: and }).sort({ createdAt: 1 }).lean();
    if (!pays.length) return res.status(404).json({ ok:false });

    const first = pays[0];
    const last  = pays[pays.length - 1];
    const anyCaptured = pays.some(p => p.status === "captured");
    const anyRefund   = pays.some(p => p.status === "refunded");
    const anyFailed   = pays.some(p => p.status === "failed");
    const derivedStatus = anyRefund ? (anyCaptured ? "partial_refund" : "refunded")
                                    : anyCaptured ? "paid"
                                    : anyFailed   ? "failed"
                                                  : "pending";

    const [course, student, org, adminUser, enr] = await Promise.all([
      first.courseId ? Course.findById(first.courseId).select("_id title").lean() : null,
      first.studentId ? User.findById(first.studentId).select("_id name email").lean() : null,
      Organization.findById(first.orgId).lean(),
      // pick any admin for this org (fallback to actor if they’re admin)
      User.findOne({ orgId: first.orgId, role: "admin" }).select("_id name email").lean(),
      Enrollment.findOne({ orgId: first.orgId, courseId: first.courseId, studentId: first.studentId }).lean(),
    ]);

    const total = Math.max(...pays.map(p => p.amount || 0)) || 0;
    const currency = first.currency || "INR";
    const method   = first.method || "razorpay";

    const out = {
      id: orderId,
      number: `ORD-${orderId.slice(-10)}`,
      status: derivedStatus,
      paymentMethod: method,
      subtotal: total, tax: 0, total, currency,
      createdAt: first.createdAt, updatedAt: last.createdAt,
      // invoice parties
      userName:  student?.name  || "-",
      userEmail: student?.email || "-",
      items: [{
        id: String(first.courseId || ""),
        sku: String(first.courseId || ""),
        name: course?.title || "Course",
        quantity: 1,
        amount: total
      }],
      payments: pays.map(p => ({
        id: p.providerPaymentId || String(p._id),
        gateway: p.provider || "razorpay",
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt
      })),
      refunds: [], // (optional enrichment later)
      // extra metadata for the professional invoice
      org: org ? {
        id: String(org._id),
        code: org.code,
        name: org.name,
        address: org.address,
        city: org.city, state: org.state, country: org.country, postal: org.postal,
        email: org.contactEmail, phone: org.phone
      } : null,
      admin: (adminUser || (actor?.role === "admin" ? actor : null)) ? {
        id: String((adminUser || actor)._id),
        name: (adminUser || actor).name || "-",
        email: (adminUser || actor).email || "-"
      } : null,
      course: course ? { id: String(course._id), title: course.title } : null,
      student: student ? { id: String(student._id), name: student.name, email: student.email } : null,
      enrollment: enr ? {
        id: String(enr._id),
        status: enr.status,       // expect "premium"
        source: enr.source,
        createdAt: enr.createdAt
      } : null
    };
    return res.json(out);
  }catch(e){
    console.error("[orders.getOne]", e);
    res.status(500).json({ ok:false });
  }
}

// internal helper used by getOne
async function listInternal(actor){
  const req = { user: actor, query: {} };
  const res = { json: (d)=>d, status: ()=>({ json:()=>{} }) };
  return await list.bind({})(req, res); // not used; present for symmetry
}

// POST /orders/:id/refund
export async function refund(req,res){
  try{
    const actor = req.user;
    const orderId = String(req.params?.id||"");
    const amount  = Math.max(0, Number(req.body?.amount||0)); // paise
    const reason  = (req.body?.reason||"").toString();

    // pick a captured payment for this order + org scoping
    const and = [{ providerOrderId: orderId, status: "captured" }];
    if (actor?.role !== "superadmin") and.push({ orgId: actor.orgId });
    const pay = await Payment.findOne({ $and: and }).lean();
    if (!pay) return res.status(404).json({ ok:false, message:"no captured payment for refund" });

    // Razorpay partial/full refund
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const rf = await fetch(`https://api.razorpay.com/v1/payments/${pay.providerPaymentId}/refund`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Basic ${auth}` },
      body: JSON.stringify({ amount: amount>0?amount:undefined, notes: reason?{ reason }:undefined })
    }).then(r=> r.json());

    if (rf?.error) {
      return res.status(400).json({ ok:false, message:"razorpay refund failed", error:rf.error });
    }

    await Payment.updateOne({ _id: pay._id }, { $set: { status:"refunded" } });
    // return fresh order view
    req.query = {};
    return await list(req,res);
  }catch(e){
    console.error("[orders.refund]", e);
    res.status(500).json({ ok:false });
  }
}
