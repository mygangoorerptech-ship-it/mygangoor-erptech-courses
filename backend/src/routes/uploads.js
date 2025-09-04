//backend/src/routes/uploads.js
import { Router } from "express";
import multer from "multer";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import { uploadImage, uploadVideo, uploadDemoClip } from "../controllers/uploadsController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const r = Router();

r.use(requireAuth, requireAnyRole(["superadmin","admin","vendor"]));
r.post("/image", upload.single("file"), uploadImage);
r.post("/video", upload.single("file"), uploadVideo);
r.post("/demo-video", upload.single("file"), uploadDemoClip);

export default r;
