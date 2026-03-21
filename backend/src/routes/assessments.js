//backend/src/routes/assessments.js
import { Router } from "express";
import { list, create, update, setStatus, destroy, listByGroup } from "../controllers/assessmentsController.js";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";

const r = Router();

r.use(requireAuth);
r.use(requireAnyRole("superadmin", "admin", "teacher"));

r.get("/", list);
r.post("/assessments", create);
r.get("/assessments/by-group/:groupId", listByGroup);
r.patch("/assessments/:id", update);
r.post("/assessments/:id/status", setStatus);
r.delete("/assessments/:id", destroy);

export default r;
