//backend
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import { updateMfaPolicy } from "../controllers/userController.js";

const r = Router();

// Superadmin only: update a user's MFA policy
r.patch("/users/:id/mfa", requireAuth, requireRole("superadmin"), updateMfaPolicy);

export default r;
