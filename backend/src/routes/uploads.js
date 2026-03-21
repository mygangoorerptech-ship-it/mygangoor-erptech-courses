//backend/src/routes/uploads.js
import { Router } from "express";
import multer from "multer";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import { uploadImage, uploadVideo, uploadDemoClip, uploadPdf } from "../controllers/uploadsController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const r = Router();

r.use(requireAuth, requireAnyRole(["superadmin","admin","teacher"]));
r.post("/image", upload.single("file"), uploadImage);
r.post("/video", upload.single("file"), uploadVideo);
r.post("/demo-video", upload.single("file"), uploadDemoClip);
r.post("/pdf", upload.single("file"), uploadPdf);

export default r;
