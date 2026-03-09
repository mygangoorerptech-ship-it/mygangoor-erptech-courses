// backend/src/routes/studentNotes.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import {
  listForStudent,
  presignStudentNote,
  streamPdf,
} from "../controllers/notes.Controller.js";

// Minimal role guard (avoids requireRole signature mismatches)
function allowStudentLike(req, res, next) {
  const role = req?.user?.role;
  if (!role) return res.status(401).json({ ok: false, error: "unauthenticated" });
  if (["student", "orguser", "orgadmin"].includes(role)) return next();
  return res.status(403).json({ ok: false, error: "forbidden" });
}

const r = Router();
r.use(requireAuth);

// GET /api/student/notes?courseId=...
r.get("/", allowStudentLike, listForStudent);

// GET /api/student/notes/presign?id=...&ttl=...
// Kept for backward compatibility; primary PDF delivery now uses /pdf/:id
r.get("/presign", allowStudentLike, presignStudentNote);

// GET /api/student/notes/pdf/:id
// Phase 2/7: Backend-proxy PDF stream. Fetches from Cloudinary server-side so
// the browser never makes a cross-origin request to the CDN directly.
// This eliminates Cloudinary CORS as a production failure vector.
r.get("/pdf/:id", allowStudentLike, streamPdf);

export default r;
