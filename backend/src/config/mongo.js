// backend/src/config/mongo.js  (ESM)
import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

function sanitize(uri) {
  try {
    const u = new URL(uri);
    if (u.username) u.username = "***";
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<hidden>";
  }
}

export async function connectMongo() {
  const uri = env("MONGO_URL");
  if (!uri) throw new Error("Missing MONGO_URL in .env");
  if (connected) return mongoose.connection;

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName: env("MONGO_DB") || undefined });

  connected = true;
  console.log("[mongo] connected ->", mongoose.connection.name, "(" + sanitize(uri) + ")");
  return mongoose.connection;
}

export async function disconnectMongo() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log("[mongo] disconnected");
}
