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

// C-1 fix: strip all MFA secrets from JSON serialization.
// JS code (authController) can still access these fields normally —
// toJSON only runs during JSON.stringify / res.json().
mfaSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.totpSecretHash;
    delete ret.totpSecretEnc;
    delete ret.emailOtp;
    return ret;
  },
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, index: true },
  // C-1 fix: select:false forces explicit opt-in via .select("+passwordHash")
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ["superadmin","admin","teacher","student","orgadmin","orguser"], default: "student" },
  status: { type: String, enum: ["active","disabled"], default: "active" },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
  mfa: { type: mfaSchema, default: () => ({ required: false }) },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // Security completion (first MFA, etc). Default true for back-compat;
  // we will explicitly set false for new admin/teacher and MFA-required students.
  isVerified: { type: Boolean, default: true },
  // Password reset fields — C-1 fix: select:false prevents token from appearing in API responses
  passwordResetToken: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false },
}, { timestamps: true });

// C-1 fix: schema-level toJSON transform as a final safety net.
// Removes sensitive fields even if a query accidentally selects them.
// Does NOT affect normal JS property access within server-side code.
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
});

userSchema.index({ updatedAt: -1 });
// PERF: resolveManagerId() query — User.findOne({orgId,role,status}) was a full collection scan
userSchema.index({ orgId: 1, role: 1, status: 1 }, { name: "orgId_1_role_1_status_1" });
export default mongoose.model("User", userSchema);
