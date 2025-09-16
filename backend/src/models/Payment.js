//backend/src/models/Payment.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  type: { type: String, enum: ["online", "offline"], default: "offline" },
  method: { type: String, enum: ["razorpay","stripe","upi","cash","other"], default: "upi" },

    // lifecycle:
    // online: pending (order created) → captured → refunded/failed
    // offline variants: submitted (awaiting verification) / claimed (student self-claim) → captured (verified by admin) → refunded/rejected
    status: {
      type: String,
      enum: ["pending", "submitted", "claimed", "captured", "failed", "refunded", "rejected", "verified"],
      default: "submitted",
      index: true,
    },

  amount: { type: Number, required: true }, // paise
  currency: { type: String, default: "INR" },

  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
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
  providerMethod:   { type: String, trim: true },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt:  { type: Date, default: null },
  managerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  settled: { type: Boolean, default: false },
}, { timestamps: true });

PaymentSchema.index({ orgId: 1, courseId: 1, studentId: 1 });
PaymentSchema.index({ providerOrderId: 1 }, { unique: false });
PaymentSchema.index({ providerPaymentId: 1 }, { unique: false });

export default mongoose.models.Payment ?? mongoose.model("Payment", PaymentSchema);