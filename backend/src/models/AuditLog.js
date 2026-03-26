// backend/src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action:  {
      type: String,
      enum: [
        // ── auth / security events (existing) ──
        "PASSWORD_CHANGE",
        "EMAIL_CHANGE_REQUEST",
        "EMAIL_CHANGE_VERIFY",
        "2FA_ENABLE",
        "2FA_DISABLE",
        "BACKUP_CODES_GENERATED",
        "SESSION_REVOKED",
        "SESSION_REVOKED_ALL",
        "SUSPICIOUS_LOGIN",
        // ── session events ──
        "login",
        "logout",
        // ── admin CRUD events ──
        "create",
        "update",
        "delete",
        "status_change",
        "role_change",
      ],
      required: true,
    },
    ip:      { type: String },
    ua:      { type: String },
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// TTL: auto-remove audit logs older than 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);
