// backend/src/utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

export const NOTES_ACCESS = (process.env.CLOUDINARY_NOTES_ACCESS || "authenticated").toLowerCase();

export function initCloudinary() {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Signed authenticated RAW delivery URL.
// Used for protected PDF note streaming.
export function buildAuthenticatedPdfUrl(publicId) {
  /**
   * RAW authenticated delivery
   * requires extension in
   * signed delivery path.
   */
  const normalizedPublicId =
    String(publicId || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\?.*$/, "");

  const finalPublicId =
    normalizedPublicId.endsWith(".pdf")
      ? normalizedPublicId
      : `${normalizedPublicId}.pdf`;

  /**
   * IMPORTANT:
   * These assets are uploaded as:
   * raw/authenticated
   *
   * Use signed delivery URLs.
   *
   * DO NOT use auth_token here.
   * auth_token delivery and
   * signed authenticated delivery
   * are different Cloudinary systems.
   */
  return cloudinary.url(finalPublicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

// Public RAW URL for 'upload' type
export function buildPublicPdfUrl(publicId) {
  const normalizedPublicId =
    String(publicId || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\?.*$/, "");

  const finalPublicId =
    normalizedPublicId.endsWith(".pdf")
      ? normalizedPublicId
      : `${normalizedPublicId}.pdf`;

  return cloudinary.url(finalPublicId, {
    resource_type: "raw",
    type: "upload",
    secure: true,
  });
}
