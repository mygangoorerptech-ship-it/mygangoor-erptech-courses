// backend/server.js
import "./src/config/env.js";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
import { requireAuthNoRole, requireAuth } from "./src/middleware/authz.js";
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
import publicRoutes from "./src/routes/public.js";
import publicContactRoutes from "./src/routes/publicContact.js";
import adminReviewRouter from "./src/routes/adminReviewsRoutes.js";
import notesRouter from "./src/routes/notes.js";
import studentNotesRouter from "./src/routes/studentNotes.js";
import contactMessagesRouter from "./src/routes/contactMessages.js";
import teacherRouter from "./src/routes/teacher.js";
import centersRouter from "./src/routes/centers.js";


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

// Log CORS configuration on startup (helpful for debugging)
if (process.env.NODE_ENV === "production") {
  console.log("[cors] Configured allowed origins:", allow.length > 0 ? allow.join(", ") : "⚠️ NONE - CORS will reject all requests! Set CORS_ORIGIN env var.");
}

const corsOptions = {
origin(origin, cb) {
  /**
   * Allow requests without Origin header.
   *
   * Needed for:
   * - browser-managed credential flows
   * - EventSource / SSE
   * - same-origin internal requests
   * - health checks
   * - Render internal probes
   * - curl / server-to-server requests
   *
   * Rejecting these causes missing CORS headers and
   * breaks cookie persistence in production.
   */
  if (!origin) {
    return cb(null, true);
  }

  const isAllowed = allow.includes(origin);

  if (!isAllowed && process.env.NODE_ENV === "production" && process.env.DEBUG_CORS === "1") {
    console.warn(
      `[cors] Origin "${origin}" not in allowlist. Allowed: [${allow.join(", ")}]`
    );
  }

  return cb(null, isAllowed);
},
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With", "If-None-Match", "Cache-Control"],
  exposedHeaders: ["ETag", "X-Data-Version"],
  maxAge: 86400, // cache preflight for 24 h — reduces OPTIONS round-trips on every nav
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

// Apply CORS to all routes (this already handles OPTIONS preflight requests)
app.use(cors(corsOptions));

// Vary: Origin ensures CDN/proxy caches keep per-origin copies.
// Access-Control-Expose-Headers is set once via corsOptions above — no duplicate here.
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});


// 🔐 Razorpay webhook requires RAW body (do this before json())
app.post("/api/checkout/razorpay/webhook", express.raw({ type: "application/json" }), rzpCtrl.webhook);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Security headers — HSTS configured here via helmet (single source of truth).
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ── IPv6 normalisation helper ──────────────────────────────────────────────
// express-rate-limit v8 throws ERR_ERL_KEY_GEN_IPV6 when req.ip contains an
// IPv6-mapped IPv4 address (e.g. ::ffff:1.2.3.4) and no custom keyGenerator
// is provided. All limiters below use this helper to prevent that error.
function normalizeIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = fwd || String(req.ip || "anon");
  return raw.replace(/^::ffff:/i, ""); // strip IPv4-mapped IPv6 prefix
}

const safeKeyGenerator = (req) => {
  return ipKeyGenerator(req);
};

// --- Rate limiting on auth endpoints ---
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKeyGenerator,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKeyGenerator,
});
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKeyGenerator,
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/mfa", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/totp", otpLimiter);
app.use("/api/auth/refresh", authLimiter);
// M-1 fix: rate-limit endpoints that were missing protection.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKeyGenerator,
  message: { ok: false, message: "Too many requests, please try again later." },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeKeyGenerator,
  message: { ok: false, message: "Too many requests, please try again later." },
});
app.use("/api/auth/forgot-password", forgotLimiter);
app.use("/api/auth/precheck",        forgotLimiter);
app.use("/api/auth/signup",          signupLimiter);
app.use("/api/auth/signup-student",  signupLimiter);
// NOTE: settingsLimiter and sessionLimiter are now applied at ROUTE level
// in src/routes/auth.js (after requireAuth so req.user is populated).

// Always enable trust proxy so req.secure correctly reflects the true protocol
// when the server sits behind Nginx, Cloudflare, or any reverse proxy.
// Required in production for stable __Host-* cookie name detection; safe in development too.
app.set("trust proxy", 1);

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
  "/api/public/contact",
  "/public/contact",
  "/api/auth/me/email/verify",
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

  // Prefer the full URL path (includes mount path like /api/public/*)
  // because req.path is only the "local" path under a mounted router.
  const fullPath = (req.originalUrl || req.path || "").split("?")[0];
  const localPath = (req.path || "").split("?")[0];
  const candidates = [fullPath, localPath].filter(Boolean);
  if (candidates.some((c) => CSRF_EXEMPT.some((p) => c === p || c.startsWith(p)))) return next();

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

app.use("/api/public", publicRoutes);
app.use("/api/public", publicContactRoutes);
app.use("/api/student-catalog", studentCatalogRouter);
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
app.use("/api/students", studentsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/sa/audit", saAuditRouter);
app.use("/api/enrollments", enrollmentsRouter);
// H-3 fix: debug routes are never accessible in production.
if (process.env.NODE_ENV !== "production") {
  app.use("/api/debug", debugRoutes);
  app.get("/api/debug/claims", requireAuthNoRole, (req, res) => {
    res.json({ ok: true, claims: req.user, cookies: Object.keys(req.cookies || {}) });
  });
}
app.use("/api/orders", ordersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/sa/payments", saPaymentsRouter);
app.use("/api/sa/reconciliation", saReconciliationRouter);
app.use("/api/sa/payouts", saPayoutsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/student/join", joinStateRouter);
app.use("/api/student/wishlist", studentWishlistRouter);
// ❌ DEPRECATED: replaced by organizations
// app.use("/api/centers", centersRouter);
app.use("/api/config", configRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/student/progress", studentProgressRouter);
const templatesCandidate1 = path.join(process.cwd(), "templates", "certificates");
const templatesCandidate2 = path.join(process.cwd(), "backend", "templates", "certificates");
const templatesDir = fs.existsSync(templatesCandidate1) ? templatesCandidate1 : templatesCandidate2;
app.use("/api/static/templates", express.static(templatesDir));
app.use("/api", certificatesRouter);
app.use("/api", notificationsRouter);
app.use("/api/admin", requireAuth, adminReviewRouter);
app.use("/api/admin", contactMessagesRouter);
app.use("/api/notes", notesRouter);
app.use("/api/student/notes", studentNotesRouter);
app.use("/api/teacher", teacherRouter);

// Serve HTML pages from html-pages folder (outside React)
// const htmlPagesDir = path.join(process.cwd(), "html-pages");
// if (fs.existsSync(htmlPagesDir)) {
//   // Serve static assets (CSS, JS, images) from html-pages/assets
//   // Serve from both /html-assets and /static/assets to maintain compatibility
//   app.use("/html-assets", express.static(path.join(htmlPagesDir, "assets")));
//   app.use("/static/assets", express.static(path.join(htmlPagesDir, "assets")));
  
//   // Serve other static files from html-pages root (like notification-bell-standalone.js)
//   app.use("/static", express.static(htmlPagesDir, {
//     // Only serve non-HTML files from root
//     setHeaders: (res, filePath) => {
//       if (path.extname(filePath) === '.html') {
//         res.setHeader('Content-Type', 'text/html');
//       }
//     }
//   }));
  
//   // Serve HTML files directly
//   app.get("/home", (req, res) => {
//     res.sendFile(path.join(htmlPagesDir, "home.html"));
//   });
  
//   app.get("/login.html", (req, res) => {
//     res.sendFile(path.join(htmlPagesDir, "login.html"));
//   });

//   // Canonicalize login URL: /login → /login.html (preserve querystring)
//   app.get("/login", (req, res) => {
//     const qs = req.originalUrl && req.originalUrl.includes("?")
//       ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
//       : "";
//     return res.redirect(302, `/login.html${qs}`);
//   });
  
//   // Serve any other HTML files from html-pages
//   app.get("/*.html", (req, res, next) => {
//     const htmlFile = path.join(htmlPagesDir, req.path);
//     if (fs.existsSync(htmlFile) && htmlFile.startsWith(htmlPagesDir)) {
//       res.sendFile(htmlFile);
//     } else {
//       next();
//     }
//   });
// }

// Serve React SPA build (if present) and provide history fallback for SPA routes
const spaDistDir = path.join(process.cwd(), "mygf", "dist");
if (fs.existsSync(spaDistDir)) {
  app.use(express.static(spaDistDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".mjs")) {
        res.setHeader("Content-Type", "application/javascript");
      }
    }
  }));

  app.get("*", (req, res, next) => {
    // Skip API and static asset paths
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/static") ||
      req.path.startsWith("/html-assets") ||
      req.path.endsWith(".html")
    ) {
      return next();
    }

    return res.sendFile(path.join(spaDistDir, "index.html"));
  });
}

// Global Express error handler — catches any unhandled errors thrown inside route handlers.
// Prevents requests from hanging indefinitely and returning a 504 at the Nginx layer.
// Must be registered AFTER all routes.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, next) => {
  console.error("[server] unhandled error:", err?.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5004;

// ── Startup safety checks ──────────────────────────────────────────────────
// Fail fast in production if critical secrets are missing or using defaults.
if (process.env.NODE_ENV === "production") {
  const mfaSecret = process.env.JWT_MFA_SECRET;
  if (!mfaSecret || mfaSecret === "your-strong-mfa-secret") {
    console.error("[FATAL] JWT_MFA_SECRET is missing or using the placeholder value. Set a strong unique secret in your Render environment variables.");
    process.exit(1);
  }
  if (process.env.CROSS_SITE !== "1") {
    console.warn("[warn] CROSS_SITE is not set to '1'. Auth cookies will use SameSite=Strict, which blocks all cross-site requests (Vercel → Render). Set CROSS_SITE=1 in Render environment variables.");
  }
}

connectMongo()
  .then(() => {
    app.listen(PORT, () => { 
      console.log("Server running on", PORT); 
      startScheduler();
      // Verify email service configuration on startup (non-blocking)
      // Don't await - let server start even if email verification fails
      verifyMailer().catch(err => {
        console.warn("[resend] Startup verification failed (non-blocking):", err?.message);
      });
    });
  })
  .catch((err) => {
    console.error("[mongo] connection error:", err);
    process.exit(1);
  });
