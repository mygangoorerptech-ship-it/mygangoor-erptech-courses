//src/models/StudentFormProfile.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const StudentFormProfileSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName:  { type: String, default: "" },
    age:       { type: Number },
    gender:    { type: String, enum: ["Male", "Female", "Other"] },
    birth:     { type: String, default: "" },
    address:   { type: String, default: "" },
    mobile:    { type: String, default: "" },
    email:     { type: String, default: "" },
    source:    { type: String, default: "enrollment" },
    photoUrl:  { type: String, default: "" },
  },
  { timestamps: true }
);

export default model("StudentFormProfile", StudentFormProfileSchema);
