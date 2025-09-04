//backend/src/routes/payments.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/paymentsController.js";

const r = Router();
// admins and vendors can manage org-scoped payments
r.use(requireAuth, requireRole(["admin","vendor"]));

r.get("/", ctrl.list);
r.post("/offline", ctrl.createOffline);
r.post("/:id/verify", ctrl.verify);
r.post("/:id/reject", ctrl.reject);
r.post("/:id/refund", ctrl.refund);

export default r;
