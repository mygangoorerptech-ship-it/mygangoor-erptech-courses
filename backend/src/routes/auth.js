//backend/src/routes/auth.js
import { Router } from "express";
import * as ctrl from "../controllers/authController.js";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRecentAuth } from "../middleware/authz.js";

// ── Helper: safe IP key (IPv6-mapped IPv4 stripped) ───────────────────────
function _ipKey(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = fwd || String(req.ip || "anon");
  return raw.replace(/^::ffff:/i, "");
}

// ── Route-level limiters (applied AFTER requireAuth so req.user is populated) ─
// keyed by user ID when authenticated; falls back to normalized IP otherwise.
const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sub = req.user?.sub || req.user?._id;
    return sub ? `user:${sub}` : _ipKey(req);
  },
  message: { ok: false, message: "Too many requests, please try again later." },
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sub = req.user?.sub || req.user?._id;
    return sub ? `user:${sub}` : _ipKey(req);
  },
  message: { ok: false, message: "Too many requests, please try again later." },
});

const r = Router();

function authz(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
      );
      req.user = payload;
    } catch { }
  }
  next();
}

r.post("/auth/login", ctrl.login);
r.post("/auth/mfa/send", ctrl.resendOtp);
r.post("/auth/mfa/verify", ctrl.verifyMfa);
r.post("/auth/totp/setup", ctrl.totpSetup);
r.post("/auth/totp/verify", ctrl.totpVerify);
r.get("/auth/check", ctrl.check);
r.post("/auth/refresh", ctrl.refresh);
r.post("/auth/logout", ctrl.logout);

r.post("/auth/invitations", authz, ctrl.invite);
r.post("/invitations/accept", ctrl.acceptInvite);
r.get("/invitations/verify", ctrl.verifyInvitation);

r.get('/auth/precheck', ctrl.precheckEmail);
r.post('/auth/signup-student', ctrl.signupStudent);
r.post('/auth/signup', ctrl.signupStudent);
r.post('/auth/forgot-password', ctrl.forgotPassword);
r.post('/auth/reset-password', ctrl.resetPassword);

// ── Settings endpoints (authenticated) ──────────────────────────
// settingsLimiter runs AFTER requireAuth so req.user is populated and user-ID
// keying works correctly (previously applied via app.use before auth ran).
r.patch('/auth/me/password', requireAuth, settingsLimiter, requireRecentAuth, ctrl.changePassword);
r.post('/auth/me/email/request', requireAuth, settingsLimiter, requireRecentAuth, ctrl.requestEmailChange);
// Email verification: public endpoint, token-gated
r.get('/auth/me/email/verify', ctrl.verifyEmailChange);

// 2FA self-service
r.get('/auth/me/2fa/setup', requireAuth, ctrl.selfTotpSetup);
r.post('/auth/me/2fa/enable', requireAuth, settingsLimiter, ctrl.selfTotpEnable);
r.post('/auth/me/2fa/disable', requireAuth, settingsLimiter, requireRecentAuth, ctrl.selfTotpDisable);

// ── Session management endpoints (authenticated) ─────────────────
// sessionLimiter runs AFTER requireAuth for the same reason as settingsLimiter.
r.get('/auth/me/sessions', requireAuth, sessionLimiter, ctrl.listSessions);
r.delete('/auth/me/sessions/:id', requireAuth, sessionLimiter, ctrl.revokeSession);
r.post('/auth/me/sessions/revoke-others', requireAuth, sessionLimiter, ctrl.revokeOtherSessions);

export default r;
