// backend/src/models/Payout.js
//
// Payout model represents a settlement transaction from the platform (superadmin)
// to an organisation. When a payout is created the associated Payment records
// are marked as settled. Each payout records the organisation it belongs to,
// the list of paymentIds included, the totalAmount in paise, the status of
// the payout and optional metadata such as payout method and reference.

import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    paymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    totalAmount: { type: Number, required: true }, // paise
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    method: { type: String, enum: ["manual", "razorpay"], default: "manual" },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Payout ?? mongoose.model("Payout", PayoutSchema);