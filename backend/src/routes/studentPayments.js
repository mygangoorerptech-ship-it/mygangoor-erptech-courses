// backend/src/routes/studentPayments.js
import { Router } from "express";
import mongoose from "mongoose";              // ⬅️ add
import { requireAuth } from "../middleware/authz.js";
import Payment from "../models/Payment.js";

const r = Router();
r.use(requireAuth);

const { ObjectId } = mongoose.Types;
const isOid = (v) => mongoose.isValidObjectId(v);
const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// unchanged extractDob(...)
function extractDob(notes) {
  if (!notes) return null;
  let obj = notes;
  if (typeof notes === "string") {
    try { obj = JSON.parse(notes); } catch { return null; }
  }
  if (Array.isArray(obj)) {
    const kv = obj.find(
      (x) =>
        (x && typeof x === "object") &&
        ["birth","dob","dateOfBirth"].includes(String(x.key || x.name || "").toLowerCase())
    );
    return kv?.value || kv?.val || null;
  }
  if (obj && typeof obj === "object") {
    return obj.birth || obj.dob || obj.dateOfBirth || null;
  }
  return null;
}

// GET /api/student/payments/latest  ← used by StudentDashboard.tsx
r.get("/latest", async (req, res) => {
  const actor = req.user;
  if (!actor) return res.status(401).json({ ok: false });

  // Accept any of the common id shapes the auth layer might place on req.user
  const idCandidates = [actor._id, actor.id, actor.sub].filter(Boolean).map(String);

  // Build a robust OR query:
  //  - match studentId ObjectId (preferred)
  //  - ALSO fall back to a regex search inside notes (Razorpay order notes often carry studentId)
  const or = [];
  for (const id of idCandidates) {
    if (isOid(id)) or.push({ studentId: new ObjectId(id) });
    or.push({ notes: { $regex: new RegExp(escapeRx(id), "i") } });
  }

  // If we somehow have no candidates, force a miss quickly
  const where = or.length ? { $or: or } : { _id: null };

  const doc = await Payment.findOne(where).sort({ updatedAt: -1, createdAt: -1 }).lean();

  // 👇 IMPORTANT: return 200 with `payment: null` instead of 404 to avoid noisy console errors
  if (!doc) {
    return res.json({ ok: true, payment: null });
  }

  const dob = extractDob(doc.notes);
  return res.json({
    ok: true,
    payment: {
      id: String(doc._id),
      status: doc.status,
      amount: doc.amount,
      currency: doc.currency,
      dob,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  });
});

// POST /api/student/payments/claim  (unchanged)
r.post("/claim", async (req, res) => {
  const actor = req.user;
  const { orgId, courseId, amount, receiptNo, referenceId, notes } = req.body || {};
  if (!orgId || !courseId || !amount) {
    return res.status(400).json({ ok: false, message: "orgId, courseId, amount are required" });
  }
  const doc = await Payment.create({
    type: "offline",
    method: "upi",
    status: "submitted",
    amount: Math.floor(Number(amount)), // paise
    currency: "INR",
    orgId,
    courseId,
    studentId: actor._id || actor.id || actor.sub,     // ⬅️ be flexible on write too
    receiptNo: receiptNo || undefined,
    referenceId: referenceId || undefined,
    notes: typeof notes === "string" ? notes : JSON.stringify(notes || {}),
  });
  return res.status(201).json({ ok: true, payment: { id: String(doc._id) } });
});

export default r;
