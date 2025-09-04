// backend/src/routes/debug.js
import { Router } from "express";
import jwt from "jsonwebtoken";

const r = Router();

r.get("/whoami", (req, res) => {
  const sid =
    req.cookies?.sid ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    null;

  const secret =
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    null;

  const common = {
    cookies: Object.keys(req.cookies || {}),
    headers: { origin: req.headers?.origin || null, referer: req.headers?.referer || null },
    haveSecret: Boolean(secret),
  };

  if (!sid) {
    return res.status(200).json({ ok: false, code: "NO_TOKEN", ...common });
  }

  const looksLikeJwt = sid.split(".").length === 3;
  if (!looksLikeJwt) {
    return res.status(200).json({ ok: false, code: "UNKNOWN_TOKEN_FORMAT", ...common });
  }

  if (!secret) {
    return res.status(200).json({ ok: false, code: "NO_SECRET", ...common });
  }

  try {
    const user = jwt.verify(sid, secret);
    return res.json({ ok: true, user, ...common });
  } catch (err) {
    const code = err?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    return res.status(200).json({ ok: false, code, message: err?.message, ...common });
  }
});

export default r;
