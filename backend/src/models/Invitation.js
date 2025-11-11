//backend/src/models/Invitation.js
import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  email: { type: String, index: true },
  role: { type: String, enum: ["admin","vendor","student","orgadmin","orguser"] },
  mfaRequired: { type: Boolean, default: false },
  mfaMethod: { type: String, enum: ["otp","totp", null], default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Org", default: null },
  tokenHash: { type: String, required: true },
  token: { type: String, default: null }, // Store plain token temporarily for email sending (optional, for admin flow)
  expiresAt: { type: Date, required: true },
  accepted: { type: Boolean, default: false },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Invitation", invitationSchema);
