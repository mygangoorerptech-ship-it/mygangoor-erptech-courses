import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import { listAdmin, getAdmin, patchAdmin } from "../controllers/contactMessagesController.js";

const r = Router();

r.get("/contact-messages", requireAuth, requireRole(["superadmin", "admin"]), listAdmin);
r.get("/contact-messages/:id", requireAuth, requireRole(["superadmin", "admin"]), getAdmin);
r.patch("/contact-messages/:id", requireAuth, requireRole(["superadmin", "admin"]), patchAdmin);

export default r;
