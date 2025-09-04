// backend/src/models/Progress.js
import mongoose from "mongoose";

const ChapterStatusSchema = new mongoose.Schema(
  {
    // Numeric index of the chapter in the Course.chapters array
    chapterIndex: { type: Number, required: true },
    // Arbitrary string status, e.g. "not-started", "complete-1", "complete-2", "completed"
    status: { type: String, default: "not-started" },
    // Last time this chapter status was updated
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProgressSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    // Array of chapter statuses. For non-bundled courses this may remain empty and overallStatus used instead.
    statuses: { type: [ChapterStatusSchema], default: [] },
    // Overall status for courses without chapters. Values are arbitrary strings but typically follow
    // the same pattern as chapter statuses: "not-started", "complete-1", "complete-2", "completed".
    overallStatus: { type: String, default: "not-started" },
    // URL of an issued certificate (e.g. Cloudinary URL or signed download link). Optional.
    certificateUrl: { type: String, default: null },
    // Who created this progress record
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Who last updated this progress record
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Ensure one progress record per student/course/org combination
ProgressSchema.index({ studentId: 1, courseId: 1, orgId: 1 }, { unique: true });

export default mongoose.models.Progress || mongoose.model("Progress", ProgressSchema);