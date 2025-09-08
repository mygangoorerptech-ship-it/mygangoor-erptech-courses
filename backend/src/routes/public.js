// backend/src/routes/public.js
import { Router } from "express";
import { featured } from "../controllers/publicCatalogController.js";

const r = Router();

// Public catalog endpoints (no auth)
r.get("/catalog/featured", featured);

export default r;
