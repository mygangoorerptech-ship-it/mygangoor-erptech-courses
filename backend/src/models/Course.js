//backend/src/models/Course.js
import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  link:  { type: String, trim: true },
}, { _id: false });

const ChapterSchema = new mongoose.Schema({
  title:           { type: String, required: true, trim: true },
  subtitle:        { type: String, trim: true },
  description:     { type: String, trim: true },
  coverUrl:        { type: String, trim: true },
  videoUrl:        { type: String, trim: true },
  youtubeUrl:      { type: String, trim: true },
  durationSeconds: { type: Number, default: 0 },
  order:           { type: Number, default: 0 },
  assignments:     [AssignmentSchema],
}, { _id: false });

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug:  { type: String, trim: true, lowercase: true, index: true, sparse: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },

  // pricing & visibility
  price: { type: Number, default: 0 }, // paise
  visibility: { type: String, enum: ["public","private","unlisted"], default: "unlisted" },
  status: { type: String, enum: ["draft","published","archived"], default: "draft" },

  // tenancy/ownership
  orgId:   { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null }, // null => Global
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // "owner (Admin)" for attribution
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // who actually created (admin or vendor)
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },      // admin for vendor

// bundle
isBundled: { type: Boolean, default: false },
// bundle-level extras (NOT per-chapter)
discountPercent: { type: Number, min: 0, max: 100, default: 0 },
level: { type: String, enum: ["all","beginner","intermediate","advanced"], default: "all" },
bundleCoverUrl: { type: String, trim: true },
// stored in paise to match price
platformFee: { type: Number, default: 4900 },
  courseType:    { type: String, enum: ["free","paid"], default: "paid" }, 
  durationText:  { type: String, trim: true, default: "" }, 
  teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  chapters:  [ChapterSchema],
  demoVideoUrl: { type: String, trim: true }, // always a 10s clip at delivery

  tags: [{ type: String, trim: true }],
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

CourseSchema.index({ orgId: 1, slug: 1 }, { unique: false, sparse: true });
CourseSchema.index({ orgId: 1, ownerId: 1, status: 1 });

export default mongoose.models.Course ?? mongoose.model("Course", CourseSchema);
