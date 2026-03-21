// backend/src/routes/certificates.js
import express from "express";
import { loadTemplates } from "../certificates/registry.js";
import { renderCertificate } from "../certificates/render.js";
import { requireAuth, requireRole } from "../middleware/authz.js";
import { adminActionLimiter } from "../middleware/adminLimits.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

const templates = loadTemplates();
const router = express.Router();

// List templates for TemplatePicker
router.get("/cert-templates", requireAuth, requireRole(["superadmin", "admin", "teacher"]), (req, res) => {
  try {
    const list = Array.from(templates.values()).map((t) => ({
      id: t.id,
      title: t.title,
      preview: t.preview || null,
    }));
    res.json({ ok: true, templates: list });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Generate certificate PDF (preview/issue)
router.post(
  "/certificates/generate",
  requireAuth,
  requireRole(["superadmin", "admin", "teacher"]),
  adminActionLimiter,
  async (req, res) => {
    try {
      const { templateId, studentId, courseId } = req.body || {};
      if (!templateId || !studentId || !courseId) {
        return res.status(400).json({ ok: false, message: "templateId, studentId and courseId are required" });
      }
      const template = templates.get(String(templateId));
      if (!template) return res.status(404).json({ ok: false, message: "template-not-found" });

      const student = await User.findById(studentId).select("_id name email").lean();
      const course = await Course.findById(courseId).select("_id title").lean();
      if (!student || !course) return res.status(404).json({ ok: false, message: "student-or-course-not-found" });

      // Same payload shape your templates already expect
      const data = {
        studentName: student.name,
        studentEmail: student.email,
        courseTitle: course.title,
        issuedAt: new Date(),
        qrUrl:
          req.protocol + "://" + req.get("host") +
          "/api/certificates/verify?studentId=" + student._id + "&courseId=" + course._id,
      };

      const pdf = await renderCertificate(template, data);
      const filename =
        `${(student.name || "student").toLowerCase().replace(/\s+/g, "-")}--` +
        `${(course.title || "course").toLowerCase().replace(/\s+/g, "-")}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      return res.send(pdf);
    } catch (e) {
      console.error("[certificates:generate] error:", e);
      return res.status(500).json({ ok: false, message: e.message });
    }
  }
);

export default router;
