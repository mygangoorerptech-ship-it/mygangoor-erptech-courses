// backend/src/routes/studentProgress.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import { get } from "../controllers/studentProgressController.js";

const r = Router();

// Only GET is exposed. The handler will infer the studentId from
// the authenticated user and the orgId from the course or token.
r.get(
  "/:courseId",
  requireAuth,
  requireRole({ anyOf: ["student", "orguser", "orgadmin"] }),
  get
);

export default r;
