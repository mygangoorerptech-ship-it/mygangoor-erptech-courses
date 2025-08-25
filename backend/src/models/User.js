//backend/src/models/User.js
import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema({
  codeHash: String,
  expiresAt: Date,
  lastSentAt: Date,
  attempts: { type: Number, default: 0 }
}, { _id: false });

const mfaSchema = new mongoose.Schema({
  required: { type: Boolean, default: false },
  method: { type: String, enum: ["otp", "totp", null], default: null },
  // Deprecated: kept for backward compatibility
  totpSecretHash: { type: String, default: null },
  // New: encrypted TOTP secret (AES-GCM) {iv, ct, tag}
  totpSecretEnc: {
    iv: { type: String, default: null },
    ct: { type: String, default: null },
    tag: { type: String, default: null },
  },
  emailOtp: { type: emailOtpSchema, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, index: true },
  passwordHash: String,
  role: { type: String, enum: ["superadmin","admin","vendor","student","orgadmin","orguser"], default: "student" },
  status: { type: String, enum: ["active","disabled"], default: "active" },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", default: null },
  mfa: { type: mfaSchema, default: () => ({ required: false }) },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // Security completion (first MFA, etc). Default true for back-compat;
  // we will explicitly set false for new admin/vendor and MFA-required students.
  isVerified: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("User", userSchema);
