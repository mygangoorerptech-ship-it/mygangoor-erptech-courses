// backend/src/routes/studentCatalog.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import { listCourses, listCatalogCards, getCourseDetail } from "../controllers/studentCatalogController.js";

const r = Router();
r.get(
  "/courses",
  requireAuth,
  requireRole({ anyOf: ["student", "orguser", "orgadmin"] }),
  listCourses
);

// NEW: minimal cards payload for Tracks
r.get(
  "/courses/cards",
  (req, _res, next) => {
    console.log("[PUBLIC ROUTE HIT] /courses/cards");
    next();
  },
  listCatalogCards
);

r.get(
  "/courses/:id",
  requireAuth,
  requireRole({ anyOf: ["student", "orguser", "orgadmin"] }),
  getCourseDetail
);

export default r;
