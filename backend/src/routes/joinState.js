//backend/src/routes/joinState.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import { state } from "../controllers/joinStateController.js";

const r = Router();
r.use(requireAuth);       // logged-in student
r.get("/state", state);   // GET /api/student/join/state

export default r;
