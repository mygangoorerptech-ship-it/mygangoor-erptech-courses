//backend/src/routes/payments.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/paymentsController.js";

const r = Router();

// H-1 fix: split guards by operation.
// Teachers may list and create offline payments but CANNOT verify, reject, or refund.
// All routes still require authentication.

// Teacher + admin: read and create
r.get("/",            requireAuth, requireRole(["admin","teacher"]), ctrl.list);
r.post("/offline",    requireAuth, requireRole(["admin","teacher"]), ctrl.createOffline);

// Admin ONLY: verify, reject, refund
r.post("/:id/verify", requireAuth, requireRole(["admin"]), ctrl.verify);
r.post("/:id/reject", requireAuth, requireRole(["admin"]), ctrl.reject);
r.post("/:id/refund", requireAuth, requireRole(["admin"]), ctrl.refund);

export default r;
