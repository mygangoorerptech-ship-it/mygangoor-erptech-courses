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
  await mongoose.connect(uri, {
    dbName: env("MONGO_DB") || undefined,

    // Rebuild schema indexes automatically
    autoIndex: true,

    // Fail fast (5 s) instead of the 30 s driver default
    serverSelectionTimeoutMS: 5_000,

    // Abort stalled socket operations
    socketTimeoutMS: 30_000,

    // Connection pool
    maxPoolSize: 50,
    minPoolSize: 5,

    // Detect failover quickly
    heartbeatFrequencyMS: 10_000,

    // Prevent indefinite queue hangs
    waitQueueTimeoutMS: 5_000,
  });

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
