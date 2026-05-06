// backend/src/routes/studentPayments.js
import { Router } from "express";
import mongoose from "mongoose";              // ⬅️ add
import { requireAuth } from "../middleware/authz.js";
import Payment from "../models/Payment.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { claimReceipt } from "../controllers/paymentsController.js";

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
        ["birth", "dob", "dateOfBirth"].includes(String(x.key || x.name || "").toLowerCase())
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

  // Collect all possible ID shapes
  const idCandidates = [actor._id, actor.id, actor.sub]
    .filter(Boolean)
    .map(String);

  const or = [];

  // Build query (ObjectId match first, then notes fallback)
  for (const id of idCandidates) {
    if (isOid(id)) {
      or.push({ studentId: new ObjectId(id) }); // ✅ primary fast match
    }

    // fallback: search inside notes (Razorpay notes)
    or.push({
      notes: { $regex: new RegExp(escapeRx(id), "i") },
    });
  }

  // Safe fallback
  const where = or.length ? { $or: or } : { _id: null };

  const doc = await Payment.findOne(where)
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  // Always return 200 (clean frontend handling)
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

// POST /api/student/payments/claim
r.post("/claim", claimReceipt);

export default r;
