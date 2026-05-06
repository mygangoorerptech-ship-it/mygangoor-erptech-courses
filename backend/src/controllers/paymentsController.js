// backend/src/controllers/paymentsController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import { safeRegex } from "../utils/safeRegex.js";
import { ensureEnrollment } from "../services/enrollmentService.js";
import { reconcileOfflinePayment } from "../services/paymentReconciliationService.js";

// ---- monitoring alert (non-blocking, non-throwing) ----
function sendAlert(label, data) {
  console.error(label, data);
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${label}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` }),
  }).catch(() => { });
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

    const and = [
      {
        $or: [
          { orgId },        // org-based payments
          { orgId: null },  // global course payments
        ],
      },
    ];
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

    // Prevent duplicate pending/captured offline payments
    const existingPayment = await Payment.findOne({
      studentId: toId(studentId),
      courseId: toId(courseId),

      status: {
        $in: ["pending_verification", "captured"],
      },

      createdSource: {
        $in: ["admin_manual", "teacher_manual"],
      },
    }).lean();

    if (existingPayment) {
      return res.status(409).json({
        ok: false,
        message:
          existingPayment.status === "captured"
            ? "Course already purchased."
            : "Payment verification already pending.",
      });
    }

    const courseOrgId = course.orgId ? toId(course.orgId) : null;

    const submittedBy = pickActorId(actor);
    const managerId = pickManagerId(actor);

    const doc = await Payment.create({
      type: "offline",
      method: "cash", // we can allow more methods in future if needed
      status: "pending_verification", // offline payments require verification
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
      createdSource:
        actor.role === "teacher"
          ? "teacher_manual"
          : "admin_manual"
    });

    await reconcileOfflinePayment(doc);

    return res.status(201).json(sanitize(doc));
  } catch (e) {
    console.error("[payments.createOffline] error", e);
    return res.status(500).json({ ok: false, message: "create offline payment failed" });
  }
}

// POST /payments/claim
// Student submits offline payment receipt/reference for verification/reconciliation
export async function claimReceipt(req, res) {
  try {

    const actor = req.user;

    const studentId = pickActorId(actor);

    if (!studentId || !isOid(studentId)) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    const {
      courseId,
      amount,
      receiptNo,
      referenceId,
      notes,
    } = req.body || {};

    if (
      !courseId ||
      !Number.isFinite(Number(amount))
    ) {
      return res.status(400).json({
        ok: false,
        message: "courseId and amount required",
      });
    }

    if (!receiptNo && !referenceId) {
      return res.status(400).json({
        ok: false,
        message:
          "receiptNo or referenceId required",
      });
    }

    if (!isOid(courseId)) {
      return res.status(400).json({
        ok: false,
        message: "invalid courseId",
      });
    }

    // Course validation
    const course = await Course.findOne({
      _id: courseId,
      status: { $ne: "draft" },
    })
      .select("_id orgId")
      .lean();

    if (!course) {
      return res.status(404).json({
        ok: false,
        message: "course not found",
      });
    }

    // Prevent duplicate active claims/purchases
    const existingPayment = await Payment.findOne({
      studentId: toId(studentId),
      courseId: toId(courseId),

      status: {
        $in: [
          "pending_verification",
          "captured",
        ],
      },

      createdSource: "student_claim",
    }).lean();

    if (existingPayment) {
      return res.status(409).json({
        ok: false,
        message:
          existingPayment.status === "captured"
            ? "Course already purchased."
            : "Payment verification already pending.",
      });
    }

    const doc = await Payment.create({
      type: "offline",

      method: "cash",

      status: "pending_verification",

      createdSource: "student_claim",

      amount: Math.floor(Number(amount)),

      currency: "INR",

      orgId: course.orgId
        ? toId(course.orgId)
        : null,

      courseId: toId(courseId),

      studentId: toId(studentId),

      receiptNo:
        receiptNo?.trim() || undefined,

      referenceId:
        referenceId?.trim() || undefined,

      notes:
        typeof notes === "string"
          ? notes
          : JSON.stringify(notes || {}),
    });

    // Attempt automatic reconciliation
    await reconcileOfflinePayment(doc);

    const latest = await Payment.findById(doc._id)
      .populate("studentId", "email name")
      .lean();

    return res.status(201).json({
      ok: true,
      payment: sanitize(latest),
    });

  } catch (e) {

    console.error(
      "[payments.claimReceipt]",
      e
    );

    return res.status(500).json({
      ok: false,
      message: "claim receipt failed",
    });
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
    const payOrgMatch =
      candidate.orgId &&
      String(toId(candidate.orgId)) === String(orgId);
    let authorized = payOrgMatch;
    if (!authorized && candidate.studentId) {
      const studentInOrg = await User.findOne({ _id: candidate.studentId, orgId }).select("_id").lean();
      authorized = !!studentInOrg;
    }
    if (!authorized) {
      return res.status(403).json({ ok: false, message: "not authorized to verify this payment" });
    }

    // Idempotent: already captured
    if (
      candidate.status === "captured" ||
      candidate.reconciliationStatus === "matched"
    ) {
      return res.json(sanitize(candidate));
    }

    // Status guard
    if (!["pending_verification"].includes(candidate.status)) {
      return res.status(400).json({ ok: false, message: "payment not verifiable in current status" });
    }

    // Step 3: Atomic status update (no orgId in filter — authorization already passed above)
    const doc = await Payment.findOneAndUpdate(
      { _id: id, status: { $in: ["pending_verification"] } },
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

    // ✅ FIX: fallback orgId for global courses
    let enrollmentOrgId = doc.orgId;

    if (!isOid(enrollmentOrgId)) {
      const course = await Course.findById(doc.courseId).select("orgId").lean();
      enrollmentOrgId = course?.orgId || null;
    }

    // allow null orgId for global courses
    const enrollOk = await ensureEnrollment({
      studentId: doc.studentId,
      courseId: doc.courseId,
      orgId: enrollmentOrgId || null,
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
        {
          $set: { needsEnrollment: true },
          $inc: { enrollmentRetryCount: 1 },
        }
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
      const rx = {
        $regex: safeRegex(q),
        $options: "i"
      };
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
