// backend/src/models/Notification.js
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  orgId:    { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, default: null },
  type:     { type: String, required: true, index: true }, // e.g., 'certificate_available','course_incomplete','wishlist','new_course'
  title:    { type: String, required: true },
  body:     { type: String, required: true },
  data:     { type: Object, default: {} }, // flexible payload (courseId, progressId, url, etc)
  priority: { type: String, enum: ["low","normal","high"], default: "normal" },

  // Scheduling / delivery control
  dueAt:       { type: Date, default: () => new Date() }, // first time we intend to show
recurrence:  { type: String, enum: ["none","daily","weekly","monthly"], default: "none" },
  maxTimes:    { type: Number, default: 1 },  // how many times to repeatedly show
  sentCount:   { type: Number, default: 0 },  // how many times we've shown so far
  lastSentAt:  { type: Date, default: null },

  // User state
  readAt:     { type: Date, default: null },
  resolvedAt: { type: Date, default: null }, // stop reminding when set
}, { timestamps: true });

NotificationSchema.index({ userId: 1, type: 1, 'data.courseId': 1, resolvedAt: 1 });

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
