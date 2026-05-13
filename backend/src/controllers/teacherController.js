// backend/src/controllers/teacherController.js
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Progress from "../models/Progress.js";
import User from "../models/User.js";
import { loadTemplates } from "../certificates/registry.js";
import { renderCertificate } from "../certificates/render.js";

const isOid = (v) => mongoose.isValidObjectId(v);
const { ObjectId } = mongoose.Types;

// Load certificate templates once at module init (same pattern as certificates route)
const certTemplates = loadTemplates();

// ---------------------------------------------------------------------------
// INTERNAL HELPER — generate + upload certificate PDF to Cloudinary
// Returns the secure_url string, or throws on failure.
// Called from markStudentComplete; any exception is caught and logged there
// so it NEVER blocks the completion response.
// ---------------------------------------------------------------------------
async function generateAndStoreCertificate({ studentId, courseId, courseTitle }) {
  if (!certTemplates.size) throw new Error("no-certificate-templates-configured");

  const student = await User.findById(studentId).select("_id name email").lean();
  if (!student) throw new Error("student-not-found");

  // Use the first available template
  const template = certTemplates.values().next().value;

  const certData = {
    studentName: student.name || student.email || "Student",
    studentEmail: student.email || "",
    courseTitle: courseTitle || "",
    issuedAt: new Date(),
    qrUrl:
      (process.env.PUBLIC_API_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "") +
      `/api/certificates/verify?studentId=${studentId}&courseId=${courseId}`,
  };

  const pdfBuffer = await renderCertificate(template, certData);

  // Upload to Cloudinary as a raw PDF
  const folder = process.env.CLOUDINARY_FOLDER
    ? `${process.env.CLOUDINARY_FOLDER}/certificates`
    : "certificates";

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: `cert_${studentId}_${courseId}`, resource_type: "raw", format: "pdf", type: "upload" },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(pdfBuffer);
  });

  return result.secure_url;
}

// ---------------------------------------------------------------------------
// GET /api/teacher/students
// Returns enrollments for courses where course.teacherId === currentUser._id
// Teacher only sees students in their assigned courses — no cross-teacher leakage.
// ---------------------------------------------------------------------------
export async function listTeacherStudents(req, res) {
  try {
    const actor = req.user;
    const actorId = actor?._id || actor?.id || actor?.sub;
    if (!actorId || !isOid(actorId)) return res.status(401).json({ ok: false });

    const { courseId, status, page: pageRaw, limit: limitRaw } = req.query;

    const page  = Math.max(1, parseInt(pageRaw)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw) || 20));
    const skip  = (page - 1) * limit;

    const actorIdStr = String(actorId);
    const orgIdStr   = String(actor.orgId);
    const courseFilter = {
      $or: [
        { teacherId: actorIdStr },
        { teacherId: new ObjectId(actorIdStr) },
        {
          centerTeacherAssignments: {
            $elemMatch: {
              $or: [
                { centerId: orgIdStr,                teacherId: actorIdStr },
                { centerId: new ObjectId(orgIdStr),  teacherId: new ObjectId(actorIdStr) },
              ]
            }
          }
        }
      ]
    };
    if (courseId && isOid(courseId)) courseFilter._id = new ObjectId(String(courseId));

    const teacherCourses = await Course.find(courseFilter).select("_id title").lean();
    if (!teacherCourses.length) {
      return res.json({ items: [], total: 0 });
    }

    const courseIds = teacherCourses.map(c => c._id);
    const courseMap = new Map(teacherCourses.map(c => [String(c._id), c.title || ""]));

    const enrollFilter = { courseId: { $in: courseIds } };
    if (status) enrollFilter.status = status;

    const [enrollments, total] = await Promise.all([
      Enrollment.find(enrollFilter)
        .select("_id studentId courseId status createdAt progressPercent")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments(enrollFilter),
    ]);

    // Bulk-fetch student names/emails
    const studentIds = [...new Set(enrollments.map(e => String(e.studentId)))].filter(isOid);
    const studentMap = new Map();
    if (studentIds.length) {
      const users = await User.find({ _id: { $in: studentIds } })
        .select("_id name fullName firstName lastName email")
        .lean();
      for (const u of users) {
        const name = u.name || u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        studentMap.set(String(u._id), { name, email: u.email || null });
      }
    }

    // Bulk-fetch completion status from Progress
    const progressDocs = await Progress.find({
      studentId: { $in: studentIds.map(id => new ObjectId(id)) },
      courseId: { $in: courseIds },
    }).select("studentId courseId overallStatus certificateUrl").lean();

    const progressMap = new Map(
      progressDocs.map(p => [`${String(p.studentId)}:${String(p.courseId)}`, p])
    );

    const items = enrollments.map(e => {
      const student  = studentMap.get(String(e.studentId)) || {};
      const progress = progressMap.get(`${String(e.studentId)}:${String(e.courseId)}`);
      return {
        enrollmentId:     String(e._id),
        studentId:        String(e.studentId),
        studentName:      student.name  || null,
        studentEmail:     student.email || null,
        courseId:         String(e.courseId),
        courseTitle:      courseMap.get(String(e.courseId)) || null,
        enrollmentStatus: e.status,
        enrolledAt:       e.createdAt,
        progressPercent:  e.progressPercent ?? null,
        overallStatus:    progress?.overallStatus ?? null,
        certificateUrl:   progress?.certificateUrl ?? null,
      };
    });

    return res.json({ items, total });
  } catch (e) {
    console.error("[teacher.listStudents]", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// ---------------------------------------------------------------------------
// POST /api/teacher/students/:studentId/courses/:courseId/complete
// Teacher marks a student as completed for one of their assigned courses.
// Phase 5: After marking complete, auto-generates certificate (non-blocking).
// ---------------------------------------------------------------------------
export async function markStudentComplete(req, res) {
  try {
    const actor = req.user;
    const actorId = actor?._id || actor?.id || actor?.sub;
    if (!actorId || !isOid(actorId)) return res.status(401).json({ ok: false });

    const { studentId, courseId } = req.params;
    if (!isOid(studentId) || !isOid(courseId)) {
      return res.status(400).json({ ok: false, message: "Invalid studentId or courseId" });
    }

    // 1. Verify this teacher is assigned to the course
    const course = await Course.findOne({
      _id: new ObjectId(String(courseId)),
      teacherId: new ObjectId(String(actorId)),
    }).select("_id title orgId").lean();

    if (!course) {
      return res.status(403).json({ ok: false, message: "Course not assigned to you or not found" });
    }

    // 2. Verify the student is enrolled in this course
    const enrollment = await Enrollment.findOne({
      studentId: new ObjectId(String(studentId)),
      courseId:  new ObjectId(String(courseId)),
    }).select("_id").lean();

    if (!enrollment) {
      return res.status(404).json({ ok: false, message: "Student not enrolled in this course" });
    }

    // 3. Upsert Progress — set overallStatus = "completed"
    const progress = await Progress.findOneAndUpdate(
      {
        studentId: new ObjectId(String(studentId)),
        courseId:  new ObjectId(String(courseId)),
        orgId:     course.orgId,
      },
      {
        $set: {
          overallStatus: "completed",
          updatedBy: new ObjectId(String(actorId)),
        },
        $setOnInsert: {
          createdBy: new ObjectId(String(actorId)),
        },
      },
      { upsert: true, new: true }
    );

    // 4. Auto-trigger certificate generation (Phase 5)
    // RULE: completion ALWAYS succeeds. Certificate failure is logged and ignored.
    let certificateUrl = progress.certificateUrl || null;
    try {
      certificateUrl = await generateAndStoreCertificate({
        studentId,
        courseId: String(course._id),
        courseTitle: course.title || "",
      });
      await Progress.updateOne({ _id: progress._id }, { $set: { certificateUrl } });
    } catch (certErr) {
      console.error("[teacher.markComplete] certificate generation failed (non-blocking):", certErr?.message);
    }

    return res.json({
      ok: true,
      studentId,
      courseId,
      overallStatus: "completed",
      certificateUrl,
    });
  } catch (e) {
    console.error("[teacher.markComplete]", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/teacher/students/:studentId/courses/:courseId/progress
// Returns the full Progress document (chapter-level detail) for one student
// in one of the teacher's assigned courses.
// ---------------------------------------------------------------------------
export async function getStudentProgress(req, res) {
  try {
    const actor = req.user;
    const actorId = actor?._id || actor?.id || actor?.sub;
    if (!actorId || !isOid(actorId)) return res.status(401).json({ ok: false });

    const { studentId, courseId } = req.params;
    if (!isOid(studentId) || !isOid(courseId)) {
      return res.status(400).json({ ok: false, message: "Invalid studentId or courseId" });
    }

    // Verify this teacher owns the course
    const course = await Course.findOne({
      _id: new ObjectId(String(courseId)),
      teacherId: new ObjectId(String(actorId)),
    }).select("_id").lean();

    if (!course) {
      return res.status(403).json({ ok: false, message: "Course not assigned to you or not found" });
    }

    const progress = await Progress.findOne({
      studentId: new ObjectId(String(studentId)),
      courseId:  new ObjectId(String(courseId)),
    }).lean();

    return res.json({ ok: true, progress: progress || null });
  } catch (e) {
    console.error("[teacher.getStudentProgress]", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
