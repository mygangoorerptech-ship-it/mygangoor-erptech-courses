//backend/src/models/Organization.js
import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },

    domain: { type: String, trim: true },
    contactName: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postal: { type: String, trim: true },
    notes: { type: String, trim: true },

    status: { type: String, enum: ["active", "inactive"], default: "active" },
    suspended: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Organization ??
  mongoose.model("Organization", OrganizationSchema);
