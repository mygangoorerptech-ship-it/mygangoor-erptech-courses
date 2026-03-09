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

// Authenticated (token) URL for RAW assets.
// Phase 7 fix: if CLOUDINARY_AUTH_TOKEN_KEY is absent (common misconfiguration
// in staging/production when the env var is not set), fall back to a regular
// signed URL instead of throwing an unhandled exception that silently produces
// a 500 response with no actionable message for the developer.
export function buildAuthenticatedPdfUrl(publicId, { ttl = 3600 } = {}) {
  if (!CLOUDINARY_AUTH_TOKEN_KEY) {
    console.warn(
      "[cloudinary] CLOUDINARY_AUTH_TOKEN_KEY is not set. " +
      "Falling back to signed URL delivery for RAW asset. " +
      "Set CLOUDINARY_AUTH_TOKEN_KEY on Render to enable authenticated delivery."
    );
    // Signed URL (api_secret-based) is less secure than token auth but works
    // without the auth-token add-on and avoids a hard crash.
    return cloudinary.url(publicId, {
      resource_type: "raw",
      type: "upload",
      sign_url: true,
      secure: true,
    });
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
