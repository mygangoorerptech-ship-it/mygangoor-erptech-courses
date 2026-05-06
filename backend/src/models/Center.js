// backend/src/models/Center.js
import mongoose from "mongoose";

const CenterSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  location: { type: String, trim: true },
  region:   { type: String, trim: true },
  address:  { type: String, trim: true },
  orgId:    { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  status:   { type: String, enum: ["active", "inactive"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

CenterSchema.index({ orgId: 1, status: 1 });

export default mongoose.models.Center ?? mongoose.model("Center", CenterSchema);
