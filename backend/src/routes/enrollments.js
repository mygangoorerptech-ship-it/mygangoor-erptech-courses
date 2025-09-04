//backend/src/routes/enrollments.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/enrollmentsController.js";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";

const r = Router();

// admin + vendor (org scoped)
r.use("/org", requireAuth, requireRole(["admin","vendor"]));
r.get("/org", ctrl.list);

// students (own)
r.use("/me", requireAuth);
r.get("/me", ctrl.my);

// GET /api/enrollments/student/latest
// Returns the most recent enrollment for the logged-in student whose course visibility is public/private
r.get("/student/latest", requireAuth, async (req, res) => {
  const actor = req.user;
  if (!actor) return res.status(401).json({ ok: false });

  const recent = await Enrollment.find({ studentId: actor._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(20)
    .lean();

  let chosen = null;
  let chosenCourse = null;

  for (const e of recent) {
    if (!e.courseId) continue;
    const course = await Course.findById(e.courseId).select("_id visibility title").lean();
    if (!course) continue;
    if (course.visibility === "public" || course.visibility === "private") {
      chosen = e;
      chosenCourse = course;
      break;
    }
  }

  if (!chosen) return res.status(404).json({ ok: false, message: "no eligible enrollments" });

  return res.json({
    ok: true,
    premium: chosen.status === "premium",
    enrollment: {
      id: String(chosen._id),
      status: chosen.status,
      createdAt: chosen.createdAt,
      updatedAt: chosen.updatedAt,
      course: chosenCourse
        ? { id: String(chosenCourse._id), visibility: chosenCourse.visibility, title: chosenCourse.title }
        : null,
    },
  });
});

export default r;
