//src/utils/ids.js
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

export function toId(value) {
  if (!value) return null;

  // already ObjectId
  if (value instanceof ObjectId) {
    return value;
  }

  // populated mongoose doc/object
  if (typeof value === "object" && value._id) {
    value = value._id;
  }

  // validate string/objectid
  if (!mongoose.isValidObjectId(value)) {
    return null;
  }

  return new ObjectId(String(value));
}