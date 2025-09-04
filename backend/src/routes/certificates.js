//backend/src/routes/certificates.js
import express from "express";
import fs from "fs";
import path from "path";
import { loadTemplates } from "../certificates/registry.js";
import { renderCertificate } from "../certificates/render.js";
import User from "../models/User.js";
import Course from "../models/Course.js";

// Load templates once at startup. In a real application you
// might re-read this periodically or watch the filesystem for changes.
const templates = loadTemplates();
const router = express.Router();

/**
 * GET /cert-templates
 * Return a list of available certificate templates. Each entry
 * contains at least an id and title. If a preview image is defined
 * in the template metadata, it will be returned as a relative URL.
 */
router.get("/cert-templates", (req, res) => {
  const list = [...templates.values()].map((t) => {
    // Always include id and title
    const out = {
      id: t.id,
      title: t.title,
      preview: null,
    };
    // If a preview file is specified, try to read it and return a data URI. This
    // avoids CORS issues and proxy configuration when loading previews in the
    // front‑end. Only PNG previews are currently supported.
    if (t.preview) {
      try {
        const filePath = path.join(t.dir, t.preview);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        const data = fs.readFileSync(filePath).toString("base64");
        out.preview = `data:${mime};base64,${data}`;
      } catch {
        // ignore errors; preview will remain null
      }
    }
    return out;
  });
  res.json({ templates: list });
});

/**
 * GET /cert-templates/:id/preview
 * Render the specified template with dummy data and return a PDF for
 * preview. This can be used by the front-end to show a quick look at
 * the design.
 */
router.get("/cert-templates/:id/preview", async (req, res, next) => {
  try {
    const t = templates.get(req.params.id);
    if (!t) return res.status(404).json({ error: "Template not found" });
    // Use minimal sample data. Adjust as needed for your templates.
    const sample = {
      student: { name: "Sample Student" },
      course: { title: "Sample Course" },
      issuedOn: new Date(),
      issuer: "ECA Academy",
      qrUrl: "https://eca.com/verify/sample",
    };
    const pdf = await renderCertificate({ template: t, data: sample });
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /certificates/generate
 * Generate a certificate for a given student and course using the
 * specified template. The request body should include:
 *   - templateId: id of the template to use
 *   - studentId: id of the student
 *   - courseId: id of the course
 * The endpoint will look up the student and course in the database,
 * generate a QR code pointing at a verification URL (which you should
 * implement separately) and return the resulting PDF. The response
 * includes Content-Disposition headers to trigger a download.
 */
router.post("/certificates/generate", async (req, res, next) => {
  try {
    const { templateId, studentId, courseId } = req.body || {};
    const t = templates.get(templateId);
    if (!t) return res.status(404).json({ error: "Template not found" });
    const student = await User.findById(studentId).lean();
    const course = await Course.findById(courseId).lean();
    if (!student || !course) return res.status(404).json({ error: "Student or course not found" });
    // Build a record id (dummy here). You should create a real
    // certificate record in your database and use its id for verification.
    const recordId = `${studentId}-${courseId}-${Date.now()}`;
    // Build a data payload for the template. Different templates may
    // require different fields (see requiredFields in meta.json). We
    // provide sensible defaults here and allow undefined values to
    // remain blank in the rendered output. You can customise these
    // defaults to suit your organisation.
    const now = new Date();
    const defaultData = {
      // Title shown at the top of the certificate
      titleText: `Certificate of Completion`,
      // Prefix line before student name
      awardPrefix: `This certificate is awarded to`,
      // Student information
      student: { name: student.name || student.email },
      // Course information
      course: { title: course.title, chapterCount: course.chapterCount || 0 },
      // Description of achievement
      description: `${student.name || student.email} has successfully completed the ${course.title} course.`,
      // Signers (up to two). Replace with real names/roles or leave blank.
      signers: [
        { name: "Instructor", role: "Instructor", signatureUrl: "" },
        { name: "Director", role: "Director", signatureUrl: "" },
      ],
      // Organisation issuing the certificate
      org: { name: "ECA Academy", logoUrl: "" },
      // Badge text
      badge: {
        line1: "Certificate",
        line2: course.title,
        year: now.getFullYear().toString(),
      },
      // QR code URL (verification link)
      qrUrl: `https://eca.com/verify/${recordId}`,
      // Additional meta
      certificateId: recordId,
      issueDate: now.toLocaleDateString(),
      websiteUrl: "https://eca.com",
      // Keep legacy fields for templates that rely on them
      issuedOn: now,
      issuer: "ECA Academy",
    };
    const pdf = await renderCertificate({ template: t, data: defaultData });
    const filename = `${(student.name || "certificate").replace(/\s+/g, "_")}--${(course.title || "course").replace(/\s+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(pdf);
  } catch (e) {
    // Log error details to the server console for easier debugging. The
    // error may originate from Handlebars, Puppeteer, the database, or
    // elsewhere. Log both message and stack when available.
    console.error('Error generating certificate:', e?.message || e);
    if (e?.stack) console.error(e.stack);
    // Respond with a generic 500 and include the error message so the
    // front-end can display it if needed. Do not leak sensitive info.
    const errMsg = e?.message || 'Server error';
    res.status(500).json({ error: errMsg });
  }
});

export default router;