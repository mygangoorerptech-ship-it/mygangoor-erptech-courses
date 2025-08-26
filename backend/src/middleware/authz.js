// backend/src/middleware/authz.js
import jwt from "jsonwebtoken";

/**
 * Reads the access token from:
 *  - Authorization: Bearer <token>  (rare in browser, but supported)
 *  - Cookies: __Host-session (prod, Secure) or sid (dev fallback)
 */
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const cookieToken = req.cookies?.["__Host-session"] || req.cookies?.["sid"] || null;
  const token = bearer || cookieToken;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET; // back-compat
    const payload = jwt.verify(token, secret);
    // (optional) enforce token type if you set one: if (payload.t !== 'access') return res.status(401)...
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/** Exactly one role (kept for convenience) */
export function requireRole(role) {
  return (req, res, next) => {
    const one = (req.user?.role || '').toString().toLowerCase();
    if (!one || one !== role.toLowerCase()) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

/** Any of the given roles (accepts varargs or arrays) */
export function requireAnyRole(...roles) {
  // Flatten roles in case someone passed an array
  const flat = [];
  for (const r of roles) {
    if (Array.isArray(r)) flat.push(...r);
    else flat.push(r);
  }
  return (req, res, next) => {
    const want = flat.map(r => (r || '').toString().toLowerCase());
    const one  = (req.user?.role || '').toString().toLowerCase();
    const many = Array.isArray(req.user?.roles)
      ? req.user.roles.map(r => (r || '').toString().toLowerCase())
      : [];
    const ok = (one && want.includes(one)) || many.some(r => want.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

