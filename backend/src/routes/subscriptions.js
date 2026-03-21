// backend/src/routes/subscriptions.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/subscriptionsController.js";

const r = Router();
r.use(requireAuth, requireRole(["superadmin","admin","teacher"]));
r.get("/", ctrl.list);
r.post("/", ctrl.create);
r.post("/:id/cancel", ctrl.cancel);
r.post("/:id/refund", ctrl.refund);
export default r;
