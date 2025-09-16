// backend/src/utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_AUTH_TOKEN_KEY,
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

// Authenticated (token) URL for RAW assets
export function buildAuthenticatedPdfUrl(publicId, { ttl = 3600 } = {}) {
  if (!CLOUDINARY_AUTH_TOKEN_KEY) {
    throw new Error("CLOUDINARY_AUTH_TOKEN_KEY is required for authenticated delivery");
  }
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
    auth_token: { key: CLOUDINARY_AUTH_TOKEN_KEY, duration: ttl },
  });
}

// Public RAW URL for 'upload' type
export function buildPublicPdfUrl(publicId) {
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "upload",
    secure: true,
  });
}
