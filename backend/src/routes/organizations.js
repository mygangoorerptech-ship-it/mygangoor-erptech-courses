//backend/src/routes/organizations.js
import { Router } from "express";
import { list, create, update, setStatus, suspend, destroy, bulkUpsert, bulkUploadFile, template } from "../controllers/organizationsController.js";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import multer from "multer";

const r = Router();
r.use(requireAuth);
r.use(requireAnyRole(["superadmin"])); // protect all

// file upload (memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

r.get("/", list);
r.post("/", create);
r.patch("/:id", update);
r.patch("/:id/status", setStatus);
r.post("/:id/suspend", suspend);
r.delete("/:id", destroy);

// --- NEW: bulk + templates ---
r.post("/bulk", bulkUpsert);                     // JSON { rows: [...] }
r.post("/bulk-file", upload.single("file"), bulkUploadFile); // multipart (csv/xlsx)
r.get("/template.:ext", template);               // /template.csv or /template.xlsx
r.get("/template", template);                    // ?format=csv|xlsx fallback

export default r;
