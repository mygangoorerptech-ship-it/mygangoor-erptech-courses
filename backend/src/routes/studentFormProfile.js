//src/routes/studentFormProfile.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import { getFormProfile } from "../controllers/studentFormProfileController.js";

const r = Router();
r.use(requireAuth);
r.get("/", getFormProfile);  // GET /api/student/profile/form

export default r;
