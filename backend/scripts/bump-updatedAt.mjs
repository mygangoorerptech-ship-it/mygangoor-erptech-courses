import mongoose from "mongoose";
import "dotenv/config";
import Progress from "../src/models/Progress.js";

await mongoose.connect(process.env.MONGO_URL);

const id = "68b71e82235e6d70de63bbe9"; // progress id
const when = new Date("2025-08-30T12:00:00Z");

const r = await Progress.updateOne({ _id: id }, { $set: { updatedAt: when } });
console.log("matched:", r.matchedCount, "modified:", r.modifiedCount);

await mongoose.disconnect();
