// Lightweight, dependency-free rate limiter for admin/teacher/superadmin actions.
// Works with ESM. Keeps memory usage low with fixed-time windows.

const store = new Map();

/**
 * Create a simple fixed-window rate limiter middleware.
 * @param {object} opts
 * @param {number} opts.windowMs  - window size in ms
 * @param {number} opts.max       - max requests within window for a given key
 * @param {(req: import('express').Request) => string} [opts.keyFn] - key builder
 */
function makeLimiter({ windowMs, max, keyFn } = {}) {
  const win = Number(windowMs) || 60_000;
  const limit = Number(max) || 60;
  const buildKey =
    keyFn ||
    ((req) => {
      // Prefer authenticated user id; fall back to IP.
      const uid = (req.user && (req.user._id || req.user.id)) || req.ip || "anon";
      // Bind to route to avoid starving other endpoints.
      const route = (req.baseUrl || "") + (req.path || "");
      // Fixed window bucket
      const bucket = Math.floor(Date.now() / win);
      return `${uid}|${route}|${bucket}`;
    });

  return function adminLimiter(req, res, next) {
    try {
      const key = buildKey(req);
      const used = store.get(key) || 0;

      if (used >= limit) {
        // Best-effort Retry-After (seconds)
        const retryAfterSec = Math.ceil((win - (Date.now() % win)) / 1000);
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(429).json({ ok: false, message: "too-many-requests" });
      }

      store.set(key, used + 1);

      // Opportunistic cleanup: clear the previous window bucket for this user/route
      if (used === 0) {
        const prevBucketKey = key.replace(/\|\d+$/, (m) => `|${Number(m.slice(1)) - 1}`);
        store.delete(prevBucketKey);
      }

      return next();
    } catch (e) {
      // Fail-open on limiter errors to avoid blocking admin — but log the issue.
      console.error("[adminLimits] limiter error:", e);
      return next();
    }
  };
}

// Generic admin action limiter (safe default).
export const adminActionLimiter = makeLimiter({
  windowMs: 60_000, // 1 minute
  max: 60,          // up to 60 admin actions/min per user per route
});

// Optional: a stricter limiter for heavy operations like PDF renders.
// If you want to use this, import it in the route instead of adminActionLimiter.
export const heavyActionLimiter = makeLimiter({
  windowMs: 60_000,
  max: 10,          // 10 renders/min per user per route
});

export default adminActionLimiter;
