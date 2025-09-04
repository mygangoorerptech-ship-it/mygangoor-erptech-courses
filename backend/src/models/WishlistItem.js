// backend/src/models/WishlistItem.js
import mongoose from "mongoose";

const WishlistItemSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
}, { timestamps: true });

WishlistItemSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.models.WishlistItem ?? mongoose.model("WishlistItem", WishlistItemSchema);
