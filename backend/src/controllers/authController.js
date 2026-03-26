// backend/src/controllers/authController.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { encryptTotpSecret, decryptTotpSecret } from "../utils/mfaCrypto.js";

import { setAuthCookies, clearAuthCookies } from "../utils/cookies.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { sendOtpEmail, sendInvitationEmail, sendPasswordResetEmail, sendEmailChangeVerification, sendSuspiciousLoginAlert } from "../utils/email.js";
import AuditLog from "../models/AuditLog.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  signMfaTempToken,
  verifyMfaTempToken,
} from "../utils/jwt.js";

const hash = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

// RefreshToken model is now a standalone file — imported above.

const ACCESS_TTL = process.env.ACCESS_TTL || "1h"; // Increased to 1 hour for better UX
const REFRESH_TTL_SEC = parseInt(process.env.REFRESH_TTL_SEC || `${60 * 60 * 24 * 30}`, 10);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

function expFromNowSec(sec) {
  return new Date(Date.now() + sec * 1000);
}

// --- debug logger ---
const DEBUG_AUTH = process.env.DEBUG_AUTH === "1";

// H-2 fix: in-memory TOTP replay prevention.
// Tracks (userId + timeBucket + delta) combinations that have already been used.
// With window:1, valid delta values are -1, 0, or 1 (one 30-second step each side).
// Each entry auto-expires after 90 seconds (3 TOTP steps) via setTimeout.
// Safe for single-process deployments; for multi-instance, replace with Redis SET NX.
const _totpUsedKeys = new Map();

function _totpReplayKey(uid, delta) {
  // Bucket = current 30-second TOTP period. Ties the key to a specific time window.
  const bucket = Math.floor(Date.now() / 30_000);
  return `${uid}:${bucket}:${delta}`;
}

/** Returns true if this (uid, delta) combination was already consumed. */
function _isTotpReplay(uid, delta) {
  const key = _totpReplayKey(uid, delta);
  if (_totpUsedKeys.has(key)) return true;
  _totpUsedKeys.set(key, true);
  // Auto-remove after 90 s — long enough to cover the full ±30 s window plus drift.
  setTimeout(() => _totpUsedKeys.delete(key), 90_000);
  return false;
}
const alog = (...args) => {
  if (DEBUG_AUTH) console.log(new Date().toISOString(), "[auth]", ...args);
};

// ---------------------------------------------------------------------------
// PHASE 1: Deterministic refresh-cookie reader.
//
// The root cause of "jti-revoked" failures in production logs:
//   req.cookies["__Host-refresh"] || req.cookies.sr
// reads whichever name the browser sends first. If the browser holds BOTH
// (e.g., user moved between HTTP dev and HTTPS prod, or a previous session
// left a stale cookie), the WRONG — possibly already-rotated — token is
// used, its JTI is revoked in the DB, and the refresh fails.
//
// This helper mirrors the exact HTTPS detection in setAuthCookies() so that
// the cookie we READ is always the same cookie we WROTE.
// ---------------------------------------------------------------------------
function getActiveRefreshCookie(req) {
  // Mirrors cookies.js setAuthCookies — useHostPrefix = secure (HTTPS-only,
  // no isDev guard) so the cookie we READ always matches the one we WRITE.
  const viaHttps =
    req?.secure === true ||
    String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase().includes("https");
  const useHostPrefix = !!viaHttps; // same as `secure` in cookies.js
  return useHostPrefix
    ? req.cookies?.["__Host-refresh"]
    : req.cookies?.sr;
}

// Lightweight UA parser — no external dependency needed.
// Extracts a readable browser + OS label from a User-Agent string.
function parseUA(ua) {
  const s = String(ua || "");
  let browser = "Unknown";
  let os      = "Unknown";

  // Browser detection (order matters — Edge must come before Chrome)
  if (/Edg\//i.test(s))            browser = "Edge";
  else if (/OPR\//i.test(s))       browser = "Opera";
  else if (/Chrome\//i.test(s))    browser = "Chrome";
  else if (/Firefox\//i.test(s))   browser = "Firefox";
  else if (/Safari\//i.test(s))    browser = "Safari";
  else if (/MSIE|Trident/i.test(s)) browser = "IE";

  // OS detection
  if (/Windows NT/i.test(s))       os = "Windows";
  else if (/Android/i.test(s))     os = "Android";
  else if (/iPhone|iPad/i.test(s)) os = "iOS";
  else if (/Mac OS X/i.test(s))    os = "macOS";
  else if (/Linux/i.test(s))       os = "Linux";

  return { browser, os, userAgent: s };
}

async function saveRefresh(userId, jti, exp, ua, ip) {
  await RefreshToken.create({
    userId,
    jti,
    exp,
    device: ua,          // raw UA string kept in device for backward compat
    ip:    ip || null,
    lastUsedAt: new Date(),
  });
}

async function revokeRefresh(jti, replacedBy) {
  await RefreshToken.updateOne(
    { jti },
    { $set: { revokedAt: new Date(), replacedBy, isRevoked: true } }
  );
}

async function findRefresh(jti) {
  return RefreshToken.findOne({ jti });
}

// ✅ Robust to Mongoose docs (.id) and lean objects (._id)
function mintTokens(user, device) {
  const uid = String(user?._id ?? user?.id ?? "");
  if (!uid) {
    throw new Error("mintTokens: missing uid (_id/id)");
  }

  const role = user?.role ?? (Array.isArray(user?.roles) ? user.roles[0] : null);
  const orgIdRaw = user?.orgId ?? user?.org?._id ?? null;
  const orgId = orgIdRaw ? String(orgIdRaw) : null;

  const jti = crypto.randomUUID();
  const refresh = jwt.sign({ sub: uid, jti }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SEC,
  });
  const payload = {
    sub: uid,
    role,
    roles: role ? [role] : [],
    orgId,
    jti,
  };
  const access = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
  const refreshExp = expFromNowSec(REFRESH_TTL_SEC);

  alog("[mintTokens] issue tokens", {
    uid,
    jti,
    accessTtl: ACCESS_TTL,
    refreshExp: refreshExp?.toISOString?.(),
    ua: device,
  });

  return { access, refresh, jti, refreshExp, device };
}

// If a verified student belongs to an org, store them as 'orguser' for ACLs.
function normalizeRoleWhenVerified(user) {
  if (!user) return false;
  const shouldFlip = !!user.isVerified && user.role === "student" && !!user.orgId;
  if (shouldFlip) {
    user.role = "orguser";
    return true;
  }
  return false;
}

// ===== Controllers =====
export async function login(req, res) {
  try {
    const { email, password, as } = req.body;
    const ua  = req.get("User-Agent") || "unknown";
    const ip  = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    if (as && user.role !== as) {
      return res.status(403).json({ ok: false, message: "Role mismatch" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ ok: false, message: "Account disabled" });
    }

    // Suspicious login detection: run after credential verification for all paths
    await detectSuspiciousLogin(user, ua, ip, req);

    if (user.mfa?.required) {
      const method = user.mfa.method || "otp";
      const mfaTempToken = signMfaTempToken({ uid: user.id, method, email: user.email });
      if (method === "otp") {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        user.mfa.emailOtp = {
          codeHash: hash(code),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          lastSentAt: new Date(),
          attempts: 0,
        };
        await user.save();
        await sendOtpEmail(user.email, code);
      }
      return res.json({ ok: true, mfa: { required: true, method }, mfaTempToken });
    }

    // ✅ No-MFA path: first successful password login marks the account verified
    let changed = false;
    if (!user.isVerified) {
      user.isVerified = true;
      changed = true;
    }
    if (normalizeRoleWhenVerified(user)) changed = true;
    if (changed) await user.save();

    const { access, refresh, jti, refreshExp } = mintTokens(user, ua);
    await saveRefresh(user.id, jti, refreshExp, ua, ip);
    setAuthCookies(req, res, { accessToken: access, refreshToken: refresh });
    writeAudit(user._id, "login", req);
    // Tokens are in HttpOnly cookies only — never expose in JSON body (XSS risk)
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("[auth] login error:", err?.message);
    return res.status(503).json({ ok: false, message: "Service temporarily unavailable" });
  }
}

export async function resendOtp(req, res) {
  const { mfaTempToken } = req.body;
  try {
    const { uid } = verifyMfaTempToken(mfaTempToken);
    const user = await User.findById(uid);
    if (!user) return res.status(400).json({ ok: false });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.mfa.emailOtp = {
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      lastSentAt: new Date(),
      attempts: user.mfa.emailOtp?.attempts || 0,
    };
    await user.save();
    await sendOtpEmail(user.email, code);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false });
  }
}

export async function verifyMfa(req, res) {
  const { code, method, mfaTempToken } = req.body;
  try {
    const { uid } = verifyMfaTempToken(mfaTempToken);
    const user = await User.findById(uid);
    if (!user) return res.status(400).json({ ok: false, message: "Session expired" });

    if (method === "otp") {
      const otp = user.mfa?.emailOtp;
      if (!otp || !otp.expiresAt || otp.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ ok: false, message: "Code expired" });
      }
      const attempts = Number(otp.attempts || 0);
      if (attempts >= 5) {
        return res
          .status(429)
          .json({ ok: false, message: "Too many attempts. Please request a new code." });
      }
      const valid = otp.codeHash && otp.codeHash === hash(code);
      if (!valid) {
        user.mfa.emailOtp = { ...otp, attempts: attempts + 1 };
        await user.save();
        return res.status(400).json({ ok: false, message: "Invalid code" });
      }
user.mfa.emailOtp = null;
let changed = false;
if (!user.isVerified) { user.isVerified = true; changed = true; }
if (normalizeRoleWhenVerified(user)) changed = true;
if (changed) await user.save();

    } else if (method === "totp") {
      const secretEnc = user.mfa?.totpSecretEnc;
      const legacySecret = user.mfa?.totpSecretHash || null;
      if (!secretEnc && !legacySecret) {
        return res.status(400).json({ ok: false, message: "TOTP not set up" });
      }
      const tokenValidates = speakeasy.totp.verify({
        secret: secretEnc ? decryptTotpSecret(secretEnc) : legacySecret,
        encoding: "base32",
        token: code,
        window: 1,
      });
      if (!tokenValidates) return res.status(400).json({ ok: false, message: "Invalid code" });
let changed = false;
if (!user.isVerified) { user.isVerified = true; changed = true; }
if (normalizeRoleWhenVerified(user)) changed = true;
if (changed) await user.save();

    } else {
      return res.status(400).json({ ok: false, message: "Invalid method" });
    }

    const ua  = req.get("User-Agent") || "unknown";
    const ip  = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const { access, refresh, jti, refreshExp } = mintTokens(user, ua);
    await saveRefresh(user.id, jti, refreshExp, ua, ip);
    setAuthCookies(req, res, { accessToken: access, refreshToken: refresh });
    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(400).json({ ok: false, message: "Invalid or expired session" });
  }
}

export async function totpSetup(req, res) {
  const { mfaTempToken } = req.body;
  try {
    if (!mfaTempToken) {
      return res.status(400).json({ ok: false, message: "Missing MFA session token" });
    }
    const { uid } = verifyMfaTempToken(mfaTempToken);
    const user = await User.findById(uid);
    if (!user) return res.status(400).json({ ok: false, message: "Invalid or expired session" });

    if (!user.mfa || !user.mfa.required || user.mfa.method !== "totp") {
      return res.status(400).json({ ok: false, message: "TOTP not required for this account" });
    }

    // Create secret if not present; otherwise use existing (encrypted or legacy).
    const enc = user.mfa.totpSecretEnc;
    const hasValidEnc =
      !!(enc && typeof enc.iv === "string" && enc.iv &&
               typeof enc.ct === "string" && enc.ct &&
               typeof enc.tag === "string" && enc.tag);
    const hasHash = !!user.mfa.totpSecretHash;

    let base32Secret;
    if (!hasValidEnc && !hasHash) {
      // no usable secret -> generate
      const secret = speakeasy.generateSecret({ name: process.env.TOTP_ISSUER || "MyApp" });
      user.mfa.totpSecretEnc = encryptTotpSecret(secret.base32);
      user.mfa.totpSecretHash = undefined; // prefer encrypted storage
      await user.save();
      base32Secret = secret.base32;
    } else {
      try {
        base32Secret = hasHash
          ? user.mfa.totpSecretHash
          : decryptTotpSecret(user.mfa.totpSecretEnc);
      } catch (e) {
        // corrupted / legacy-bad -> self-heal by regenerating
        const secret = speakeasy.generateSecret({ name: process.env.TOTP_ISSUER || "MyApp" });
        user.mfa.totpSecretEnc = encryptTotpSecret(secret.base32);
        user.mfa.totpSecretHash = undefined;
        await user.save();
        base32Secret = secret.base32;
      }
    }

    const otpauth_url = speakeasy.otpauthURL({
      secret: base32Secret,
      encoding: "base32",
      label: user.email,
      issuer: process.env.TOTP_ISSUER || "MyApp",
      digits: 6,
      period: 30,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth_url);
    return res.json({ ok: true, otpauth_url, qrDataUrl });
  } catch {
    return res.status(400).json({ ok: false, message: "Invalid or expired session" });
  }
}

export async function totpVerify(req, res) {
  const { code, mfaTempToken } = req.body;
  try {
    if (!mfaTempToken) {
      return res.status(400).json({ ok: false, message: "Missing MFA session token" });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ ok: false, message: "Invalid code format" });
    }

    const { uid } = verifyMfaTempToken(mfaTempToken);
    const user = await User.findById(uid);
    if (!user) return res.status(400).json({ ok: false, message: "Invalid or expired session" });

    const secretEnc = user.mfa?.totpSecretEnc || null;
    const legacySecret = user.mfa?.totpSecretHash || null;
    if (!secretEnc && !legacySecret) {
      return res.status(400).json({ ok: false, message: "TOTP not setup" });
    }

    // H-2 fix: window reduced from 3 (180 s) to 1 (60 s — ±30 s either side).
    const result = speakeasy.totp.verifyDelta({
      secret: secretEnc ? decryptTotpSecret(secretEnc) : legacySecret,
      encoding: "base32",
      token: String(code),
      digits: 6,
      step: 30,
      window: 1,
    });

    if (!result) {
      if (process.env.DEBUG_MFA === "1") {
        console.log("[mfa] verify failed for", user.email, "code:", code);
      }
      return res.status(400).json({ ok: false, message: "Invalid code" });
    }

    // H-2 fix: reject replay — same (uid, delta, time-bucket) within 90 s.
    if (_isTotpReplay(String(user._id), result.delta)) {
      return res.status(400).json({ ok: false, message: "Code already used" });
    }

let changed = false;
if (!user.isVerified) { user.isVerified = true; changed = true; }
if (normalizeRoleWhenVerified(user)) changed = true;
if (changed) await user.save();


    const ua  = req.get("User-Agent") || "unknown";
    const ip  = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const { access, refresh, jti, refreshExp } = mintTokens(user, ua);
    await saveRefresh(user.id, jti, refreshExp, ua, ip);
    setAuthCookies(req, res, { accessToken: access, refreshToken: refresh });
    return res.json({ ok: true, user });
  } catch {
    return res.status(400).json({ ok: false, message: "Invalid or expired session" });
  }
}



export async function invite(req, res) {
  const actor = req.user || {};
  if (!actor || actor.role !== "superadmin") return res.status(403).json({ ok: false });
  const actorId = actor.sub || actor._id || actor.id || actor.uid || null;

  const { email, role, orgId, mfaRequired, mfaMethod, managerId } = req.body;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Invitation.create({
    email,
    role,
    orgId: orgId || null,
    mfaRequired: !!mfaRequired,
    mfaMethod: mfaRequired ? (mfaMethod || "otp") : null,
    managerId: managerId || null,
    tokenHash,
    expiresAt,
    invitedBy: actorId, // <— was actor.uid
  });

  const link = `${process.env.PUBLIC_APP_URL?.split(",")[0] || "http://localhost:5173"}/signup?invite=${token}`;
  await sendInvitationEmail(email, link);
  return res.json({ ok: true });
}

export async function acceptInvite(req, res) {
  const { token, name, password } = req.body;
  const tokenHash = hash(token);

  const inv = await Invitation.findOne({
    tokenHash,
    accepted: false,
    expiresAt: { $gt: new Date() },
  });
  if (!inv) return res.status(400).json({ ok: false, message: "Invalid or expired invitation" });

  // --- Normalize MFA policy from either style of stored fields ---
  const effMfaRequired =
    inv.mfaRequired ??
    (typeof inv.mfa?.required === "boolean" ? inv.mfa.required : undefined) ??
    false;

  const effMfaMethod =
    inv.mfaMethod ??
    (inv.mfa?.method ? String(inv.mfa.method) : null) ??
    null;

  const mfaPolicy = effMfaRequired
    ? { required: true, method: effMfaMethod || "otp", totpSecretHash: null, totpSecretEnc: undefined, emailOtp: null }
    : { required: false, method: null,               totpSecretHash: null, totpSecretEnc: undefined, emailOtp: null };

  // Students: verified after successful first login/MFA. If no MFA is required, verify now.
  const verifiedNow = !mfaPolicy.required;
  // Convert 'student' role to 'orguser' for database storage when orgId is present
  const roleFinal = (inv.role === "student" && inv.orgId) ? "orguser" : inv.role;

  // --- Create or update the user with ORG MEMBERSHIP from the invite ---
  const passwordHash = await bcrypt.hash(password, 12);

  let user = await User.findOne({ email: inv.email });
  if (!user) {
    user = await User.create({
      email: inv.email,
      name,
      passwordHash,
      role: roleFinal,
      status: "active",
      isVerified: verifiedNow,
      orgId: inv.orgId || null,           // <-- org membership
      invitedBy: inv.invitedBy || null,
      managerId: inv.managerId || null,
      mfa: mfaPolicy,
    });
  } else {
    user.name = name;
    user.passwordHash = passwordHash;
    user.role = roleFinal;
    user.orgId = inv.orgId || null;      // <-- ensure membership
    user.managerId = inv.managerId || null;
    user.mfa = mfaPolicy;
    user.isVerified = verifiedNow;
    await user.save();
  }

  // Mark invite consumed
  inv.accepted = true;
  await inv.save();

  // Don't auto-login - redirect to login page instead
  // The user should log in manually after setting their password
  return res.json({ 
    ok: true, 
    message: "Account created successfully. Please log in with your credentials.",
    user: {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    redirectTo: "/login",
  });
}

// GET /invitations/verify?token=xxx
// Verify invitation token and return invitation details (for frontend page)
export async function verifyInvitation(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ ok: false, message: "Invitation token is required" });
  }
  
  const tokenHash = hash(token);
  
  try {
    const inv = await Invitation.findOne({
      tokenHash,
      accepted: false,
      expiresAt: { $gt: new Date() },
    });
    
    if (!inv) {
      // Check if it's expired or already accepted
      const invExpired = await Invitation.findOne({ tokenHash });
      if (invExpired) {
        if (invExpired.accepted) {
          return res.status(400).json({ 
            ok: false, 
            message: "This invitation has already been used.",
            error: "INVITATION_ALREADY_USED",
          });
        }
        if (invExpired.expiresAt <= new Date()) {
          return res.status(400).json({ 
            ok: false, 
            message: "This invitation has expired. Please request a new invitation.",
            error: "INVITATION_EXPIRED",
            expiredAt: invExpired.expiresAt.toISOString(),
          });
        }
      }
      return res.status(400).json({ 
        ok: false, 
        message: "Invalid or expired invitation token.",
        error: "INVITATION_INVALID",
      });
    }
    
    // Return invitation details (without sensitive info)
    return res.json({
      ok: true,
      invitation: {
        email: inv.email,
        role: inv.role,
        mfaRequired: inv.mfaRequired || false,
        mfaMethod: inv.mfaMethod || null,
        expiresAt: inv.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[verifyInvitation] Error:", error);
    return res.status(500).json({ 
      ok: false, 
      message: "An error occurred while verifying the invitation.",
      error: "VERIFICATION_ERROR",
    });
  }
}

export async function check(req, res) {
  try {
    const header = req.headers.authorization || "";
    const accessCookie = req.cookies?.["__Host-session"] || req.cookies?.sid || null;
    const headerTok = header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = accessCookie || headerTok;

    // Return 200 for unauthenticated sessions to avoid noisy "Failed to load resource"
    // logs on public pages that call this endpoint only to decide UI state.
    // PHASE 7: return 401 (not 200) so the response status carries semantic
    // meaning. Frontend checkSession() uses validateStatus to handle this
    // without triggering the axios interceptor's refresh-retry cycle.
    if (!token) return res.status(401).json({ ok: false });

    try {
      const { sub: uid } = jwt.verify(token, JWT_ACCESS_SECRET);
      const user = await User.findById(uid);
      if (!user) return res.status(401).json({ ok: false });
      return res.json({ ok: true, user });
    } catch {
      // ✋ Do NOT rotate refresh here. Just say “not authorized”.
      return res.status(401).json({ ok: false });
    }
  } catch {
    return res.status(401).json({ ok: false });
  }
}

export async function refresh(req, res) {
  const started = Date.now();
  const rid = crypto.randomUUID();
  const ua = req.get("User-Agent") || "unknown";
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();

  try {
    const rt = getActiveRefreshCookie(req);
    const allCookies = Object.keys(req.cookies || {});
    alog("[refresh:start]", { 
      rid, 
      hasCookie: !!rt, 
      ip, 
      ua,
      cookieNames: allCookies,
      hostRefresh: !!req.cookies?.["__Host-refresh"],
      sr: !!req.cookies?.sr
    });

    if (!rt) {
      alog("[refresh:fail] no-cookie", { rid, availableCookies: allCookies });
      return res.status(401).json({ ok: false });
    }

    let payload;
    try {
      payload = jwt.verify(rt, JWT_REFRESH_SECRET);
    } catch (e) {
      alog("[refresh:jwt-verify-fail]", { rid, name: e?.name, msg: e?.message });
      return res.status(401).json({ ok: false });
    }

    const { sub: userId, jti: oldJti, exp } = payload || {};
    if (!userId || !oldJti) {
      alog("[refresh:fail] bad-payload", { rid, userId: !!userId, oldJti: !!oldJti });
      return res.status(401).json({ ok: false });
    }

    const expMs = exp ? exp * 1000 : null;
    if (expMs) {
      alog("[refresh:payload]", { rid, userId, oldJti, rtExpAt: new Date(expMs).toISOString() });
    }

    const dbTok = await findRefresh(oldJti);
    if (!dbTok) {
      alog("[refresh:fail] jti-not-found", { rid, oldJti });
      return res.status(401).json({ ok: false, message: "Refresh reuse detected" });
    }
    if (dbTok.revokedAt) {
      alog("[refresh:fail] jti-revoked", {
        rid,
        oldJti,
        revokedAt: dbTok.revokedAt?.toISOString?.(),
        replacedBy: dbTok.replacedBy || null,
      });
      return res.status(401).json({ ok: false, message: "Refresh reuse detected" });
    }

    const device = req.get("User-Agent") || dbTok.device || "unknown";
    // Update lastUsedAt on the token being consumed before rotating
    await RefreshToken.updateOne({ jti: oldJti }, { $set: { lastUsedAt: new Date() } });

    // Use full doc (not lean) — but mintTokens is robust either way
    const user = await User.findById(userId);
    if (!user) {
      alog("[refresh:fail] user-not-found", { rid, userId });
      return res.status(401).json({ ok: false });
    }

    const { access, refresh, jti, refreshExp } = mintTokens(user, device);
    await revokeRefresh(oldJti, jti);
    await saveRefresh(userId, jti, refreshExp, device, ip);

    setAuthCookies(req, res, { accessToken: access, refreshToken: refresh });

    alog("[refresh:rotate-ok]", {
      rid,
      userId,
      oldJti,
      newJti: jti,
      nextRtExpAt: refreshExp?.toISOString?.(),
      ms: Date.now() - started,
    });

    return res.json({ ok: true }); // token is in the rotated HttpOnly cookie only
  } catch (e) {
    alog("[refresh:exception]", {
      rid,
      name: e?.name,
      msg: e?.message,
      ms: Date.now() - started,
    });
    return res.status(401).json({ ok: false });
  }
}

export async function logout(req, res) {
  try {
    // Revoke whichever refresh cookie name is present
    const rt = getActiveRefreshCookie(req);
    if (rt) {
      try {
        const { jti, sub } = jwt.verify(rt, JWT_REFRESH_SECRET);
        if (jti) await revokeRefresh(jti, undefined);
        if (sub) writeAudit(sub, "logout", req);
      } catch {}
    }
  } finally {
    clearAuthCookies(res); // clears __Host-* and dev sid/sr with matching attributes
  }
  return res.json({ ok: true });
}

export async function precheckEmail(req, res) {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ message: 'email required' });

  const user = await User.findOne({ email });
  if (user) {
    // Account exists — do NOT reveal MFA configuration to unauthenticated callers
    return res.json({ mode: 'signin', reason: 'Account already exists' });
  }

  const inv = await Invitation.findOne({ email, expiresAt: { $gt: new Date() } });
  if (inv) {
    return res.json({ mode: 'signin', reason: 'You have a pending invitation' });
  }

  return res.json({ mode: 'signup' });
}

export async function signupStudent(req, res) {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    name: name || null,
    email: String(email).toLowerCase(),
    role: 'student',
    status: 'active',
    isVerified: true,
    mfa: { required: false, method: null }, // manual signup → no MFA by default
    passwordHash,
  });
  return res.json({ ok: true });
}

export async function resetPassword(req, res) {
  const started = Date.now();
  const rid = crypto.randomUUID();
  const ua = req.get("User-Agent") || "unknown";
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  
  alog("[resetPassword:start]", { rid, ip, ua });

  try {
    const { token, password, newPassword, email } = req.body || {};
    
    // Support both frontend formats: {token, password} or {token, newPassword, email}
    const resetToken = token;
    const resetPassword = password || newPassword;
    
    // Validate inputs
    if (!resetToken || typeof resetToken !== 'string' || !resetToken.trim()) {
      alog("[resetPassword:fail] missing-token", { rid, token: !!resetToken });
      return res.status(400).json({ ok: false, message: 'Reset token is required' });
    }

    if (!resetPassword || typeof resetPassword !== 'string' || resetPassword.length < 6) {
      alog("[resetPassword:fail] invalid-password", { rid, passwordLength: resetPassword?.length || 0 });
      return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters long' });
    }

    const tokenHash = hash(resetToken.trim());
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      alog("[resetPassword:fail] invalid-token", { rid, tokenHash: tokenHash.substring(0, 8) + '...' });
      return res.status(400).json({ ok: false, message: 'Invalid or expired reset token' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      alog("[resetPassword:fail] user-inactive]", { rid, email: user.email, status: user.status });
      return res.status(400).json({ ok: false, message: 'Account is disabled' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(resetPassword, 12);

    // Update user with new password and clear reset token
    user.passwordHash = passwordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Revoke all refresh tokens — force logout from all devices after password reset
    await RefreshToken.deleteMany({ userId: user._id });

    alog("[resetPassword:success]", { 
      rid, 
      email: user.email, 
      userId: user._id,
      ms: Date.now() - started
    });

    return res.json({ ok: true, message: 'Password has been reset successfully' });

  } catch (error) {
    alog("[resetPassword:exception]", {
      rid,
      name: error?.name,
      msg: error?.message,
      stack: error?.stack?.split('\n')[0],
      ms: Date.now() - started
    });
    
    return res.status(500).json({ ok: false, message: 'Something went wrong. Please try again later.' });
  }
}

export async function forgotPassword(req, res) {
  const started = Date.now();
  const rid = crypto.randomUUID();
  const ua = req.get("User-Agent") || "unknown";
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  
  alog("[forgotPassword:start]", { rid, ip, ua });

  try {
    const { email } = req.body || {};
    
    // Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      alog("[forgotPassword:fail] missing-email", { rid, email: !!email });
      return res.status(400).json({ ok: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal if user exists or not for security
      alog("[forgotPassword:user-not-found]", { rid, email: normalizedEmail });
      return res.json({ ok: true, message: 'If an account with that email exists, we\'ve sent a password reset link.' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      alog("[forgotPassword:user-inactive]", { rid, email: normalizedEmail, status: user.status });
      return res.json({ ok: true, message: 'If an account with that email exists, we\'ve sent a password reset link.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hash(resetToken);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in user document
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Generate reset link
    const resetLink = `${process.env.PUBLIC_APP_URL?.split(",")[0] || "http://localhost:5173"}/reset-password?token=${resetToken}`;
    
    alog("[forgotPassword:token-generated]", { 
      rid, 
      email: normalizedEmail, 
      userId: user._id,
      expiresAt: resetExpires.toISOString(),
      resetLink: resetLink.substring(0, 50) + '...' // Log partial link for debugging
    });

    // Send email with reset link
    try {
      await sendPasswordResetEmail(normalizedEmail, resetLink);
      alog("[forgotPassword:email-sent]", { 
        rid, 
        email: normalizedEmail, 
        resetLink: resetLink.substring(0, 50) + '...',
        success: true
      });
    } catch (emailError) {
      alog("[forgotPassword:email-failed]", { 
        rid, 
        email: normalizedEmail, 
        error: emailError?.message || 'Unknown email error',
        stack: emailError?.stack?.split('\n')[0]
      });
      
      // Log reset link only in non-production environments (never log tokens in production)
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] Password reset link for ${normalizedEmail}: ${resetLink}`);
      
      // Don't fail the request if email fails - user still gets success message
      // This prevents revealing if email exists when SMTP is down
    }

    alog("[forgotPassword:success]", { 
      rid, 
      email: normalizedEmail, 
      userId: user._id,
      ms: Date.now() - started
    });

    return res.json({ ok: true, message: 'If an account with that email exists, we\'ve sent a password reset link.' });

  } catch (error) {
    alog("[forgotPassword:exception]", {
      rid,
      name: error?.name,
      msg: error?.message,
      stack: error?.stack?.split('\n')[0], // First line of stack trace
      ms: Date.now() - started
    });

    return res.status(500).json({ ok: false, message: 'Something went wrong. Please try again later.' });
  }
}

// ============================================================
// SETTINGS CONTROLLERS
// ============================================================

// Helper: extract client IP for audit logging
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
}

// Helper: write an audit log entry (fire-and-forget — never blocks response)
function writeAudit(userId, action, req, meta = {}) {
  AuditLog.create({ userId, action, ip: clientIp(req), ua: req.get("User-Agent") || "", meta })
    .catch((e) => console.error("[audit] write failed:", e?.message));
}

// Helper: generate N random backup codes, return { plain[], hashed[] }
function generateBackupCodes(n = 8) {
  const plain = Array.from({ length: n }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-")
  );
  const hashed = plain.map((c) => hash(c));
  return { plain, hashed };
}

// ------------------------------------------------------------------
// PATCH /auth/me/password
// Requires: requireAuth, requireRecentAuth (verifies currentPassword)
// Body:     { currentPassword, newPassword }
// ------------------------------------------------------------------
export async function changePassword(req, res) {
  const { newPassword } = req.body || {};

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ ok: false, message: "New password must be at least 8 characters" });
  }

  // req.authenticatedUser is attached by requireRecentAuth (already DB-fetched with passwordHash)
  const user = req.authenticatedUser;

  const same = await bcrypt.compare(newPassword, user.passwordHash || "");
  if (same) {
    return res.status(400).json({ ok: false, message: "New password must differ from current password" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  // Revoke ALL refresh tokens so other sessions are invalidated
  await RefreshToken.deleteMany({ userId: user._id });

  writeAudit(user._id, "PASSWORD_CHANGE", req);

  return res.json({ ok: true, message: "Password updated. Other sessions have been signed out." });
}

// ------------------------------------------------------------------
// POST /auth/me/email/request
// Requires: requireAuth, requireRecentAuth (verifies currentPassword)
// Body:     { currentPassword, newEmail }
// ------------------------------------------------------------------
export async function requestEmailChange(req, res) {
  const { newEmail } = req.body || {};

  if (!newEmail || typeof newEmail !== "string") {
    return res.status(400).json({ ok: false, message: "newEmail is required" });
  }
  const normalized = newEmail.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ ok: false, message: "Invalid email format" });
  }

  const user = req.authenticatedUser;

  if (normalized === user.email) {
    return res.status(400).json({ ok: false, message: "New email must differ from current email" });
  }

  const conflict = await User.findOne({ email: normalized });
  if (conflict) return res.status(409).json({ ok: false, message: "Email already in use" });

  const token = crypto.randomBytes(32).toString("hex");
  user.emailChangePending = normalized;
  user.emailChangeToken   = hash(token);
  user.emailChangeExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const verifyLink = `${(process.env.PUBLIC_APP_URL || "").split(",")[0].trim()}/verify-email-change?token=${token}`;

  try {
    await sendEmailChangeVerification(normalized, verifyLink);
  } catch (e) {
    console.error("[settings] email change verification send failed:", e?.message);
    if (process.env.NODE_ENV !== 'production') console.log(`[DEV] Email change verify link for ${normalized}: ${verifyLink}`);
  }

  writeAudit(user._id, "EMAIL_CHANGE_REQUEST", req, { newEmail: normalized });

  return res.json({ ok: true, message: "Verification email sent to your new address. It expires in 1 hour." });
}

// ------------------------------------------------------------------
// GET /auth/me/email/verify?token=xxx   (public — token-gated)
// ------------------------------------------------------------------
export async function verifyEmailChange(req, res) {
  const { token } = req.query || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ ok: false, message: "Token is required" });
  }

  const tokenHash = hash(token.trim());
  const user = await User.findOne({
    emailChangeToken: tokenHash,
    emailChangeExpires: { $gt: new Date() },
  }).select("+emailChangePending +emailChangeToken +emailChangeExpires");

  if (!user) return res.status(400).json({ ok: false, message: "Invalid or expired token" });

  const newEmail = user.emailChangePending;

  // Race-condition guard: re-check for duplicate before committing
  const conflict = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
  if (conflict) {
    user.emailChangePending = null;
    user.emailChangeToken   = null;
    user.emailChangeExpires = null;
    await user.save();
    return res.status(409).json({ ok: false, message: "Email is already in use by another account" });
  }

  user.email              = newEmail;
  user.emailChangePending = null;
  user.emailChangeToken   = null;
  user.emailChangeExpires = null;
  await user.save();

  writeAudit(user._id, "EMAIL_CHANGE_VERIFY", req, { newEmail });

  return res.json({ ok: true, message: "Email address updated successfully" });
}

// ------------------------------------------------------------------
// GET /auth/me/2fa/setup
// Requires: requireAuth
// Generates a fresh TOTP secret and returns QR code URL
// ------------------------------------------------------------------
export async function selfTotpSetup(req, res) {
  const user = await User.findById(req.user?._id);
  if (!user) return res.status(404).json({ ok: false, message: "User not found" });

  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${process.env.TOTP_ISSUER || "ECA"}:${user.email}`,
  });
  user.mfa.totpSecretEnc  = encryptTotpSecret(secret.base32);
  user.mfa.totpSecretHash = null; // clear legacy
  await user.save();

  const otpauth_url = speakeasy.otpauthURL({
    secret: secret.base32,
    encoding: "base32",
    label: user.email,
    issuer: process.env.TOTP_ISSUER || "ECA",
    digits: 6,
    period: 30,
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth_url);

  return res.json({ ok: true, qrDataUrl, otpauth_url });
}

// ------------------------------------------------------------------
// POST /auth/me/2fa/enable
// Requires: requireAuth
// Body: { code }  — 6-digit TOTP code confirming enrollment
// Returns backup codes ONCE on success
// ------------------------------------------------------------------
export async function selfTotpEnable(req, res) {
  const { code } = req.body || {};
  if (!code || !/^\d{6}$/.test(String(code))) {
    return res.status(400).json({ ok: false, message: "A valid 6-digit code is required" });
  }

  const user = await User.findById(req.user?._id);
  if (!user) return res.status(404).json({ ok: false, message: "User not found" });

  const enc = user.mfa?.totpSecretEnc;
  const hasValidEnc = !!(enc?.iv && enc?.ct && enc?.tag);
  if (!hasValidEnc) {
    return res.status(400).json({ ok: false, message: "No pending TOTP setup. Call /2fa/setup first." });
  }

  let base32Secret;
  try {
    base32Secret = decryptTotpSecret(enc);
  } catch {
    return res.status(400).json({ ok: false, message: "Stored secret is corrupted. Call /2fa/setup again." });
  }

  const result = speakeasy.totp.verifyDelta({
    secret: base32Secret,
    encoding: "base32",
    token: String(code),
    digits: 6,
    step: 30,
    window: 1,
  });
  if (!result) return res.status(400).json({ ok: false, message: "Invalid code" });

  // Generate backup codes — returned once, stored as hashes
  const { plain: backupPlain, hashed: backupHashed } = generateBackupCodes(8);

  user.mfa.required = true;
  user.mfa.method   = "totp";
  user.backupCodes  = backupHashed;
  await user.save();

  writeAudit(user._id, "2FA_ENABLE", req, { method: "totp" });
  writeAudit(user._id, "BACKUP_CODES_GENERATED", req);

  return res.json({
    ok: true,
    message: "2FA enabled",
    backupCodes: backupPlain, // returned ONCE — user must save these
  });
}

// ------------------------------------------------------------------
// POST /auth/me/2fa/disable
// Requires: requireAuth, requireRecentAuth (verifies currentPassword)
// ------------------------------------------------------------------
export async function selfTotpDisable(req, res) {
  const user = req.authenticatedUser;

  if (user.role === "superadmin") {
    return res.status(403).json({ ok: false, message: "Superadmin must keep 2FA enabled at all times" });
  }

  user.mfa.required       = false;
  user.mfa.method         = null;
  user.mfa.totpSecretHash = null;
  user.mfa.totpSecretEnc  = { iv: null, ct: null, tag: null };
  user.mfa.emailOtp       = null;
  user.backupCodes        = [];
  await user.save();

  writeAudit(user._id, "2FA_DISABLE", req);

  return res.json({ ok: true, message: "2FA disabled" });
}

// ============================================================
// SESSION MONITORING
// ============================================================

// ------------------------------------------------------------------
// detectSuspiciousLogin — runs after successful credential check.
// Flags logins from a User-Agent or IP not seen in any active session.
// Fire-and-forget: never blocks the login response.
// ------------------------------------------------------------------
async function detectSuspiciousLogin(user, ua, ip, req) {
  try {
    const existing = await RefreshToken.findOne({
      userId: user._id,
      revokedAt: null,
      $or: [{ device: ua }, { ip }],
    });

    if (!existing) {
      // New device AND new IP — write audit + optional email alert
      writeAudit(user._id, "SUSPICIOUS_LOGIN", req, {
        ua,
        ip,
        reason: "Unrecognized device and IP",
      });

      // Best-effort email alert — never fail login if this throws
      sendSuspiciousLoginAlert(user.email, { ua, ip }).catch((e) =>
        console.error("[security] suspicious login alert failed:", e?.message)
      );
    }
  } catch (e) {
    console.error("[security] suspicious login check failed:", e?.message);
  }
}

// ------------------------------------------------------------------
// GET /auth/me/sessions
// Returns all active (non-revoked) sessions for the authenticated user.
// Marks the current session by matching jti from the access token.
// ------------------------------------------------------------------
export async function listSessions(req, res) {
  const userId = req.user?._id;
  const currentJti = req.user?.jti ?? null;

  const sessions = await RefreshToken.find({
    userId,
    revokedAt: null,
    exp: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  const result = sessions.map((s) => {
    const parsed = parseUA(s.device || "");
    return {
      id:          String(s._id),
      device:      parsed,
      ip:          s.ip || null,
      lastUsedAt:  s.lastUsedAt ?? s.createdAt,
      current:     currentJti ? s.jti === currentJti : false,
    };
  });

  return res.json({ ok: true, sessions: result });
}

// ------------------------------------------------------------------
// DELETE /auth/me/sessions/:id
// Revokes a single session by its document _id.
// Cannot revoke the current session (use /logout for that).
// ------------------------------------------------------------------
export async function revokeSession(req, res) {
  const userId = req.user?._id;
  const { id }  = req.params;

  const session = await RefreshToken.findOne({ _id: id, userId });
  if (!session) return res.status(404).json({ ok: false, message: "Session not found" });

  if (session.revokedAt) {
    return res.status(400).json({ ok: false, message: "Session already revoked" });
  }

  await RefreshToken.updateOne(
    { _id: id },
    { $set: { revokedAt: new Date(), isRevoked: true } }
  );

  writeAudit(userId, "SESSION_REVOKED", req, { sessionId: String(id) });

  return res.json({ ok: true, message: "Session revoked" });
}

// ------------------------------------------------------------------
// POST /auth/me/sessions/revoke-others
// Revokes all sessions except the current one (identified by jti).
// ------------------------------------------------------------------
export async function revokeOtherSessions(req, res) {
  const userId     = req.user?._id;
  const currentJti = req.user?.jti ?? null;

  if (!currentJti) {
    return res.status(400).json({ ok: false, message: "Cannot identify current session" });
  }

  const result = await RefreshToken.updateMany(
    {
      userId,
      jti: { $ne: currentJti },
      revokedAt: null,
    },
    { $set: { revokedAt: new Date(), isRevoked: true } }
  );

  writeAudit(userId, "SESSION_REVOKED_ALL", req, { count: result.modifiedCount });

  return res.json({
    ok: true,
    message: `${result.modifiedCount} other session(s) revoked`,
    count: result.modifiedCount,
  });
}