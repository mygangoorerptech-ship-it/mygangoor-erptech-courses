// backend/src/models/CourseAssignment.js
import mongoose from "mongoose";

const CourseAssignmentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Prevent duplicate assignments per course+center pair
CourseAssignmentSchema.index({ courseId: 1, centerId: 1 }, { unique: true });
CourseAssignmentSchema.index({ courseId: 1 });
CourseAssignmentSchema.index({ centerId: 1 });

export default mongoose.models.CourseAssignment ?? mongoose.model("CourseAssignment", CourseAssignmentSchema);
