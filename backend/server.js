// backend/server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import authRoutes from "./src/routes/auth.js";
import { connectMongo } from "./src/config/mongo.js";
import userRoutes from "./src/routes/users.js";
import { verifyMailer } from "./src/utils/email.js";
import organizationsRouter from "./src/routes/organizations.js";
import saUsersRoutes from "./src/routes/saUsers.js";
import adUsersRoutes from "./src/routes/adUsers.js";

const app = express();

// Strict CORS allowlist (comma-separated)
let allow = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// In dev, default to localhost Vite origins if not explicitly set
if (!allow.length && process.env.NODE_ENV !== "production") {
  allow = ["http://localhost:5173", "https://localhost:5173"];
}

app.use(
  cors({
    origin(origin, cb) {
      // With credentials:true, never reflect arbitrary origins.
      if (!origin) return cb(null, false); // block unknown/non-browser origins
      return cb(null, allow.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Security headers
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
// --- Rate limiting on auth endpoints ---
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // max per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per 15m per IP
});
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/mfa", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/totp", otpLimiter);
app.use("/api/auth/refresh", authLimiter);
// Add CSP with nonces when you’re ready

// HSTS (HTTPS-only)
app.use((req, res, next) => {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  next();
});

// Needed when behind Vite proxy/CDN to set Secure cookies correctly
if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV !== "production") {
  app.set("trust proxy", 1);
}

// CSRF: issue a readable cookie and require matching header on unsafe methods
app.get("/csrf", (req, res) => {
  const viaHttps =
    req?.secure === true ||
    (req?.headers?.["x-forwarded-proto"] || "").toString().includes("https");
  const name = viaHttps ? "__Host-csrf" : "csrf";
  const token = Buffer.from(crypto.randomBytes(32)).toString("base64url");
  res.cookie(name, token, {
    httpOnly: false, // must be readable by frontend JS
    secure: viaHttps,
    sameSite: process.env.CROSS_SITE === "1" ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 1000, // 1h
  });
  res.json({ token });
});

// Allow these paths without CSRF (adjust to your routes)
const CSRF_EXEMPT = [
  "/csrf",
  "/api/auth/login",
  "/api/auth/mfa",
  "/api/auth/mfa/send",
  "/api/auth/mfa/verify",
  "/api/auth/totp/setup",
  "/api/auth/totp/verify",
  "/api/auth/resend-otp",
  "/api/auth/accept-invite",
  "/api/auth/refresh",
  "/api/auth/logout",
];

app.use((req, res, next) => {
  // Always let preflight through
  if (req.method === "OPTIONS") return next();

  // Only gate unsafe methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

  // Exempt selected auth endpoints
  const path = req.path;
  if (CSRF_EXEMPT.some((p) => path === p || path.startsWith(p))) return next();

  const hdr = req.get("X-CSRF-Token");
  const cookie =
    req.cookies?.["__Host-csrf"] || req.cookies?.["csrf"]; // accept dev or prod name
  if (!hdr || !cookie || hdr !== cookie) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
});

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api/organizations", organizationsRouter);
app.use("/api/sa/users", saUsersRoutes);
app.use("/api/ad/users", adUsersRoutes);

const PORT = process.env.PORT || 5002;

connectMongo()
  .then(() => {
    app.listen(PORT, () => console.log("Server running on", PORT));
  })
  .catch((err) => {
    console.error("[mongo] connection error:", err);
    process.exit(1);
  });
