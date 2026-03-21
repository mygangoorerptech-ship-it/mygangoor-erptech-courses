// backend/src/routes/teacher.js
import { Router } from "express";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import {
  listTeacherStudents,
  markStudentComplete,
  getStudentProgress,
} from "../controllers/teacherController.js";

const r = Router();

r.use(requireAuth);
r.use(requireAnyRole("teacher"));

r.get("/students", listTeacherStudents);
r.post("/students/:studentId/courses/:courseId/complete", markStudentComplete);
r.get("/students/:studentId/courses/:courseId/progress", getStudentProgress);

export default r;
