// backend/src/routes/saPayments.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/paymentsController.js";

const r = Router();
r.use(requireAuth, requireRole("superadmin"));
// reuse list but without org filter → tiny wrapper in controller:
r.get("/", async (req,res)=> ctrl.listAll(req,res));
export default r;
