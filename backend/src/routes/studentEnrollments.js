//backend/src/routes/studentEnrollments.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import { active } from "../controllers/studentEnrollmentsActiveController.js";

// if this file already exists with other routes, just append the two lines below
const r = Router();
r.use(requireAuth);
r.get("/active", active);   // <-- NEW

export default r;
