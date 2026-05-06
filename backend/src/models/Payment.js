//backend/src/models/Payment.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  type: { type: String, enum: ["online", "offline"], default: "offline" },
  method: { type: String, enum: ["razorpay", "stripe", "upi", "cash", "other"], default: "upi" },

  // lifecycle:
  // online: pending (order created) → captured → refunded/failed
  // lifecycle:
  // online:
  // pending -> captured -> refunded/failed
  //
  // offline:
  // pending_verification -> captured -> refunded/rejected
  status: {
    type: String,
    enum: [
      "pending",
      "pending_verification",
      "captured",
      "failed",
      "refunded",
      "rejected"
    ],
    default: "pending_verification",
    index: true,
  },

  createdSource: {
    type: String,
    enum: [
      "student_claim",
      "admin_manual",
      "teacher_manual",
      "online_gateway",
    ],
    default: "student_claim",
    index: true,
  },

  amount: { type: Number, required: true }, // paise
  currency: { type: String, default: "INR" },

  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: false,
    default: null,
  },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  receiptNo: { type: String, trim: true },
  referenceId: { type: String, trim: true },
  notes: { type: String, trim: true },

  provider: { type: String, trim: true },
  providerOrderId: { type: String, trim: true },
  providerPaymentId: { type: String, trim: true },
  providerSignature: { type: String, trim: true },
  webhookEventId: { type: String, trim: true },
  providerVerified: { type: Boolean, default: false },
  providerMethod: { type: String, trim: true },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt: { type: Date, default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  settled: { type: Boolean, default: false },
  // C-2 fix: enrollment recovery flags.
  // Set to true when ensureEnrollment() fails after payment capture.
  // Cleared by enrollmentRecoveryJob once enrollment is confirmed.
  needsEnrollment: { type: Boolean, default: false, index: true },
  enrollmentRetryCount: { type: Number, default: 0 },
  lastEnrollmentRetryAt: {
    type: Date,
    default: null,
  },

  lastEnrollmentError: {
    type: String,
    default: null,
  },
  // reconciliation
  reconciliationStatus: {
    type: String,
    enum: ["none", "matched", "manual"],
    default: "none",
    index: true,
  },

  matchedPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    default: null,
  },

  matchedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

PaymentSchema.index({ orgId: 1, courseId: 1, studentId: 1 });
PaymentSchema.index({ providerOrderId: 1 }, { unique: false });
PaymentSchema.index({ providerPaymentId: 1 }, { unique: false });
PaymentSchema.index(
  { providerOrderId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "captured" } }
);
PaymentSchema.index({ providerOrderId: 1, createdAt: -1 });
// PERF: standalone studentId — enables Payment.find({studentId}) IXSCAN
// (existing compound {orgId,courseId,studentId} requires orgId as lead key)
PaymentSchema.index({ studentId: 1 }, { name: "studentId_1" });
// PERF: webhookEventId — enables idempotency guard (Payment.exists) IXSCAN
PaymentSchema.index({ webhookEventId: 1 }, { name: "webhookEventId_1", sparse: true });
PaymentSchema.index({ courseId: 1, studentId: 1 });
PaymentSchema.index({
  needsEnrollment: 1,
  enrollmentRetryCount: 1,
  updatedAt: 1,
});

PaymentSchema.index({
  reconciliationStatus: 1,
  matchedAt: -1,
});

PaymentSchema.index({
  receiptNo: 1,
  referenceId: 1,
  amount: 1,
  courseId: 1,
  studentId: 1,
});

export default mongoose.models.Payment ?? mongoose.model("Payment", PaymentSchema);