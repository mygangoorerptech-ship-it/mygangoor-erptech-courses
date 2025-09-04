// backend/src/models/Subscription.js
import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  // actors
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true, required: true },
  orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true, required: true },

  // provider metadata
  method:   { type: String, enum: ["manual","razorpay"], default: "manual" },
  providerSubscriptionId: { type: String, trim: true, default: null }, // rzp_sub_xxx
  providerCustomerId:     { type: String, trim: true, default: null },

  // billing window
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd:   { type: Date, default: null },
  renews: { type: Boolean, default: true },

  // status is intentionally minimal to match your UI
  status: { type: String, enum: ["paid","refunded","canceled"], default: "paid" },

  // helpful mirrors
  amount:   { type: Number, default: 0 }, // paise
  currency: { type: String, default: "INR" },

  // audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  canceledBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

SubscriptionSchema.index({ studentId:1, courseId:1, orgId:1 }, { unique: true });

export default mongoose.models.Subscription ?? mongoose.model("Subscription", SubscriptionSchema);
