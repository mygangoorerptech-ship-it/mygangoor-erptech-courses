// backend/src/utils/http.js

/**
 * Send a success JSON response.
 * By default wraps objects as-is and arrays/primitives under { data }.
 */
export function sendOk(res, data = {}, status = 200) {
  if (res.headersSent) return;
  const body =
    data && typeof data === 'object' && !Array.isArray(data)
      ? { ok: true, ...data }
      : { ok: true, data };
  return res.status(status).json(body);
}

/**
 * Send a standardized error JSON response.
 * Shape: { ok: false, error: <code>, details?: any, reqId?: string }
 *
 * - `error` should be a short, machine-readable code (e.g., 'invalid-credentials').
 * - `details` are only included outside production to avoid leaking internals.
 */
export function sendErr(res, status = 500, error = 'internal-error', details) {
  if (res.headersSent) return;

  // Prevent browsers/proxies from caching error responses
  try {
    res.setHeader('Cache-Control', 'no-store');
  } catch (_) {
    /* noop */
  }

  const body = { ok: false, error };

  // Attach details only in non-production environments
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  // If you propagate a request id via res.locals, include it for traceability
  if (res?.locals?.reqId) {
    body.reqId = res.locals.reqId;
  }

  return res.status(Number(status) || 500).json(body);
}

/** 404 helper */
export function notFound(res, what = 'resource') {
  return sendErr(res, 404, `${what}-not-found`);
}

/** 400 helper */
export function badReq(res, code = 'bad-request', details) {
  return sendErr(res, 400, code, details);
}

/** 403 helper */
export function forbidden(res, code = 'forbidden') {
  return sendErr(res, 403, code);
}

/**
 * Async route wrapper to surface errors to Express error middleware.
 * Usage: r.get('/path', wrap(async (req,res)=>{ ... }))
 */
export const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Small utilities often handy in controllers */
export function parseIntParam(val, def) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
}

export function parseBool(val, def = false) {
  if (typeof val === 'boolean') return val;
  if (val == null) return def;
  const s = String(val).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return def;
}

export function pick(obj, keys = []) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

export function omit(obj, keys = []) {
  const out = { ...(obj || {}) };
  for (const k of keys) delete out[k];
  return out;
}
