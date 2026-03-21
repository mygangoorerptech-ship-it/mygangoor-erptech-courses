import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/auditController.js";

const r = Router();
r.use(requireAuth, requireRole(["superadmin","admin","teacher"]));
r.get("/logs", ctrl.list);

export default r;
