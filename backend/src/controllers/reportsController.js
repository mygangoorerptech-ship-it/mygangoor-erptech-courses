//backend/src/controllers/reportsController.js
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

/**
 * Build a stable key for a (student, course, org) tuple
 */
function keyOf(e) {
  const sid = e.studentId?._id ? String(e.studentId._id) : String(e.studentId);
  const cid = e.courseId?._id ? String(e.courseId._id) : String(e.courseId);
  const oid =
    e.orgId === null ||
      typeof e.orgId === "undefined"
      ? "null"
      : String(e.orgId);
  return `${sid}|${cid}|${oid}`;
}

/**
 * List reports: now driven by ENROLLMENTS (status=premium),
 * then left-join any Progress rows. This guarantees you see every
 * paid enrollment even if progress hasn't been recorded yet.
 */
export async function list(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(403).json({ ok: false, message: "unauthenticated" });

    const {
      orgId,
      studentId,
      courseId,
      status,
      q: searchQuery,
    } = req.query || {};
    const pg = Math.max(1, parseInt(req.query?.page) || 1);
    const sz = Math.min(50, Math.max(1, parseInt(req.query?.limit) || 20));

    // --- Enrollment-scoped query (premium orgusers only) ---
    const enrollmentQuery = {
      status: "premium",
    };
    if (actor.role !== "superadmin") {
      enrollmentQuery.orgId = actor.orgId;
    } else if (orgId) {
      enrollmentQuery.orgId = orgId;
    }
    if (studentId) enrollmentQuery.studentId = studentId;

    if (actor.role === "teacher") {
      const actorId    = actor._id || actor.id || actor.sub;
      const actorIdStr = String(actorId);
      const orgIdStr   = String(actor.orgId);
      const teacherCourseIds = await Course.find({
        $or: [
          { teacherId: actorIdStr },
          { teacherId: new mongoose.Types.ObjectId(actorIdStr) },
          {
            centerTeacherAssignments: {
              $elemMatch: {
                $or: [
                  { centerId: orgIdStr,                                teacherId: actorIdStr },
                  { centerId: new mongoose.Types.ObjectId(orgIdStr),  teacherId: new mongoose.Types.ObjectId(actorIdStr) },
                ]
              }
            }
          }
        ]
      }).distinct("_id");

      if (courseId && !teacherCourseIds.some(id => String(id) === String(courseId))) {
        enrollmentQuery.courseId = { $in: [] };
      } else {
        enrollmentQuery.courseId = courseId ? courseId : { $in: teacherCourseIds };
      }
    } else {
      if (courseId) enrollmentQuery.courseId = courseId;
    }
    const searchText =
      typeof searchQuery === "string"
        ? searchQuery.trim().toLowerCase()
        : "";

    const total = await Enrollment.countDocuments(enrollmentQuery);

    const enrolls = await Enrollment.find(enrollmentQuery)
      .sort({ updatedAt: -1 })
      .skip((pg - 1) * sz)
      .limit(sz)
      .populate({ path: "studentId", select: "_id name email" })
      .populate({ path: "courseId", select: "_id title isBundled chapters" })
      .lean();

    // Gather keys and bulk-load matching Progress
    const keys = enrolls.map(e => ({
      studentId: e.studentId?._id,
      courseId: e.courseId?._id,
      orgId: e.orgId,
    }));

    let prog = [];

    if (keys.length > 0) {
      prog = await Progress.find({
        $or: keys.map((k) => {
          if (k.orgId) {
            return {
              studentId: k.studentId,
              courseId: k.courseId,
              orgId: k.orgId,
            };
          }

          return {
            studentId: k.studentId,
            courseId: k.courseId,
            $or: [
              { orgId: null },
              { orgId: { $exists: false } },
            ],
          };
        }),
      }).lean();
    }

    const progMap = new Map();
    for (const p of prog) {
const progressOrgKey =
  p.orgId === null ||
  typeof p.orgId === "undefined"
    ? "null"
    : String(p.orgId);

const progressKey =
  `${String(p.studentId)}|${String(p.courseId)}|${progressOrgKey}`;

console.log("[reports:list] progressKey =", progressKey);

progMap.set(progressKey, p);
    }

    // Build items
    let items = enrolls.map((e) => {
      const enrollmentKey = keyOf(e);

console.log(
  "[reports:list] enrollmentKey =",
  enrollmentKey
);

const p = progMap.get(enrollmentKey);

console.log(
  "[reports:list] matchedProgress =",
  !!p
);
      const course = e.courseId || {};
      const student = e.studentId || {};
      const chapterCount = Array.isArray(course.chapters) ? course.chapters.length : 0;

      const overallStatus = p?.overallStatus || "not-started";
      const statuses = Array.isArray(p?.statuses) ? p.statuses : [];

      return {
        id: p?._id ? String(p._id) : keyOf(e), // if no progress yet, a synthetic id is okay for row key
        student: {
          id: String(student._id || ""),
          name: student.name || "",
          email: student.email || "",
        },
        course: {
          id: String(course._id || ""),
          title: course.title || "",
          isBundled: !!course.isBundled,
          chapterCount,
        },
        orgId: String(e.orgId || ""),
        statuses,
        overallStatus,
        certificateUrl: p?.certificateUrl || null,
        createdAt: p?.createdAt ?? e.createdAt,
        updatedAt: p?.updatedAt ?? e.updatedAt,
      };
    });

    /**
 * Search filter
 */
    if (searchText) {
      items = items.filter((it) => {
        const studentName =
          String(it.student?.name || "").toLowerCase();

        const studentEmail =
          String(it.student?.email || "").toLowerCase();

        const courseTitle =
          String(it.course?.title || "").toLowerCase();

        return (
          studentName.includes(searchText) ||
          studentEmail.includes(searchText) ||
          courseTitle.includes(searchText)
        );
      });
    }

    // Normalize derived overall status for bundled courses
    items = items.map((it) => {
      if (it.course.isBundled && it.course.chapterCount > 0) {
        const done = (it.statuses || []).filter(s => (s.status || "") === "complete").length;
        if (done >= it.course.chapterCount) {
          return { ...it, overallStatus: "completed" };
        }
        if (done > 0) {
          return { ...it, overallStatus: "in-progress" };
        }
        return { ...it, overallStatus: "not-started" };
      }
      return it;
    });

    // Optional status filter (applied after join)
    if (req.query?.status) {
      const wanted = String(req.query.status);
      items = items.filter((it) => {
        if (wanted === "complete") {
          // any chapter complete OR overall completed (non-bundled)
          const hasChapterComplete = (it.statuses || []).some(s => s.status === "complete");
          return hasChapterComplete || it.overallStatus === "completed";
        }
        // support filtering exact "completed" or "not-started"
        if (wanted === "completed") return it.overallStatus === "completed";
        if (wanted === "not-started") return it.overallStatus === "not-started";
        return false;
      });
    }

    return res.json({ items, total, page: pg, pageSize: sz });
  } catch (e) {
    console.error("[reports:list]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

/**
 * Upsert remains the same (creates/updates a Progress document).
 */
export async function upsert(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(403).json({ ok: false, message: "unauthenticated" });

    const { studentId, courseId, statuses, overallStatus } = req.body || {};
    if (!studentId || !courseId) {
      return res.status(400).json({ ok: false, message: "studentId and courseId required" });
    }
    const student = await User.findById(studentId)
      .select("_id orgId")
      .lean();

    const course = await Course.findById(courseId)
      .select("_id orgId isBundled chapters")
      .lean();

    if (!student || !course) {
      return res.status(404).json({
        ok: false,
        message: "student or course not found",
      });
    }

    /**
     * IMPORTANT:
     * Enrollment is the actual source-of-truth
     * for org scope.
     */
    const enrollment = await Enrollment.findOne({
      studentId,
      courseId,
    })
      .select("_id orgId")
      .lean();

    if (!enrollment) {
      return res.status(404).json({
        ok: false,
        message: "enrollment not found",
      });
    }

    const targetOrgId = enrollment.orgId || null;
    console.log("[reports:upsert] targetOrgId =", targetOrgId);
console.log("[reports:upsert] studentId =", studentId);
console.log("[reports:upsert] courseId =", courseId);
console.log("[reports:upsert] overallStatus =", overallStatus);

    /**
     * Only superadmin can manage
     * global/non-org progress.
     */
    if (actor.role !== "superadmin") {
      if (
        !targetOrgId ||
        String(actor.orgId) !== String(targetOrgId)
      ) {
        return res.status(403).json({
          ok: false,
          message: "forbidden",
        });
      }
    }

    const update = {};
    if (Array.isArray(statuses)) {
      // normalize each chapter to "complete" or "not-started"
      const norm = statuses.map((s) => ({
        chapterIndex: Number(s.chapterIndex) || 0,
        status: String(s.status || "") === "complete" ? "complete" : "not-started",
        updatedAt: new Date(),
      }));
      update.statuses = norm;

      // if bundled, derive overall
      const chapterCount = Array.isArray(course?.chapters) ? course.chapters.length : 0;
      if (course?.isBundled && chapterCount > 0) {
        const done = norm.filter(x => x.status === "complete").length;
        update.overallStatus = done >= chapterCount ? "completed" : (done > 0 ? "in-progress" : "not-started");
      }
    }
    if (overallStatus && (!course?.isBundled || !(Array.isArray(course?.chapters) && course.chapters.length > 0))) {
      // only honor manual overallStatus for non-bundled (or courses without chapters)
      update.overallStatus = String(overallStatus);
    }
    update.updatedBy = actor._id || actor.sub;

    /**
     * IMPORTANT:
     * Global courses may contain:
     * - orgId: null
     * - missing orgId
     * - undefined orgId
     *
     * Normalize safely.
     */
    let doc;

    if (targetOrgId) {
      doc = await Progress.findOne({
        studentId,
        courseId,
        orgId: targetOrgId,
      });
    } else {
      doc = await Progress.findOne({
        studentId,
        courseId,
        $or: [
          { orgId: null },
          { orgId: { $exists: false } },
        ],
      });
    }

    if (!doc) {
      doc = new Progress({
        studentId,
        courseId,
        orgId: targetOrgId || null,
        createdBy: actor._id || actor.sub,
      });
    }
    Object.assign(doc, update);
    console.log("[reports:upsert] existingDoc =", !!doc?._id);

console.log("[reports:upsert] savingDoc =", {
  studentId: doc.studentId,
  courseId: doc.courseId,
  orgId: doc.orgId,
  overallStatus: doc.overallStatus,
});
    await doc.save();
    return res.json({ ok: true, id: String(doc._id) });
  } catch (e) {
    console.error("[reports:upsert]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

/**
 * Delete unchanged
 */
export async function remove(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(403).json({ ok: false, message: "unauthenticated" });
    const { id } = req.params;
    const doc = await Progress.findById(id);
    if (!doc) return res.status(404).json({ ok: false, message: "not found" });
    if (actor.role === "teacher") return res.status(403).json({ ok: false, message: "forbidden" });
    if (actor.role !== "superadmin" && String(actor.orgId) !== String(doc.orgId)) {
      return res.status(403).json({ ok: false, message: "forbidden" });
    }
    await Progress.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (e) {
    console.error("[reports:remove]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

/**
 * Export CSV based on enrollments, with left-joined progress.
 */
export async function exportCsv(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(403).json({ ok: false });

    const { orgId, studentId, courseId, status } = req.query || {};

    const enrollmentQuery = {
      status: "premium",
    };
    if (actor.role !== "superadmin") q.orgId = actor.orgId;
    else if (orgId) q.orgId = orgId;
    if (studentId) q.studentId = studentId;
    if (courseId) q.courseId = courseId;

    const enrolls = await Enrollment.find(q)
      .populate({ path: "studentId", select: "_id name email" })
      .populate({ path: "courseId", select: "_id title isBundled chapters" })
      .lean();

    const keys = enrolls.map(e => ({
      studentId: e.studentId?._id,
      courseId: e.courseId?._id,
      orgId: e.orgId,
    }));

    let prog = [];

    if (keys.length > 0) {
      prog = await Progress.find({
        $or: keys.map((k) => {
          if (k.orgId) {
            return {
              studentId: k.studentId,
              courseId: k.courseId,
              orgId: k.orgId,
            };
          }

          return {
            studentId: k.studentId,
            courseId: k.courseId,
            $or: [
              { orgId: null },
              { orgId: { $exists: false } },
            ],
          };
        }),
      }).lean();
    }

    const progMap = new Map();
    for (const p of prog) {
      const progressOrgKey =
  p.orgId === null ||
  typeof p.orgId === "undefined"
    ? "null"
    : String(p.orgId);

const progressKey =
  `${String(p.studentId)}|${String(p.courseId)}|${progressOrgKey}`;

console.log("[reports:list] progressKey =", progressKey);

progMap.set(progressKey, p);
    }

    let rows = enrolls.map((e) => {
      const enrollmentKey = keyOf(e);

console.log(
  "[reports:list] enrollmentKey =",
  enrollmentKey
);

const p = progMap.get(enrollmentKey);

console.log(
  "[reports:list] matchedProgress =",
  !!p
);
      const student = e.studentId || {};
      const course = e.courseId || {};
      const chapterCount = Array.isArray(course.chapters) ? course.chapters.length : 0;
      return {
        studentId: String(student._id || ""),
        studentName: student.name || "",
        studentEmail: student.email || "",
        courseId: String(course._id || ""),
        courseTitle: course.title || "",
        isBundled: !!course.isBundled,
        chapterCount,
        overallStatus: p?.overallStatus || "not-started",
        certificateUrl: p?.certificateUrl || "",
        createdAt: (p?.createdAt ?? e.createdAt) ? new Date(p?.createdAt ?? e.createdAt).toISOString() : "",
        updatedAt: (p?.updatedAt ?? e.updatedAt) ? new Date(p?.updatedAt ?? e.updatedAt).toISOString() : "",
        chapterStatuses: JSON.stringify(p?.statuses || []),
      };
    });

    if (status) {
      rows = rows.filter(r =>
        r.overallStatus === status ||
        JSON.parse(r.chapterStatuses || "[]").some(s => s.status === status)
      );
    }

    let csv = "studentId,studentName,studentEmail,courseId,courseTitle,isBundled,chapterCount,overallStatus,certificateUrl,createdAt,updatedAt,chapterStatuses\n";
    for (const r of rows) {
      csv += [
        r.studentId,
        escapeCsvField(r.studentName),
        escapeCsvField(r.studentEmail),
        r.courseId,
        escapeCsvField(r.courseTitle),
        r.isBundled ? "true" : "false",
        r.chapterCount,
        escapeCsvField(r.overallStatus),
        escapeCsvField(r.certificateUrl),
        r.createdAt,
        r.updatedAt,
        escapeCsvField(r.chapterStatuses),
      ].join(",") + "\n";
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=reports.csv");
    return res.send(csv);
  } catch (e) {
    console.error("[reports:exportCsv]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

function escapeCsvField(value) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Publish or update a certificate URL for a progress record.
export async function publishCertificate(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(403).json({ ok: false, message: "unauthenticated" });

    const { id } = req.params;
    const { url } = req.body || {};

    const doc = await Progress.findById(id);
    if (!doc) return res.status(404).json({ ok: false, message: "not found" });

    // Scope restrictions: non-SA must match org
    if (actor.role !== "superadmin" && String(actor.orgId) !== String(doc.orgId)) {
      return res.status(403).json({ ok: false, message: "forbidden" });
    }

    doc.certificateUrl = (url && String(url).trim()) || null;
    doc.updatedBy = actor._id || actor.sub;
    await doc.save();


    // Create a reminder notification for the student when a certificate is attached
    try {
      const { enqueueNotification } = await import("./notificationsController.js");
      if (doc.certificateUrl) {
        const studentId = doc.studentId?._id || doc.studentId;
        await enqueueNotification({
          userId: studentId,
          orgId: doc.orgId || null,
          type: "certificate_available",
          title: "Your certificate is ready",
          body: "Download your certificate now.",
          data: { progressId: doc._id, courseId: doc.courseId, url: doc.certificateUrl },
          dueAt: new Date(),
          recurrence: "daily",
          maxTimes: 7,
          priority: "high",
        });
      }
    } catch (notifyErr) {
      console.error("[notify] certificate_available enqueue failed", notifyErr?.message || notifyErr);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[reports:publishCertificate]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}
