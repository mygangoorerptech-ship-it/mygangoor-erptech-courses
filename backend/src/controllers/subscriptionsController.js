// backend/src/controllers/subscriptionsController.js
import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const isOid = (v)=> mongoose.isValidObjectId(v);
const canSeeAll = (a)=> a?.role === "superadmin";
const scopeMatch = (a)=> canSeeAll(a) ? {} : (a?.orgId ? { orgId:a.orgId } : { _id:null });

export async function list(req,res){
  try{
    const actor = req.user;
    const match = scopeMatch(actor);
    const status = (req.query?.status||"all").toString();
    const and = [match];
    if (status !== "all") and.push({ status });
    const docs = await Subscription.find({ $and: and }).sort({ createdAt:-1 }).lean();

    const courseIds  = docs.map(d=> d.courseId);
    const studentIds = docs.map(d=> d.studentId);
    const [courses, students] = await Promise.all([
      Course.find({ _id: { $in: courseIds }}).select("_id title").lean(),
      User.find({ _id: { $in: studentIds }}).select("_id name email").lean(),
    ]);
    const cById = Object.fromEntries(courses.map(c=> [String(c._id), c]));
    const sById = Object.fromEntries(students.map(s=> [String(s._id), s]));

    res.json(docs.map(d=>({
      id: String(d._id),
      studentEmail: (sById[String(d.studentId)]?.email)||"",
      studentName:  (sById[String(d.studentId)]?.name)||"",
      courseId:     String(d.courseId),
      courseTitle:  (cById[String(d.courseId)]?.title)||"",
      orgId:        String(d.orgId),
      method:       d.method,
      status:       d.status,
      amount:       d.amount,
      currency:     d.currency,
      renews:       d.renews,
      currentPeriodStart: d.currentPeriodStart,
      currentPeriodEnd:   d.currentPeriodEnd,
      createdAt:    d.createdAt,
      updatedAt:    d.updatedAt,
    })));
  }catch(e){
    console.error("[subscriptions.list]", e);
    res.status(500).json({ ok:false });
  }
}

// POST /subscriptions (manual or razorpay)
export async function create(req,res){
  try{
    const actor = req.user;
    const { studentId, courseId, orgId, method="manual", amount=0, currency="INR", months=1, planId, customerId } = req.body||{};
    if (!isOid(studentId)||!isOid(courseId)||!isOid(orgId)) return res.status(400).json({ ok:false });

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth()+Number(months||1));

    let providerSubscriptionId = null;

    if (method === "razorpay" && planId && customerId){
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      const payload = {
        plan_id: planId, total_count: months, customer_notify: true, customer_id: customerId,
        notes: { studentId, courseId, orgId }
      };
      const r = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Basic ${auth}` },
        body: JSON.stringify(payload)
      }).then(r=> r.json());
      if (r?.error) return res.status(400).json({ ok:false, message:"razorpay create subscription failed", error:r.error });
      providerSubscriptionId = r.id || null;
    }

    const sub = await Subscription.create({
      studentId, courseId, orgId,
      method, amount, currency,
      currentPeriodStart: now, currentPeriodEnd: end,
      status: "paid",
      providerSubscriptionId,
      createdBy: actor._id || actor.id || actor.sub || null,
    });

    res.status(201).json({
      id: String(sub._id),
      studentEmail:"", studentName:"",
      courseId:String(courseId),
      orgId:String(orgId),
      method, status: sub.status,
      amount, currency,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      createdAt: sub.createdAt, updatedAt: sub.updatedAt
    });
  }catch(e){
    console.error("[subscriptions.create]", e);
    res.status(500).json({ ok:false });
  }
}

export async function cancel(req,res){
  try{
    const actor = req.user;
    const id = String(req.params?.id||"");
    const sub = await Subscription.findOneAndUpdate(
      { _id:id, ...scopeMatch(actor) },
      { $set: { status:"canceled", renews:false, canceledBy: actor._id || null }},
      { new:true }
    ).lean();
    if (!sub) return res.status(404).json({ ok:false });
    res.json({ ...sub, id:String(sub._id) });
  }catch(e){
    console.error("[subscriptions.cancel]", e);
    res.status(500).json({ ok:false });
  }
}

export async function refund(req,res){
  try{
    const actor = req.user;
    const id = String(req.params?.id||"");
    const sub = await Subscription.findOneAndUpdate(
      { _id:id, ...scopeMatch(actor) },
      { $set: { status:"refunded", renews:false }},
      { new:true }
    ).lean();
    if (!sub) return res.status(404).json({ ok:false });
    res.json({ ...sub, id:String(sub._id) });
  }catch(e){
    console.error("[subscriptions.refund]", e);
    res.status(500).json({ ok:false });
  }
}
