// backend/src/routes/studentNotes.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import {
  listForStudent,
  presignStudentNote,
} from "../controllers/notes.Controller.js"; // <- only these two

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
r.get("/presign", allowStudentLike, presignStudentNote);

export default r;
