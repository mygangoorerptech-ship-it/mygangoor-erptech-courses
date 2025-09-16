//backend/src/controllers/uploadsController.js
import cloudinary from "../config/cloudinary.js";

export async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ ok:false, message:"file required" });
  const folder = process.env.CLOUDINARY_FOLDER || "courses";
  const stream = cloudinary.uploader.upload_stream(
    { folder, resource_type: "image" },
    (err, result) => {
      if (err) return res.status(500).json({ ok:false, message: err.message });
      return res.json({ ok:true, url: result.secure_url, publicId: result.public_id });
    }
  );
  stream.end(req.file.buffer);
}

export async function uploadVideo(req, res) {
  if (!req.file) return res.status(400).json({ ok:false, message:"file required" });
  const folder = process.env.CLOUDINARY_FOLDER || "courses";
  const stream = cloudinary.uploader.upload_stream(
    { folder, resource_type: "video" },
    (err, result) => {
      if (err) return res.status(500).json({ ok:false, message: err.message });
      // raw URL of full video:
      return res.json({
        ok:true,
        url: result.secure_url,
        duration: result.duration ?? null,
        publicId: result.public_id
      });
    }
  );
  stream.end(req.file.buffer);
}

/**
 * Demo clip: return a delivery URL that plays only the first 10s.
 * We keep the original on Cloudinary but hand back a transformed URL.
 * Ref: Cloudinary video transformations (so_0, du_10). 
 */
export async function uploadDemoClip(req, res) {
  if (!req.file) return res.status(400).json({ ok:false, message:"file required" });
  const folder = process.env.CLOUDINARY_FOLDER || "courses";
  const stream = cloudinary.uploader.upload_stream(
    { folder, resource_type: "video" },
    (err, result) => {
      if (err) return res.status(500).json({ ok:false, message: err.message });
      // Build a 10s delivery URL for the uploaded public_id
      // (so_0, du_10). Cloudinary will deliver a 10s clip.
      const demoUrl = cloudinary.url(result.public_id, {
        resource_type: "video",
        secure: true,
        transformation: [{ start_offset: 0, duration: 10 }]
      });
      return res.json({ ok:true, url: demoUrl, publicId: result.public_id, duration: 10 });
    }
  );
  stream.end(req.file.buffer);
}

export async function uploadPdf(req, res) {
  if (!req.file) return res.status(400).json({ ok:false, message:"file required" });

  const folder = process.env.CLOUDINARY_FOLDER || "notes";
  const mime = (req.file.mimetype || "").toLowerCase();
  if (!mime.includes("pdf")) return res.status(400).json({ ok:false, message:"only application/pdf allowed" });

    const mode = String(process.env.CLOUDINARY_NOTES_ACCESS || "public").toLowerCase(); 
  // Delivery/storage type for the asset: 
  // - "authenticated": requires Cloudinary Auth Token feature + token key 
  // - "private":       signed path, asset must be uploaded as type "private" 
  // - "upload":        public 
  const deliveryType = (mode === "authenticated") ? "authenticated" 
                     : (mode === "private")       ? "private" 
                                                   : "upload";

  const stream = cloudinary.uploader.upload_stream(
    { folder, resource_type: "raw", format: "pdf", type: deliveryType },
    (err, result) => {
      if (err) return res.status(500).json({ ok:false, message: err.message });
      return res.json({ ok: true, url: result.secure_url, publicId: result.public_id });
    }
  );
  stream.end(req.file.buffer);
}
