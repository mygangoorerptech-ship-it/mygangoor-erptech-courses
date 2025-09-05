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
import assessmentsRoutes from "./src/routes/assessments.js";
import assessmentGroupRoutes from "./src/routes/assessmentGroups.js";
import saCoursesRoutes from "./src/routes/saCourses.js";
import coursesRoutes from "./src/routes/courses.js";
import enrollmentsRouter from "./src/routes/enrollments.js";
import saAuditRouter  from "./src/routes/saAudit.js";
import paymentsRouter from "./src/routes/payments.js";
import studentsRouter from "./src/routes/students.js";
import auditRouter    from "./src/routes/audit.js";
import debugRoutes from "./src/routes/debug.js";
import { requireAuthNoRole } from "./src/middleware/authz.js";
import studentCatalogRouter from "./src/routes/studentCatalog.js";
import razorpayRouter from "./src/routes/razorpay.js";
import courseReviewsRouter from "./src/routes/courseReviewsRoute.js";
import * as rzpCtrl from "./src/controllers/razorpayController.js";
import studentPaymentsRouter from "./src/routes/studentPayments.js";
import studentEnrollmentsRouter from "./src/routes/studentEnrollments.js";
import ordersRouter from "./src/routes/orders.js";
import subscriptionsRouter from "./src/routes/subscriptions.js";
import saPaymentsRouter from "./src/routes/saPayments.js";
import saReconciliationRouter from "./src/routes/saReconciliation.js"; 
import saPayoutsRouter from "./src/routes/saPayouts.js";
import uploadsRouter from "./src/routes/uploads.js";
import joinStateRouter from "./src/routes/joinState.js";
import studentWishlistRouter from "./src/routes/studentWishlist.js";
import configRouter from "./src/routes/config.js";
import reportsRouter from "./src/routes/reports.js";
import studentProgressRouter from "./src/routes/studentProgress.js";
import certificatesRouter from "./src/routes/certificates.js";
import notificationsRouter from "./src/routes/notifications.js";
import { startScheduler } from "./src/utils/scheduler.js";
import path from "path";
import fs from "fs";

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

// 🔐 Razorpay webhook requires RAW body (do this before json())
app.post("/api/checkout/razorpay/webhook", express.raw({ type: "application/json" }), rzpCtrl.webhook);

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
  "/api/checkout/razorpay/webhook",
];

// Helper: detect "effectively https" when sitting behind a proxy
function looksHttps(req) {
  const xfwd = (req.headers["x-forwarded-proto"] || "").toString().toLowerCase();
  const origin = (req.headers["origin"] || "").toString().toLowerCase();
  const referer = (req.headers["referer"] || "").toString().toLowerCase();
  return req.secure || xfwd.includes("https") || origin.startsWith("https://") || referer.startsWith("https://");
}

// --- CSRF protection (double-submit; proxy/same-origin aware) ---
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

  const path = req.path || req.originalUrl || "";
  if (CSRF_EXEMPT.some((p) => path === p || path.startsWith(p))) return next();

  const headerTok = req.get("X-CSRF-Token") || "";
  const cookieTok = req.cookies?.["__Host-csrf"] || req.cookies?.["csrf"] || "";
  let ok = !!headerTok && !!cookieTok && headerTok === cookieTok;

  if (!ok) {
    const origin = req.get("Origin") || "";
    const referer = req.get("Referer") || "";

    // Reconstruct browser origin when behind dev proxy
    const xfProto = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost  = (req.get("x-forwarded-host")  || "").split(",")[0].trim();
    const xfOrigin = xfProto && xfHost ? `${xfProto}://${xfHost}` : "";

    const refOrigin = (() => {
      try { return new URL(referer).origin; } catch { return ""; }
    })();

    const allowedOrigins = allow; // already computed above
    const fromAllowed = [origin, refOrigin, xfOrigin].some(
      o => o && allowedOrigins.includes(o)
    );

    // If request is clearly same-origin (dev proxy or direct), accept header-only
    if (headerTok && fromAllowed) ok = true;

    // Optional debug (enable temporarily if needed):
    if (!ok) console.warn('[csrf] reject', { path: req.originalUrl, origin, refOrigin, xfOrigin, hasHeader: !!headerTok, hasCookie: !!cookieTok });
  }

  if (!ok) return res.status(403).json({ error: "CSRF token invalid" });
  next();
});

// Issue the CSRF cookie (use __Host- prefix if effectively HTTPS)
app.get("/csrf", (req, res) => {
  const viaHttps = looksHttps(req);
  const name = viaHttps ? "__Host-csrf" : "csrf";
  const token = Buffer.from(crypto.randomBytes(32)).toString("base64url");
  res.cookie(name, token, {
    httpOnly: false,
    secure: viaHttps,
    sameSite: process.env.CROSS_SITE === "1" ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 1000,
  });
  res.json({ token });
});

// --- DEV request tracer for /api/student/* ---
const DEBUG_STUDENT = process.env.DEBUG_STUDENT === "1";
if (DEBUG_STUDENT) {
  app.use("/api/student", (req, res, next) => {
    const started = Date.now();
    const safeCookieKeys = Object.keys(req.cookies || {});
    const hdrOrigin = req.headers?.origin;
    const hdrReferer = req.headers?.referer;
    console.groupCollapsed(`[api-student] ${req.method} ${req.originalUrl}`);
    console.log("origin:", hdrOrigin);
    console.log("referer:", hdrReferer);
    console.log("cookie keys:", safeCookieKeys);
    console.log("ip:", req.ip);
    console.groupEnd();

    res.on("finish", () => {
      const ms = Date.now() - started;
      console.log(`[api-student] ← ${res.statusCode} ${req.method} ${req.originalUrl} (${ms}ms)`);
    });
    next();
  });
}

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api/organizations", organizationsRouter);
app.use("/api/sa/users", saUsersRoutes);
app.use("/api/ad/users", adUsersRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api", assessmentGroupRoutes);
app.use('/api/sa/courses', saCoursesRoutes);
app.use('/api/courses', courseReviewsRouter);
app.use('/api/courses', coursesRoutes);
app.use("/api/payments", paymentsRouter);
app.use("/api/student/payments", studentPaymentsRouter);
app.use("/api/student/enrollments", studentEnrollmentsRouter);
app.use("/api/checkout/razorpay", razorpayRouter);
app.get("/api/debug/claims", (req, res, next) => next());
app.use("/api/student-catalog", studentCatalogRouter);
app.use("/api/students", studentsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/sa/audit", saAuditRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/debug", debugRoutes);
app.get("/api/debug/claims", requireAuthNoRole, (req, res) => {
  res.json({ ok: true, claims: req.user, cookies: Object.keys(req.cookies || {}) });
});
app.use("/api/orders", ordersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/sa/payments", saPaymentsRouter);
app.use("/api/sa/reconciliation", saReconciliationRouter);
app.use("/api/sa/payouts", saPayoutsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/student/join", joinStateRouter);
app.use("/api/student/wishlist", studentWishlistRouter);
app.use("/api/config", configRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/student/progress", studentProgressRouter);
const templatesCandidate1 = path.join(process.cwd(), "templates", "certificates");
const templatesCandidate2 = path.join(process.cwd(), "backend", "templates", "certificates");
const templatesDir = fs.existsSync(templatesCandidate1) ? templatesCandidate1 : templatesCandidate2;
app.use("/api/static/templates", express.static(templatesDir));
app.use("/api", certificatesRouter);
app.use("/api", notificationsRouter);

const PORT = process.env.PORT || 5002;

connectMongo()
  .then(() => {
    app.listen(PORT, () => { console.log("Server running on", PORT); startScheduler(); });
  })
  .catch((err) => {
    console.error("[mongo] connection error:", err);
    process.exit(1);
  });
