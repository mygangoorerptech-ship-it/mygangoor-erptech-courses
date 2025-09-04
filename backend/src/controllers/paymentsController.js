// backend/src/controllers/paymentsController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

// Helpers
const isOid = (v) => mongoose.isValidObjectId(v);
const pickActorId = (u) => {
  if (!u) return null;
  const cand = u._id || u.id || u.sub;
  return isOid(cand) ? cand : null;
};
const pickManagerId = (u) => {
  if (!u || u.role !== "vendor") return null;
  return isOid(u.managerId) ? u.managerId : null;
};

function sanitize(p) {
  if (!p) return p;
  const o = p.toObject ? p.toObject() : p;

 // id may be a populated doc, an ObjectId, a string, or null
 const studentId =
   o?.studentId && typeof o.studentId === "object" && o.studentId?._id
     ? String(o.studentId._id)
     : (o?.studentId ? String(o.studentId) : null);

 // only read .email if studentId is a populated user object with an email field
 const studentEmail =
   (o?.studentId && typeof o.studentId === "object" && o.studentId !== null && "email" in o.studentId)
     ? (o.studentId.email || null)
     : (o?.studentEmail || null);

  return {
    id: String(o._id),
    type: o.type,
    method: o.method,
    status: o.status,
    amount: o.amount,
    currency: o.currency || "INR",
    orgId: o.orgId ? String(o.orgId) : null,
    courseId: o.courseId ? String(o.courseId) : null,
    studentId,
    studentEmail, // used by UI
    receiptNo: o.receiptNo || null,
    referenceId: o.referenceId || null,
    notes: o.notes || null,
    provider: o.provider || null,
    providerOrderId: o.providerOrderId || null,
    providerPaymentId: o.providerPaymentId || null,
    submittedBy: o.submittedBy ? String(o.submittedBy) : null,
    verifiedBy: o.verifiedBy ? String(o.verifiedBy) : null,
    verifiedAt: o.verifiedAt || null,
    managerId: o.managerId ? String(o.managerId) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /payments  (admin/vendor, scoped to their org)
export async function list(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(actor.orgId)) {
      return res.status(403).json({ ok: false, message: "No org" });
    }

    const { q, status, type } = req.query || {};
    // defensively cast orgId
    let orgId = actor.orgId;
    if (typeof orgId === 'object' && orgId._id) orgId = orgId._id;
    try { orgId = new Types.ObjectId(String(orgId)); } catch { return res.status(403).json({ ok:false, message:'No org' }); }
    const and = [{ orgId }];
    if (status && status !== "all") and.push({ status });
    if (type) and.push({ type });

    if (q) {
      const rx = { $regex: String(q), $options: "i" };
      and.push({
        $or: [
          { receiptNo: rx },
          { referenceId: rx },
          { notes: rx },
          { providerOrderId: rx },
          { providerPaymentId: rx },
        ],
      });
    }

    const docs = await Payment
      .find({ $and: and })
      .populate({ path:"studentId", select:"email name" })
      .sort({ createdAt:-1 })
      .lean();

    return res.json(docs.map(sanitize));
  } catch (e) {
    console.error("[payments.list] error", e);
    return res.status(500).json({ ok: false, message: "list payments failed" });
  }
}

// POST /payments/offline
export async function createOffline(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(actor.orgId)) {
      return res.status(403).json({ ok: false, message: "No org" });
    }

    const { studentId, courseId, amount, receiptNo, referenceId, notes } = req.body || {};
    if (!studentId || !courseId || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ ok: false, message: "studentId, courseId, amount required" });
    }
    if (!isOid(studentId) || !isOid(courseId)) {
      return res.status(400).json({ ok: false, message: "invalid studentId or courseId" });
    }

    // Ensure student belongs to org
    const student = await User.findOne({ _id: studentId, orgId: actor.orgId }).select("_id email");
    if (!student) return res.status(404).json({ ok: false, message: "student not found in org" });

    // Ensure course is org's (or global)
    const course = await Course.findOne({
      _id: courseId,
      $or: [{ orgId: actor.orgId }, { orgId: null }],
    }).select("_id");
    if (!course) return res.status(404).json({ ok: false, message: "course not found for org" });

    const submittedBy = pickActorId(actor);   // guard against "undefined"
    const managerId   = pickManagerId(actor); // guard against bad managerId

    const doc = await Payment.create({
      type: "offline",
      method: "upi",
      status: "submitted",
      amount: Math.round(Number(amount)),
      currency: "INR",
      orgId: actor.orgId,
      courseId,
      studentId,
      receiptNo: receiptNo || null,
      referenceId: referenceId || null,
      notes: notes || null,
      ...(submittedBy ? { submittedBy } : {}), // only set if valid OID
      ...(managerId ? { managerId } : {}),
    });

    const out = await Payment.findById(doc._id).populate("studentId", "email").lean();
    return res.json(sanitize(out));
  } catch (e) {
    console.error("[payments.createOffline] error", e);
    return res.status(500).json({ ok: false, message: "create offline payment failed" });
  }
}

async function ensureEnrollment({ studentId, courseId, orgId, paymentId, source }) {
  try {
    // Normalize possible populated objects to their _id values
    const sid = (studentId && typeof studentId === "object" && studentId._id) ? studentId._id : studentId;
    const cid = (courseId && typeof courseId === "object" && courseId._id) ? courseId._id : courseId;
    const oid = (orgId && typeof orgId === "object" && orgId._id) ? orgId._id : orgId;

    await Enrollment.updateOne(
      { studentId: sid, courseId: cid, orgId: oid },
      {
        $setOnInsert: {
          studentId: sid,
          courseId: cid,
          orgId: oid,
          status: "premium",
          source: source || "offline", // <- fixed quotes here
          paymentId: paymentId || null,
        },
      },
      { upsert: true }
    );
  } catch (e) {
    // optional: console.error("[ensureEnrollment] error", e);
  }
}

// POST /payments/:id/verify
export async function verify(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(actor.orgId)) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const verifiedBy = pickActorId(actor) || null;

    const doc = await Payment.findOneAndUpdate(
      { _id: id, orgId: actor.orgId, status: { $in: ["submitted", "pending"] } },
      { $set: { status: "captured", verifiedBy, verifiedAt: new Date() } },
      { new: true }
    )
      .populate("studentId", "email")
      .lean();

 if (!doc) return res.status(404).json({ ok: false });
 await ensureEnrollment({ studentId: doc.studentId, courseId: doc.courseId, orgId: doc.orgId, paymentId: doc._id, source: "offline" });
 return res.json(sanitize(doc));
  } catch (e) {
    console.error("[payments.verify] error", e);
    return res.status(500).json({ ok: false, message: "verify payment failed" });
  }
}

// POST /payments/:id/reject
export async function reject(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(actor.orgId)) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const doc = await Payment.findOneAndUpdate(
      { _id: id, orgId: actor.orgId },
      { $set: { status: "rejected" } },
      { new: true }
    )
      .populate("studentId", "email")
      .lean();

    if (!doc) return res.status(404).json({ ok: false });
    return res.json(sanitize(doc));
  } catch (e) {
    console.error("[payments.reject] error", e);
    return res.status(500).json({ ok: false, message: "reject payment failed" });
  }
}

// POST /payments/:id/refund
export async function refund(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(actor.orgId)) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const doc = await Payment.findOneAndUpdate(
      { _id: id, orgId: actor.orgId, status: "captured" },
      { $set: { status: "refunded" } },
      { new: true }
    )
      .populate("studentId", "email")
      .lean();

    if (!doc) return res.status(404).json({ ok: false });
    return res.json(sanitize(doc));
  } catch (e) {
    console.error("[payments.refund] error", e);
    return res.status(500).json({ ok: false, message: "refund payment failed" });
  }
}

export async function listAll(req,res){
  try{
    const { q, status, type } = req.query || {};
    const and = [];
    if (status && status !== "all") and.push({ status });
    if (type) and.push({ type });
    if (q){
      const rx = { $regex: String(q), $options:"i" };
      and.push({ $or:[
        { receiptNo: rx }, { referenceId: rx }, { notes: rx },
        { providerOrderId: rx }, { providerPaymentId: rx }
      ]});
    }
    const docs = await Payment.find(and.length?{ $and:and }:{}).populate("studentId","email name").sort({ createdAt:-1 }).lean();
    return res.json(docs.map(sanitize));
  }catch(e){
    console.error("[payments.listAll]", e);
    return res.status(500).json({ ok:false, message:"listAll payments failed" });
  }
}
