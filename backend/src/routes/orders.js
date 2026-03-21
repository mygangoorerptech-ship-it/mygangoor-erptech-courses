// backend/src/routes/orders.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/ordersController.js";

const r = Router();
r.use(requireAuth, requireRole(["superadmin","admin","teacher"]));
r.get("/", ctrl.list);
r.get("/:id", ctrl.getOne);
r.post("/:id/refund", ctrl.refund);
export default r;
