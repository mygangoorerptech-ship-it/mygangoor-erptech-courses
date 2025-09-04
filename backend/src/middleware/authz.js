//backend/src/middleware/authz.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const cookieToken =
    req.cookies?.["__Host-session"] ||
    req.cookies?.["sid"] ||
    req.cookies?.["access"] ||
    req.cookies?.["accessToken"] ||
    null;

  const token = bearer || cookieToken;
  if (!token) {
    if (req.path.startsWith("/api/students")) {
      console.warn("[requireAuth] Missing token for", req.method, req.originalUrl, {
        hasSid: !!req.cookies?.sid, hasSr: !!req.cookies?.sr, hasBearer: !!bearer
      });
    }
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);
    req.user = payload;

    if (req.path.startsWith("/api/students")) {
      console.log("[requireAuth] OK", req.method, req.originalUrl, {
        sub: payload.sub, role: payload.role, orgId: payload.orgId
      });
    }
    next();
  } catch (e) {
    if (req.path.startsWith("/api/students")) {
      console.warn("[requireAuth] Invalid token", e?.message);
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(required) {
  const toList = (val) => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") {
      if (Array.isArray(val.anyOf)) return val.anyOf;
      if (Array.isArray(val.roles)) return val.roles;
    }
    return [val];
  };

  // Normalise allowed roles: trim whitespace and lowercase each entry
  const allowed = toList(required)
    .filter(Boolean)
    .map((r) => String(r).trim().toLowerCase());

return (req, res, next) => {
  let userRole = req.user?.role;
  if (!userRole && Array.isArray(req.user?.roles) && req.user.roles.length) {
    userRole = req.user.roles[0];
  }
  userRole = (userRole || '').toString().trim().toLowerCase();

  // Debug: log every call to see which roles are coming in
  console.log(`[requireRole] path=${req.originalUrl}, userRole=${userRole}, allowed=${allowed.join(',')}`);

  if (!userRole) {
    return res.status(401).json({ ok: false, message: 'Unauthenticated (no role)' });
  }
  if (allowed.length && !allowed.includes(userRole)) {
    return res.status(403).json({ error: 'Forbidden', userRole, allowed });
  }
  return next();
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

export function requireAuthNoRole(req, res, next) {
  return requireAuth(req, res, next);
}

