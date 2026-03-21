// backend/src/routes/reports.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/reportsController.js";

const r = Router();

// All report operations require authentication and one of the allowed roles
r.use(requireAuth, requireRole(["superadmin", "admin", "teacher"]));

// Export to CSV. Declare before /:id to avoid routing conflicts.
r.get("/export/csv", ctrl.exportCsv);

// List reports with filters & pagination
r.get("/", ctrl.list);

// Create or update a progress record
r.post("/", ctrl.upsert);

// Remove a progress record (teachers cannot remove)
r.delete("/:id", ctrl.remove);

// Publish or update a certificate URL
r.post("/:id/certificate", ctrl.publishCertificate);

export default r;