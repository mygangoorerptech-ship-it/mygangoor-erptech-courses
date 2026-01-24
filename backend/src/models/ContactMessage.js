import mongoose from "mongoose";

const ContactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, maxlength: 200 },
  phone: { type: String, default: "", trim: true, maxlength: 40 },
  subject: { type: String, default: "", trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  ipAddress: { type: String, default: "", maxlength: 80 },
  userAgent: { type: String, default: "", maxlength: 500 },
  status: { type: String, enum: ["new", "read", "resolved"], default: "new" },
}, { timestamps: true });

ContactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.ContactMessage ?? mongoose.model("ContactMessage", ContactMessageSchema);
