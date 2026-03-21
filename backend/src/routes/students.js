//backend/src/routes/students.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/studentsController.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const r = Router();
// org admins & teachers need this for dropdowns; SA can also view across orgs
r.use(requireAuth, requireRole(["superadmin","admin","teacher"]));
r.get("/", ctrl.list);

export default r;
