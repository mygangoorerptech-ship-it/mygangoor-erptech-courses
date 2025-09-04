// backend/src/controllers/studentProgressController.js
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

export async function get(req, res) {
  try {
    const actor = req.user;
    if (!actor) {
      return res.status(401).json({ ok: false, message: "unauthenticated" });
    }

    const courseId = req.params.courseId || req.params.id || req.query.courseId;
    if (!courseId) {
      return res.status(400).json({ ok: false, message: "courseId is required" });
    }

    // Determine the current student's id. The JWT may store this under
    // _id, sub or id depending on the login flow. Prefer _id then sub.
    const studentId = actor._id || actor.sub || actor.id;
    if (!studentId) {
      return res.status(401).json({ ok: false, message: "unauthenticated" });
    }

    // Look up the course to know the chapter count and org scoping. A
    // student may only see progress for courses within their own org or
    // global courses. Use lean() to avoid mongoose document overhead.
    const course = await Course.findById(courseId)
      .select("_id orgId chapters isBundled")
      .lean();
    if (!course) {
      return res.status(404).json({ ok: false, message: "Course not found" });
    }

    // Determine the organisation context. If the course belongs to an
    // organisation use that; otherwise fall back to the actor's orgId.
    // This mirrors the logic in other student endpoints.
    let orgId = course.orgId || actor.orgId || null;
    if (!orgId && actor.sub) {
      try {
        const u = await User.findById(actor.sub).select("orgId").lean();
        if (u?.orgId) orgId = String(u.orgId);
      } catch {}
    }

    // Attempt to find an existing progress record for the
    // (studentId, courseId, orgId) tuple. Use lean() to get a plain
    // object. Progress documents are uniquely indexed on these fields.
    let prog = await Progress.findOne({ studentId, courseId, orgId }).lean();

    // Determine the number of chapters in this course. For bundled
    // courses the chapter count drives the size of the statuses array.
    const chapterCount = Array.isArray(course.chapters)
      ? course.chapters.length
      : 0;

    // Normalise a missing progress document by constructing a default
    // response. statuses will be sized to match chapterCount (or 1 when
    // there are no chapters) and overallStatus is only used for
    // non-bundled courses (or when chapterCount === 0).
    let statuses = [];
    let overallStatus = "not-started";
    let certificateUrl = null;

    if (prog) {
      // Use existing statuses; ensure they are sorted by chapterIndex
      if (Array.isArray(prog.statuses)) {
        statuses = prog.statuses
          .map((s) => ({
            chapterIndex: Number(s.chapterIndex) || 0,
            status: String(s.status || "not-started"),
          }))
          .sort((a, b) => a.chapterIndex - b.chapterIndex);
      }
      overallStatus = prog.overallStatus || overallStatus;
            // ✅ expose certificate URL to the frontend (may be null) 
      certificateUrl = typeof prog.certificateUrl === "string" && prog.certificateUrl.trim().length 
        ? prog.certificateUrl.trim() 
        : null;
    }

    // If course is bundled and has chapters, derive a fixed-size
    // statuses array. Missing entries default to not-started.
    if (chapterCount > 0) {
      const map = new Map();
      statuses.forEach((s) => {
        map.set(Number(s.chapterIndex), String(s.status || "not-started"));
      });
      const norm = [];
      for (let i = 0; i < chapterCount; i++) {
        const st = map.get(i) || "not-started";
        norm.push({ chapterIndex: i, status: st });
      }
      statuses = norm;
    } else {
      // Non-bundled course: use a single status reflecting the
      // overallStatus. Treat 'completed' or 'complete' as complete.
      const st =
        overallStatus === "completed" || overallStatus === "complete"
          ? "complete"
          : "not-started";
      statuses = [{ chapterIndex: 0, status: st }];
    }

    return res.json({ statuses, overallStatus, certificateUrl });
  } catch (e) {
    console.error("[studentProgress.get] error", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
