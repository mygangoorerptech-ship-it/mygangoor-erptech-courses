//backend/src/models/Enrollment.js
import mongoose from "mongoose";

const EnrollmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true, required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: false, default: null },
  status: { type: String, enum: ["free", "premium", "trial", "revoked"], default: "premium" },
  source: {
    type: String,
    enum: ["online", "offline", "admin", "teacher"],
    default: "offline"
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // teacher’s admin
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

EnrollmentSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true }
);

export default mongoose.models.Enrollment ?? mongoose.model("Enrollment", EnrollmentSchema);
