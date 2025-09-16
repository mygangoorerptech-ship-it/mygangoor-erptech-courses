// backend/src/controllers/paymentsController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

// ------------------------ helpers ------------------------
const isOid = (v) => mongoose.isValidObjectId(v);
const toId = (v) => (v && typeof v === "object" && v._id ? v._id : v);
const pickActorId = (u) => {
  if (!u) return null;
  const cand = u._id || u.id || u.sub;
  return isOid(cand) ? cand : null;
};
const pickManagerId = (u) => {
  // some vendors may carry managerId (their supervising admin); guard carefully
  if (!u || String(u.role).toLowerCase() !== "vendor") return null;
  return isOid(u.managerId) ? u.managerId : null;
};

async function resolveManagerId(orgId) {
  try {
    const u = await User.findOne({
      orgId: toId(orgId),
      role: { $in: ["orgadmin", "admin"] },
      status: "active",
    })
      .select("_id")
      .lean();
    return u?._id || null;
  } catch {
    return null;
  }
}

function sanitize(p) {
  if (!p) return p;
  const o = p.toObject ? p.toObject() : p;

  const studentId =
    o?.studentId && typeof o.studentId === "object" && o.studentId?._id
      ? String(o.studentId._id)
      : o?.studentId
      ? String(o.studentId)
      : null;

  const studentEmail =
    o?.studentId && typeof o.studentId === "object" && o.studentId !== null && "email" in o.studentId
      ? o.studentId.email || null
      : o?.studentEmail || null;

  return {
    id: String(o._id),
    type: o.type,
    method: o.method,
    status: o.status,
    amount: o.amount,
    currency: o.currency,
    orgId: o.orgId ? String(toId(o.orgId)) : null,
    courseId: o.courseId ? String(toId(o.courseId)) : null,
    studentId,
    studentEmail,
    receiptNo: o.receiptNo || null,
    referenceId: o.referenceId || null,
    notes: o.notes || null,
    provider: o.provider || null,
    providerOrderId: o.providerOrderId || null,
    providerPaymentId: o.providerPaymentId || null,
    submittedBy: o.submittedBy ? String(toId(o.submittedBy)) : null,
    verifiedBy: o.verifiedBy ? String(toId(o.verifiedBy)) : null,
    verifiedAt: o.verifiedAt || null,
    managerId: o.managerId ? String(toId(o.managerId)) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// ------------------------ queries ------------------------

// GET /payments  (admin/vendor, scoped to their org)
export async function list(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(toId(actor.orgId))) {
      return res.status(403).json({ ok: false, message: "No org" });
    }

    const { q, status, type } = req.query || {};
    let orgId = toId(actor.orgId);

    const and = [{ orgId }];
    if (status && String(status).toLowerCase() !== "all") {
      and.push({ status: String(status).toLowerCase() });
    }
    if (type && String(type).toLowerCase() !== "all") {
      and.push({ type: String(type).toLowerCase() });
    }
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

    const docs = await Payment.find(and.length ? { $and: and } : {})
      .populate("studentId", "email name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json((docs || []).map(sanitize));
  } catch (e) {
    console.error("[payments.list]", e);
    return res.status(500).json({ ok: false, message: "list payments failed" });
  }
}

// POST /payments/offline  (admin/vendor creates an offline record)
export async function createOffline(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(toId(actor.orgId))) {
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
    const student = await User.findOne({ _id: studentId, orgId: toId(actor.orgId) }).select("_id email");
    if (!student) return res.status(404).json({ ok: false, message: "student not found in org" });

    // Ensure course is org's (or global)
    const course = await Course.findOne({
      _id: courseId,
      $or: [{ orgId: toId(actor.orgId) }, { orgId: null }],
    }).select("_id");
    if (!course) return res.status(404).json({ ok: false, message: "course not found for org" });

    const submittedBy = pickActorId(actor);
    const managerId = pickManagerId(actor);

    const doc = await Payment.create({
      type: "offline",
      method: "upi",
      status: "submitted",
      amount: Math.floor(Number(amount)),
      currency: "INR",
      orgId: toId(actor.orgId),
      courseId: toId(courseId),
      studentId: toId(studentId),
      receiptNo: receiptNo || undefined,
      referenceId: referenceId || undefined,
      notes: typeof notes === "string" ? notes : JSON.stringify(notes || {}),
      submittedBy: submittedBy || null,
      ...(managerId ? { managerId } : {}),
    });

    return res.status(201).json(sanitize(doc));
  } catch (e) {
    console.error("[payments.createOffline] error", e);
    return res.status(500).json({ ok: false, message: "create offline payment failed" });
  }
}

// Upsert premium enrollment for student & course
async function ensureEnrollment({ studentId, courseId, orgId, paymentId, source, managerId }) {
  const sid = toId(studentId);
  const cid = toId(courseId);
  const oid = toId(orgId);
  const pid = paymentId ? toId(paymentId) : null;

  if (!isOid(sid) || !isOid(cid) || !isOid(oid)) return;

  // Compose filter without paymentId to avoid write conflicts on upsert
  const filter = { studentId: sid, courseId: cid, orgId: oid };

  const update = {
    $setOnInsert: {
      studentId: sid,
      courseId: cid,
      orgId: oid,
      status: "premium",
      source: source || "offline",
      ...(managerId ? { managerId: toId(managerId) } : {}),
    },
  };

  if (pid) {
    update.$set = { paymentId: pid };
  }

  try {
    await Enrollment.updateOne(filter, update, { upsert: true, setDefaultsOnInsert: true });

    // Backfill managerId if missing
    if (managerId) {
      await Enrollment.updateOne(
        { ...filter, $or: [{ managerId: null }, { managerId: { $exists: false } }] },
        { $set: { managerId: toId(managerId) } }
      );
    }
  } catch (e) {
    if (e?.code === 11000) return; // idempotent in race
    // eslint-disable-next-line no-console
    console.warn("[ensureEnrollment] non-fatal", e?.message || e);
  }
}

// POST /payments/:id/verify  (admin/vendor verifies an offline payment; auto-enroll)
export async function verify(req, res) {
  try {
    const actor = req.user;
    const orgId = actor?.orgId && toId(actor.orgId);
    if (!orgId || !isOid(orgId)) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const verifiedBy = pickActorId(actor) || null;

    // Only allow verifying org-scoped offline payments in submitted/pending/claimed states
    const doc = await Payment.findOneAndUpdate(
      {
        _id: id,
        orgId,
        type: "offline",
        status: { $in: ["submitted", "pending", "claimed"] },
      },
      { $set: { status: "captured", verifiedBy, verifiedAt: new Date() } },
      { new: true }
    )
      .populate("studentId", "email")
      .lean();

    if (!doc) {
      // If already captured, return as-is (idempotent UX)
      const already = await Payment.findOne({ _id: id, orgId }).lean();
      if (already && already.status === "captured") {
        return res.json(sanitize(already));
      }
      return res.status(404).json({ ok: false, message: "payment not verifiable" });
    }

    // Derive managerId similarly to online flow
    const managerId = pickManagerId(actor) || (await resolveManagerId(orgId));

    await ensureEnrollment({
      studentId: doc.studentId,
      courseId: doc.courseId,
      orgId: doc.orgId,
      paymentId: doc._id,
      source: "offline",
      managerId,
    });

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
    if (!actor?.orgId || !isOid(toId(actor.orgId))) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const doc = await Payment.findOneAndUpdate(
      { _id: id, orgId: toId(actor.orgId), status: { $ne: "captured" } },
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

// POST /payments/:id/refund  (captured → refunded)
export async function refund(req, res) {
  try {
    const actor = req.user;
    if (!actor?.orgId || !isOid(toId(actor.orgId))) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const doc = await Payment.findOneAndUpdate(
      { _id: id, orgId: toId(actor.orgId), status: "captured" },
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

// GET /sa/payments  (superadmin — cross-org listing)
export async function listAll(req, res) {
  try {
    const { q, status, type } = req.query || {};
    const and = [];
    if (status && String(status).toLowerCase() !== "all") and.push({ status: String(status).toLowerCase() });
    if (type && String(type).toLowerCase() !== "all") and.push({ type: String(type).toLowerCase() });
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
    const docs = await Payment.find(and.length ? { $and: and } : {})
      .populate("studentId", "email name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json((docs || []).map(sanitize));
  } catch (e) {
    console.error("[payments.listAll]", e);
    return res.status(500).json({ ok: false, message: "listAll payments failed" });
  }
}
