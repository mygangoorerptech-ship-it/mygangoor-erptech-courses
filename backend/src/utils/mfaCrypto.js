// src/utils/mfaCrypto.js
import crypto from "crypto";

const ALG = "aes-256-gcm";

function getKey() {
  const raw = process.env.MFA_ENC_KEY || "";
  if (raw.length < 32) {
    throw new Error("MFA_ENC_KEY must be at least 32 bytes (base64url recommended)");
  }
  // Allow plain utf-8 or base64url
  let key;
  if (/^[A-Za-z0-9_-]{43,}$/.test(raw)) {
    key = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } else {
    key = Buffer.from(raw, "utf8");
  }
  if (key.length < 32) {
    // right pad / truncate to 32
    const k = Buffer.alloc(32);
    key.copy(k);
    key = k;
  }
  return key.slice(0, 32);
}

export function encryptTotpSecret(base32Secret) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(base32Secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64url"),
    ct: ct.toString("base64url"),
    tag: tag.toString("base64url"),
  };
}

 export function decryptTotpSecret(enc) {
  if (!enc || !enc.iv || !enc.ct || !enc.tag) {
    throw new Error("Missing encrypted fields");
  }
   const key = getKey();
   const iv = Buffer.from(enc.iv, "base64url");
   const ct = Buffer.from(enc.ct, "base64url");
   const tag = Buffer.from(enc.tag, "base64url");
   const decipher = crypto.createDecipheriv(ALG, key, iv);
   decipher.setAuthTag(tag);
   const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
   return pt.toString("utf8");
 }
