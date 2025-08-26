//backend/src/routes/assessmentGroups.js
import { Router } from "express";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import { list, create, update, destroy } from "../controllers/assessmentGroupsController.js";

const r = Router();

r.use(requireAuth);

r.get("/assessment-groups", requireAnyRole("superadmin", "admin", "vendor"), list);
r.post("/assessment-groups", requireAnyRole("superadmin", "admin"), create);
r.put("/assessment-groups/:id", requireAnyRole("superadmin", "admin"), update);
r.delete("/assessment-groups/:id", requireAnyRole("superadmin"), destroy);

export default r;
