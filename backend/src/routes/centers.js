// backend/src/routes/centers.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/centersController.js";

const r = Router();
r.use(requireAuth);

// Read: admin, teacher, superadmin — NOT student (internal structure, not public)
r.get("/",       requireRole(["admin", "teacher", "superadmin"]), ctrl.list);
r.post("/",      requireRole(["admin", "superadmin"]),             ctrl.create);
r.patch("/:id",  requireRole(["admin", "superadmin"]),             ctrl.patch);
r.delete("/:id", requireRole(["admin", "superadmin"]),             ctrl.remove);

export default r;
