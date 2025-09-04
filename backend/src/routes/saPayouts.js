// backend/src/routes/saPayouts.js
//
// Routes for managing payouts (superadmin only). Exposes
// GET /api/sa/payouts to list payouts and POST /api/sa/payouts to create
// a new payout for an organisation.

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/payoutsController.js";

const r = Router();
// ensure the user is authenticated and is superadmin
r.use(requireAuth, requireRole("superadmin"));

// list payouts (optionally filtered by org or date)
r.get("/", ctrl.list);

// create a payout
r.post("/", ctrl.create);

// get a payout detail
r.get("/:id", ctrl.getOne);

export default r;