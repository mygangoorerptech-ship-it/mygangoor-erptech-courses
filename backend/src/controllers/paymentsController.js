// backend/src/controllers/paymentsController.js
import mongoose from "mongoose";
const { Types } = mongoose;
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import CourseAssignment from "../models/CourseAssignment.js";
import { safeRegex } from "../utils/safeRegex.js";
import { ensureEnrollment } from "../services/enrollmentService.js";
import { reconcileOfflinePayment } from "../services/paymentReconciliationService.js";
import { upsertFormProfileInternal } from "./studentFormProfileController.js";
import Organization from "../models/Organization.js";
import Enrollment from "../models/Enrollment.js";
import StudentFormProfile from "../models/StudentFormProfile.js";

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

const orgNameCache = new Map();

async function supportsTransactions() {

  try {

    const admin =
      mongoose.connection.db.admin();

    const result =
      await admin.command({
        hello: 1
      });

    return !!(
      result?.setName ||
      result?.isWritablePrimary
    );

  } catch {

    return false;
  }
}

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

async function sanitize(p) {
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

  const courseTeacherAssignments =
    Array.isArray(o?.courseId?.centerTeacherAssignments)
      ? o.courseId.centerTeacherAssignments
      : [];

  const centerIds = [
    ...new Set(
      courseTeacherAssignments
        .map((x) =>
          x?.centerId
            ? String(toId(x.centerId))
            : null
        )
        .filter(Boolean)
    ),
  ];

  if (centerIds.length > 0) {
    const missingCenterIds =
      centerIds.filter(
        (id) => !orgNameCache.has(id)
      );

    if (missingCenterIds.length > 0) {
      const centers = await Organization.find({
        _id: { $in: missingCenterIds },
      })
        .select("_id name")
        .lean();

      for (const c of centers) {
        orgNameCache.set(
          String(c._id),
          c.name
        );
      }
    }
  }

  return {
    id: String(o._id),
    type: o.type,
    method: o.method,
    status: o.status,
    amount: o.amount,
    currency: o.currency,
    orgId: o.orgId ? String(toId(o.orgId)) : null,
    courseId: o.courseId ? String(toId(o.courseId)) : null,

    courseTitle:
      o?.courseId &&
        typeof o.courseId === "object" &&
        "title" in o.courseId
        ? o.courseId.title || null
        : null,

    courseTeacherAssignments:
      o?.courseId &&
        typeof o.courseId === "object" &&
        Array.isArray(o.courseId.centerTeacherAssignments)
        ? o.courseId.centerTeacherAssignments.map((x) => {
          const centerId =
            x?.centerId
              ? String(toId(x.centerId))
              : null;

          return {
            centerId,

            centerName:
              centerId
                ? orgNameCache.get(centerId) || null
                : null,

            teacherId:
              x?.teacherId
                ? String(toId(x.teacherId))
                : null,

            teacherIds: Array.isArray(x?.teacherIds)
              ? x.teacherIds.map((id) => String(id)).filter(Boolean)
              : (x?.teacherId ? [String(toId(x.teacherId))] : []),

            teacherName:
              x?.teacherName || null,

            teacherEmail:
              x?.teacherEmail || null,
          };
        })
        : [],

    orgName:
      o?.orgId &&
        typeof o.orgId === "object" &&
        "name" in o.orgId
        ? o.orgId.name || null
        : (
          o?.courseId &&
          typeof o.courseId === "object" &&
          o.courseId?.orgId &&
          typeof o.courseId.orgId === "object" &&
          "name" in o.courseId.orgId
        )
          ? o.courseId.orgId.name || null
          : null,
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
    // SP-7: enrollment recovery visibility for admin dashboard
    needsEnrollment: o.needsEnrollment || false,
    enrollmentRetryCount: o.enrollmentRetryCount || 0,
    lastEnrollmentError: o.lastEnrollmentError || null,
    lastEnrollmentRetryAt: o.lastEnrollmentRetryAt || null,
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

    const { q, status, type, broken } = req.query || {};
    let orgId = toId(actor.orgId);

    let mainFilter;
    if (actor.role === "teacher") {
      const actorId    = actor._id || actor.id || actor.sub;
      const actorIdStr = String(actorId);
      const orgIdStr   = String(actor.orgId);
      const teacherCourseIds = await Course.find({
        $or: [
          { teacherId: actorIdStr },
          { teacherId: new Types.ObjectId(actorIdStr) },
          {
            centerTeacherAssignments: {
              $elemMatch: {
                $or: [
                  { centerId: orgIdStr,                              teacherId: actorIdStr },
                  { centerId: new Types.ObjectId(orgIdStr),         teacherId: new Types.ObjectId(actorIdStr) },
                ]
              }
            }
          }
        ]
      }).distinct("_id");
      mainFilter = { courseId: { $in: teacherCourseIds } };
    } else {
      const studentIds = await User.find({ orgId }).distinct("_id");
      const courseIds  = await Course.find({ orgId }).distinct("_id");
      mainFilter = {
        $or: [
          // payments belonging to org
          { orgId },
          // student of org purchased elsewhere
          { studentId: { $in: studentIds } },
          // course owned by org
          { courseId:  { $in: courseIds  } },
        ],
      };
    }

    const and = [mainFilter];
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
    // SP-7: ?broken=true filters to payments where enrollment recovery is needed
    if (broken === "true") {
      and.push({ needsEnrollment: true });
    }

    const docs = await Payment.find({
      ...(and.length ? { $and: and } : {}),
      reconciliationStatus: {
        $ne: "matched",
      },
    })
      .populate("studentId", "email name")

      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })

      .populate("orgId", "name")

      .sort({ createdAt: -1 })
      .lean();

    const sanitized = await Promise.all((docs || []).map(sanitize));

    // Bulk-attach student form profiles so the UI can show join form
    // details even for offline payments where notes has no joinForm.
    const studentIds = [...new Set(sanitized.map(p => p.studentId).filter(Boolean))];
    const profileMap = {};
    if (studentIds.length > 0) {
      const profiles = await StudentFormProfile.find({
        studentId: { $in: studentIds },
      }).lean();
      for (const pf of profiles) {
        profileMap[String(pf.studentId)] = pf;
      }
    }

    return res.json(
      sanitized.map(p => ({
        ...p,
        formProfile: p.studentId ? (profileMap[p.studentId] || null) : null,
      }))
    );
  } catch (e) {
    console.error("[payments.list]", e);
    return res.status(500).json({ ok: false, message: "list payments failed" });
  }
}

// POST /payments/offline  (admin/teacher creates an offline record)
export async function createOffline(req, res) {
  try {
    const actor = req.user;
    const isSuperadmin =
      String(actor?.role).toLowerCase() === "superadmin";

    if (
      !isSuperadmin &&
      (!actor?.orgId || !isOid(toId(actor.orgId)))
    ) {
      return res.status(403).json({
        ok: false,
        message: "No org",
      });
    }

    const { studentId, courseId, amount, receiptNo, referenceId, notes } = req.body || {};
    if (!studentId || !courseId || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ ok: false, message: "studentId, courseId, amount required" });
    }
    if (!isOid(studentId) || !isOid(courseId)) {
      return res.status(400).json({ ok: false, message: "invalid studentId or courseId" });
    }

    // Ensure student belongs to admin's org
    const studentQuery = {
      _id: studentId,
    };

    if (
      String(actor?.role).toLowerCase() !== "superadmin"
    ) {
      studentQuery.orgId = toId(actor.orgId);
    }

    const student = await User.findOne(studentQuery)
      .select("_id email");
    if (!student) return res.status(404).json({ ok: false, message: "student not found in org" });

    // Fetch course — marketplace model: admin may create payments for any published course.
    // Payment.orgId is always derived from course.orgId, never from actor.orgId.
    const course = await Course.findOne({
      _id: courseId,
      status: { $ne: "draft" },
    }).select("_id orgId");
    if (!course) return res.status(404).json({ ok: false, message: "course not found" });

    // Resolve enrollment center/org.
    //
    // IMPORTANT:
    // Payment.orgId represents the actual enrollment center,
    // NOT the course owner org.
    let resolvedOrgId = null;

    try {
      const parsedNotes =
        typeof notes === "string"
          ? JSON.parse(notes)
          : notes || {};

      if (
        parsedNotes?.orgId &&
        isOid(parsedNotes.orgId)
      ) {
        resolvedOrgId = toId(parsedNotes.orgId);

        // Courses with assignments are center-restricted.
        // Courses without assignments are global.
        const assignmentCount =
          await CourseAssignment.countDocuments({
            courseId: toId(courseId),
            isActive: true,
          });

        if (assignmentCount > 0) {
          const validAssignment =
            await CourseAssignment.exists({
              courseId: toId(courseId),
              centerId: resolvedOrgId,
              isActive: true,
            });

          if (!validAssignment) {
            return res.status(400).json({
              ok: false,
              message:
                "Selected center is not assigned to this course.",
            });
          }
        }
      }
    } catch {
      // ignore malformed notes payload
    }

    // Prevent duplicate pending/captured offline payments
    const existingPayment = await Payment.findOne({
      studentId: toId(studentId),

      courseId: toId(courseId),

      status: {
        $in: ["pending_verification", "captured"],
      },

      reconciliationStatus: {
        $ne: "matched",
      },

      createdSource: {
        $in: [
          "admin_manual",
          "teacher_manual",
          "superadmin_manual",
        ],
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

    const submittedBy = pickActorId(actor);
    const managerId = pickManagerId(actor);

    const doc = await Payment.create({
      type: "offline",
      method: "cash", // we can allow more methods in future if needed
      status: "pending_verification", // offline payments require verification
      amount: Math.floor(Number(amount)),
      currency: "INR",
      orgId: resolvedOrgId || null,          // FIXED: course.orgId, not actor.orgId
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
          : actor.role === "superadmin"
            ? "superadmin_manual"
            : "admin_manual"
    });

    await reconcileOfflinePayment(doc);

    const latest = await Payment.findById(doc._id)

      .populate("studentId", "email name")

      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })

      .populate("orgId", "name")

      .lean();

    return res.status(201).json(await sanitize(latest));
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

    if (!isOid(courseId)) {
      return res.status(400).json({
        ok: false,
        message: "invalid courseId",
      });
    }

    // Course validation
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

    // Resolve selected enrollment center/org.
    //
    // IMPORTANT:
    // Course.orgId is the owner/publisher org.
    // Actual enrollment center comes from the student's selected orgId
    // stored inside notes payload.
    let resolvedOrgId = null;

    try {
      const parsedNotes =
        typeof notes === "string"
          ? JSON.parse(notes)
          : notes || {};

      if (
        parsedNotes?.orgId &&
        isOid(parsedNotes.orgId)
      ) {
        resolvedOrgId = toId(parsedNotes.orgId);

        // SECURITY:
        //
        // Courses with CourseAssignment entries are center-restricted.
        // Courses with NO assignments are treated as global courses.
        //
        // Only enforce center validation when assignment-based delivery exists.
        const assignmentCount =
          await CourseAssignment.countDocuments({
            courseId: toId(courseId),
            isActive: true,
          });

        if (assignmentCount > 0) {
          const validAssignment =
            await CourseAssignment.exists({
              courseId: toId(courseId),
              centerId: resolvedOrgId,
              isActive: true,
            });

          if (!validAssignment) {
            return res.status(400).json({
              ok: false,
              message:
                "Selected center is not assigned to this course.",
            });
          }
        }
      }
    } catch {
      // ignore malformed notes payload
    }

    // Fallback:
    // use course owner org only if no explicit center selected.
    if (!resolvedOrgId && course?.orgId) {
      resolvedOrgId = toId(course.orgId);
    }

    // Prevent duplicate active student claims
    const existingPayment = await Payment.findOne({
      studentId: toId(studentId),

      courseId: toId(courseId),

      status: {
        $in: [
          "pending_verification",
          "captured",
        ],
      },

      reconciliationStatus: {
        $ne: "matched",
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

    // SP-3: cross-source check — block offline claim if an active online payment exists.
    // Soft-block: online "pending" orders expire in ~30-45 min via the expiry job.
    // Hard-block: online "captured" means already purchased.
    const existingOnline = await Payment.findOne({
      studentId: toId(studentId),
      courseId: toId(courseId),
      status: { $in: ["pending", "captured"] },
      type: "online",
    }).lean();

    if (existingOnline) {
      return res.status(409).json({
        ok: false,
        message:
          existingOnline.status === "captured"
            ? "Course already purchased online."
            : "An online payment for this course is in progress. It will expire in ~30 minutes, after which you can submit a cash receipt.",
      });
    }

    const doc = await Payment.create({
      type: "offline",

      method: "cash",

      status: "pending_verification",

      createdSource: "student_claim",

      amount: Math.floor(Number(amount)),

      currency: "INR",

      orgId: resolvedOrgId || null,

      courseId: toId(courseId),

      studentId: toId(studentId),

      receiptNo:
        typeof receiptNo === "string" &&
          receiptNo.trim()
          ? receiptNo.trim()
          : undefined,

      referenceId:
        typeof referenceId === "string" &&
          referenceId.trim()
          ? referenceId.trim()
          : undefined,

      notes:
        typeof notes === "string"
          ? notes
          : JSON.stringify(notes || {}),
    });

    // Persist student form data for future enrollment reuse (fire-and-forget)
    try {
      const parsed = JSON.parse(typeof notes === "string" ? notes : JSON.stringify(notes || "{}"));
      if (parsed.joinForm && studentId) {
        upsertFormProfileInternal(toId(studentId), parsed.joinForm);
      }
    } catch (_) { }

    // Attempt automatic reconciliation
    await reconcileOfflinePayment(doc);

    const latest = await Payment.findById(doc._id)

      .populate("studentId", "email name")

      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })

      .populate("orgId", "name")

      .lean();

    return res.status(201).json({
      ok: true,
      payment: await sanitize(latest),
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
    const isSuperadmin =
      String(actor?.role).toLowerCase() === "superadmin";

    const orgId =
      actor?.orgId && toId(actor.orgId);

    if (
      !isSuperadmin &&
      (!orgId || !isOid(orgId))
    ) {
      return res.status(403).json({
        ok: false,
      });
    }

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const verifiedBy = pickActorId(actor) || null;

    // Step 1: Load candidate by _id only — no orgId filter yet (cross-org support)
    const candidate = await Payment.findOne({ _id: id, type: "offline" }).lean();
    if (!candidate) return res.status(404).json({ ok: false, message: "payment not found" });

    const existingCaptured = await Payment.findOne({
      _id: { $ne: id },
      studentId: candidate.studentId,
      courseId: candidate.courseId,
      status: "captured",
      reconciliationStatus: {
        $ne: "matched",
      },
    }).lean();

    if (existingCaptured) {
      return res.status(409).json({
        ok: false,
        message: "Student already enrolled for this course.",
      });
    }

    // Step 2: Authorization — admin may verify if they own the course's org OR the student's org.
    // This supports the cross-org case: student from Org A buys course from Org B;
    // both Org A admin (manages the student) and Org B admin (owns the course) can verify.
    // ---------------------------------------------------
    // AUTHORIZATION
    // ---------------------------------------------------

    // superadmin bypasses org restrictions
    if (!isSuperadmin) {

      let authorized = false;

      // payment belongs to same org
      if (
        candidate.orgId &&
        String(toId(candidate.orgId)) === String(orgId)
      ) {
        authorized = true;
      }

      // OR student belongs to same org
      if (!authorized && candidate.studentId) {

        const studentInOrg =
          await User.findOne({
            _id: candidate.studentId,
            orgId,
          })
            .select("_id")
            .lean();

        authorized = !!studentInOrg;
      }

      if (!authorized) {
        return res.status(403).json({
          ok: false,
          message:
            "not authorized to verify this payment",
        });
      }
    }

    // Idempotent: already captured
    if (candidate.status === "captured") {
      return res.json(await sanitize(candidate));
    }

    if (candidate.reconciliationStatus === "matched") {
      return res.status(409).json({
        ok: false,
        message:
          "Payment already reconciled with another payment.",
      });
    }

    if (
      ["rejected", "refunded", "reconciled"]
        .includes(candidate.status)
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Payment cannot be verified.",
      });
    }

    // Status guard
    if (!["pending_verification"].includes(candidate.status)) {
      return res.status(400).json({ ok: false, message: "payment not verifiable in current status" });
    }

    const session = await mongoose.startSession();

    const canUseTransactions = await supportsTransactions();

    let finalDoc = null;

    try {

      if (canUseTransactions) {

        await session.withTransaction(async () => {

          const doc = await Payment.findOneAndUpdate(
            {
              _id: id,
              status: "pending_verification",
            },
            {
              $set: {
                status: "captured",
                verifiedBy,
                verifiedAt: new Date(),
                verificationMode: "direct_admin_verify",
                reconciliationStatus: "none",
              },
            },
            {
              new: true,
              session,
            }
          );

          if (!doc) {

            const existing =
              await Payment.findById(id)
                .session(session);

            if (existing?.status === "captured") {
              finalDoc = existing;
              return;
            }

            throw new Error(
              "PAYMENT_ALREADY_VERIFIED"
            );
          }

          const managerId =
            pickManagerId(actor) ||
            await resolveManagerId(orgId);

          const enrollmentOrgId =
            isOid(doc.orgId)
              ? toId(doc.orgId)
              : null;

          const enrollOk =
            await ensureEnrollment({
              studentId: doc.studentId,
              courseId: doc.courseId,
              orgId: enrollmentOrgId || null,
              paymentId: doc._id,
              source: "offline",
              managerId,
              session,
            });

          if (enrollOk === false) {

            await Payment.updateOne(
              { _id: doc._id },
              {
                $set: {
                  needsEnrollment: true,
                },
                $inc: {
                  enrollmentRetryCount: 1,
                },
              },
              { session }
            );

            throw new Error(
              "ENROLLMENT_FAILED"
            );
          }

          finalDoc = doc;
        });

      } else {

        // fallback for standalone MongoDB
        // same logic without transaction

        const doc = await Payment.findOneAndUpdate(
          {
            _id: id,
            status: "pending_verification",
          },
          {
            $set: {
              status: "captured",
              verifiedBy,
              verifiedAt: new Date(),
              verificationMode: "direct_admin_verify",
              reconciliationStatus: "none",
            },
          },
          {
            new: true,
          }
        );

        if (!doc) {

          const existing =
            await Payment.findById(id);

          if (existing?.status === "captured") {
            finalDoc = existing;
          } else {
            throw new Error(
              "PAYMENT_ALREADY_VERIFIED"
            );
          }

        } else {

          const managerId =
            pickManagerId(actor) ||
            await resolveManagerId(orgId);

          const enrollmentOrgId =
            isOid(doc.orgId)
              ? toId(doc.orgId)
              : null;

          const enrollOk =
            await ensureEnrollment({
              studentId: doc.studentId,
              courseId: doc.courseId,
              orgId: enrollmentOrgId || null,
              paymentId: doc._id,
              source: "offline",
              managerId,
            });

          if (enrollOk === false) {

            await Payment.updateOne(
              { _id: doc._id },
              {
                $set: {
                  needsEnrollment: true,
                },
                $inc: {
                  enrollmentRetryCount: 1,
                },
              }
            );

            throw new Error(
              "ENROLLMENT_FAILED"
            );
          }

          finalDoc = doc;
        }
      }

    } finally {

      await session.endSession();
    }

    if (!finalDoc) {

      return res.status(409).json({
        ok: false,
        message: "payment already verified",
      });
    }

    const populated =
      await Payment.findById(finalDoc._id)

        .populate("studentId", "email")

        .populate({
          path: "courseId",
          select: "title orgId centerTeacherAssignments",
          populate: {
            path: "orgId",
            select: "name"
          }
        })

        .populate("orgId", "name")
        .lean();

    return res.json(
      await sanitize(populated)
    );
  } catch (e) {
    console.error("[payments.verify] error", e);
    return res.status(500).json({ ok: false, message: "verify payment failed" });
  }
}

// POST /payments/:id/reject
export async function reject(req, res) {
  try {
    const actor = req.user;

    const isSuperadmin =
      String(actor?.role).toLowerCase() === "superadmin";

    const orgId =
      actor?.orgId && toId(actor.orgId);

    if (
      !isSuperadmin &&
      (!orgId || !isOid(orgId))
    ) {
      return res.status(403).json({
        ok: false,
      });
    }

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const filter = {
      _id: id,
      status: "pending_verification",
    };

    if (!isSuperadmin) {
      filter.orgId = orgId;
    }

    const doc = await Payment.findOneAndUpdate(
      filter,
      { $set: { status: "rejected" } },
      { new: true }
    )
      .populate("studentId", "email")

      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })

      .populate("orgId", "name")
      .lean();

    if (!doc) return res.status(404).json({ ok: false });
    return res.json(await sanitize(doc));
  } catch (e) {
    console.error("[payments.reject] error", e);
    return res.status(500).json({ ok: false, message: "reject payment failed" });
  }
}

// POST /payments/:id/refund  (captured → refunded)
export async function refund(req, res) {
  try {
    const actor = req.user;

    const isSuperadmin =
      String(actor?.role).toLowerCase() === "superadmin";

    const orgId =
      actor?.orgId && toId(actor.orgId);

    if (
      !isSuperadmin &&
      (!orgId || !isOid(orgId))
    ) {
      return res.status(403).json({
        ok: false,
      });
    }

    const { id } = req.params;
    if (!isOid(id)) return res.status(400).json({ ok: false, message: "invalid id" });

    const filter = {
      _id: id,
      status: "captured",
      reconciliationStatus: "none",
    };

    if (!isSuperadmin) {
      filter.orgId = orgId;
    }

    const doc = await Payment.findOneAndUpdate(
      filter,
      { $set: { status: "refunded" } },
      { new: true }
    )
      .populate("studentId", "email")

      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })

      .populate("orgId", "name")
      .lean();

    await Enrollment.updateOne(
      {
        paymentId: doc._id,
      },
      {
        $set: {
          status: "revoked",
        },
      }
    );

    if (!doc) return res.status(404).json({ ok: false });
    return res.json(await sanitize(doc));
  } catch (e) {
    console.error("[payments.refund] error", e);
    return res.status(500).json({ ok: false, message: "refund payment failed" });
  }
}

// GET /sa/payments  (superadmin — cross-org listing)
export async function listAll(req, res) {
  try {
    const { q, status, type, broken } = req.query || {};
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
    // SP-7: ?broken=true filters to payments where enrollment recovery is needed
    if (broken === "true") {
      and.push({ needsEnrollment: true });
    }
    const docs = await Payment.find({
      ...(and.length ? { $and: and } : {}),
      reconciliationStatus: {
        $ne: "matched",
      },
    })
      .populate("studentId", "email name")
      .populate({
        path: "courseId",
        select: "title orgId centerTeacherAssignments",
        populate: {
          path: "orgId",
          select: "name"
        }
      })
      .populate("orgId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json(
      await Promise.all(
        (docs || []).map(sanitize)
      )
    );
  } catch (e) {
    console.error("[payments.listAll]", e);
    return res.status(500).json({ ok: false, message: "listAll payments failed" });
  }
}
