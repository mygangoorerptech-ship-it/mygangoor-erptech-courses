// backend/src/controllers/paymentsController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { safeRegex } from "../utils/safeRegex.js";

// ---- monitoring alert (non-blocking, non-throwing) ----
function sendAlert(label, data) {
  console.error(label, data);
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${label}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` }),
  }).catch(() => {});
}

// ------------------------ helpers ------------------------
const isOid = (v) => mongoose.isValidObjectId(v);
const toId = (v) => (v && typeof v === "object" && v._id ? v._id : v);
const pickActorId = (u) => {
  if (!u) return null;
  const cand = u._id || u.id || u.sub;
  return isOid(cand) ? cand : null;
};
const pickManagerId = (u) => {
  // teachers may carry managerId (their supervising admin); guard carefully
  if (!u || String(u.role).toLowerCase() !== "teacher") return null;
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

// GET /payments  (admin/teacher, scoped to their org)
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
      // H-4 fix: escape metacharacters to prevent ReDoS
      const rx = { $regex: safeRegex(q), $options: "i" };
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

// POST /payments/offline  (admin/teacher creates an offline record)
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

    // Ensure student belongs to admin's org
    const student = await User.findOne({ _id: studentId, orgId: toId(actor.orgId) }).select("_id email");
    if (!student) return res.status(404).json({ ok: false, message: "student not found in org" });

    // Fetch course — marketplace model: admin may create payments for any published course.
    // Payment.orgId is always derived from course.orgId, never from actor.orgId.
    const course = await Course.findOne({
      _id: courseId,
      status: { $ne: "draft" },
    }).select("_id orgId");
    if (!course) return res.status(404).json({ ok: false, message: "course not found" });

    const courseOrgId = course.orgId ? toId(course.orgId) : null;
    if (!isOid(courseOrgId)) {
      return res.status(400).json({ ok: false, message: "course has no owning org; contact superadmin" });
    }

    const submittedBy = pickActorId(actor);
    const managerId = pickManagerId(actor);

    const doc = await Payment.create({
      type: "offline",
      method: "upi",
      status: "submitted",
      amount: Math.floor(Number(amount)),
      currency: "INR",
      orgId: courseOrgId,          // FIXED: course.orgId, not actor.orgId
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

  // All three IDs required. orgId must be course.orgId (non-null).
  if (!isOid(sid) || !isOid(cid) || !isOid(oid)) {
    console.warn("[ensureEnrollment] skipped: invalid ids", {
      studentId: !!sid, courseId: !!cid, orgId: !!oid,
    });
    return false;
  }

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
    const result = await Enrollment.updateOne(filter, update, { upsert: true, setDefaultsOnInsert: true });
    if (process.env.NODE_ENV === "development") {
      console.log("[ENROLLMENT RESULT]", { student: String(sid), course: String(cid), org: String(oid), upserted: result.upsertedCount });
    }

    // Backfill managerId if missing
    if (managerId) {
      await Enrollment.updateOne(
        { ...filter, $or: [{ managerId: null }, { managerId: { $exists: false } }] },
        { $set: { managerId: toId(managerId) } }
      );
    }
    return true;
  } catch (e) {
    if (e?.code === 11000) {
      if (process.env.NODE_ENV === "development") {
        console.log("[ENROLLMENT RESULT]", { student: String(sid), course: String(cid), duplicate: true });
      }
      return true; // idempotent in race
    }
    console.error("[ensureEnrollment] upsert failed:", e?.message, { studentId: sid, courseId: cid, orgId: oid });
    return false;
  }
}

// POST /payments/:id/verify  (admin/teacher verifies an offline payment; auto-enroll)
export async function verify(req, res) {
  try {
    const actor = req.user;
    const orgId = actor?.orgId && toId(actor.orgId);
    if (!orgId || !isOid(orgId)) return res.status(403).json({ ok: false });

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const verifiedBy = pickActorId(actor) || null;

    // Step 1: Load candidate by _id only — no orgId filter yet (cross-org support)
    const candidate = await Payment.findOne({ _id: id, type: "offline" }).lean();
    if (!candidate) return res.status(404).json({ ok: false, message: "payment not found" });

    // Step 2: Authorization — admin may verify if they own the course's org OR the student's org.
    // This supports the cross-org case: student from Org A buys course from Org B;
    // both Org A admin (manages the student) and Org B admin (owns the course) can verify.
    const payOrgMatch = String(toId(candidate.orgId)) === String(orgId);
    let authorized = payOrgMatch;
    if (!authorized && candidate.studentId) {
      const studentInOrg = await User.findOne({ _id: candidate.studentId, orgId }).select("_id").lean();
      authorized = !!studentInOrg;
    }
    if (!authorized) {
      return res.status(403).json({ ok: false, message: "not authorized to verify this payment" });
    }

    // Idempotent: already captured
    if (candidate.status === "captured") {
      return res.json(sanitize(candidate));
    }

    // Status guard
    if (!["submitted", "pending", "claimed"].includes(candidate.status)) {
      return res.status(400).json({ ok: false, message: "payment not verifiable in current status" });
    }

    // Step 3: Atomic status update (no orgId in filter — authorization already passed above)
    const doc = await Payment.findOneAndUpdate(
      { _id: id, status: { $in: ["submitted", "pending", "claimed"] } },
      { $set: { status: "captured", verifiedBy, verifiedAt: new Date() } },
      { new: true }
    )
      .populate("studentId", "email")
      .lean();

    if (!doc) {
      // Concurrent update — check idempotent state
      const already = await Payment.findOne({ _id: id }).lean();
      if (already?.status === "captured") return res.json(sanitize(already));
      return res.status(404).json({ ok: false, message: "payment not verifiable" });
    }

    // Derive managerId from actor or org lookup
    const managerId = pickManagerId(actor) || (await resolveManagerId(orgId));

    const enrollOk = await ensureEnrollment({
      studentId: doc.studentId,
      courseId: doc.courseId,
      orgId: doc.orgId,          // always course.orgId (set at payment creation)
      paymentId: doc._id,
      source: "offline",
      managerId,
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[ENROLLMENT RESULT]", { result: enrollOk, paymentId: String(doc._id) });
    }
    if (enrollOk === false) {
      // C-2 fix: mark for recovery job so enrollment is retried automatically.
      await Payment.updateOne(
        { _id: doc._id },
        { $set: { needsEnrollment: true }, $inc: { enrollmentRetryCount: 1 } }
      ).catch((e) => console.error("[payments.verify] recovery flag write failed:", e?.message));
      sendAlert("[CRITICAL] PAYMENT WITHOUT ENROLLMENT (offline verify)", {
        paymentId: String(doc._id), studentId: String(doc.studentId), courseId: String(doc.courseId), orgId: String(doc.orgId),
      });
    }

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
