// backend/src/routes/saReconciliation.js
//
// Routes for reconciliation and settlement. Mounted at /api/sa/reconciliation
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/reconciliationController.js";

const r = Router();
// Only superadmins can perform reconciliation
r.use(requireAuth, requireRole("superadmin"));

// GET /api/sa/reconciliation
r.get("/", ctrl.list);

// POST /api/sa/reconciliation/:orgId/settle
r.post("/:orgId/settle", ctrl.settleOrg);

export default r;