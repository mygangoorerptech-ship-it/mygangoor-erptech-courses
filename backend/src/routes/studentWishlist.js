// backend/src/routes/studentWishlist.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/wishlistController.js";

const r = Router();
r.use(requireAuth, requireRole({ anyOf: ["student","orguser","orgadmin"] }));

r.get("/", ctrl.list);
r.post("/toggle", ctrl.toggle);

export default r;
