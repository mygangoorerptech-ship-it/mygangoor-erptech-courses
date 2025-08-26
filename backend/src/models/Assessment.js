//backend/src/models/Assessment.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const QUESTION_TYPES = ["mcq", "puzzle", "truefalse"];

const QuestionSchema = new Schema(
  {
    type: { type: String, enum: QUESTION_TYPES, required: true },
    text: { type: String, required: true, trim: true },
    options: [{ type: String, trim: true }],
    answer: { type: Schema.Types.Mixed, required: true },
    points: { type: Number, default: 1, min: 0 },
    explanation: { type: String, default: "" },
  },
  { _id: true }
);

const AssessmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    isActive: { type: Boolean, default: true, index: true },
    questions: {
      type: [QuestionSchema],
      validate: { validator: (arr) => !arr || arr.length <= 20, message: "An assessment can have at most 20 questions." },
      default: [],
    },
    groupId: { type: Schema.Types.ObjectId, ref: "AssessmentGroup", default: null, index: true },
    group: { type: String, default: "", index: true },
    groupOrder: { type: Number, default: null },
    openAt: { type: Date, default: null },
    closeAt: { type: Date, default: null },
    timeLimitSeconds: { type: Number, default: null, min: 30 },
    maxAttempts: { type: Number, default: 1, min: 1 },
    timeLimitMin: { type: Number, default: 0 },
    passingScore: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

AssessmentSchema.pre("validate", function (next) {
  if (this.openAt && this.closeAt && this.openAt > this.closeAt) {
    return next(new Error("openAt must be before closeAt"));
  }
  next();
});

AssessmentSchema.index({ orgId: 1, status: 1, createdAt: -1 });
AssessmentSchema.index({ title: "text", description: "text" });

export default mongoose.model("Assessment", AssessmentSchema);
