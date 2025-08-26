//backend/src/models/AssessmentGroup.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AssessmentGroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ["global", "org"], default: "org", index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AssessmentGroupSchema.pre("validate", function (next) {
  if (this.scope === "org" && !this.orgId) {
    return next(new Error("orgId is required for org-scoped assessment groups"));
  }
  next();
});

AssessmentGroupSchema.index({ scope: 1, orgId: 1, name: 1 }, { unique: true });

export default mongoose.model("AssessmentGroup", AssessmentGroupSchema);
