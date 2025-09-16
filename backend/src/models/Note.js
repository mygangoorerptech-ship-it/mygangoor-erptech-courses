// backend/src/models/Note.js
import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema({
  orgId:       { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true, required: true },
  ownerId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true }, // who created
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  kind:        { type: String, enum: ["rich","pdf"], required: true },
  // Rich text content (sanitized HTML)
  html:        { type: String, default: "" },
  // PDF info (Cloudinary)
  pdfUrl:      { type: String, default: "" },
  pdfPublicId: { type: String, default: "" },

  status:      { type: String, enum: ["draft","published","archived"], default: "published", index: true },

  createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

NoteSchema.index({ orgId: 1, courseId: 1, status: 1, createdAt: -1 });

export default mongoose.models.Note ?? mongoose.model("Note", NoteSchema);
