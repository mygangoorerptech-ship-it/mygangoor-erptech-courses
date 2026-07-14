import { API_ROOT } from "./env";

let _cached: string | null = null;
let _generation = 0;
let _inflight: { generation: number; promise: Promise<void> } | null = null;

function readCookie(name: string): string | null {
  const raw = typeof document !== "undefined" ? document.cookie : "";
  if (!raw) return null;
  for (const part of raw.split("; ")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    if (k === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export function getCsrfToken() { return _cached; }

export function invalidateCsrfToken() {
  _cached = null;
  _generation += 1;
}

async function fetchCsrfToken(generation: number): Promise<void> {
  const url = API_ROOT ? `${API_ROOT}/csrf` : "/csrf";
  let token: string | null = null;
  try {
    const res = await fetch(url, { credentials: "include" });
    try {
      const data: unknown = await res.json();
      if (data && typeof data === "object") {
        const body = data as { token?: unknown; csrfToken?: unknown };
        const candidate = body.token ?? body.csrfToken;
        token = typeof candidate === "string" ? candidate : null;
      }
    } catch {
      // Cookie fallback below handles non-JSON proxy responses in development.
    }
  } catch {
    // Cookie fallback below handles transient fetch/proxy failures.
  }

  if (!token) token = readCookie("__Host-csrf") || readCookie("csrf");

  // A refresh may invalidate CSRF while an older request is still in flight.
  // Never let that stale response overwrite the newer token generation.
  if (token && generation === _generation) {
    _cached = token;
  }
}

/**
 * Shares one CSRF bootstrap request per token generation.
 *
 * - React StrictMode/page prefetch cannot duplicate GET /csrf.
 * - A failed warm-up gets one joined retry before a mutation proceeds.
 * - invalidateCsrfToken() prevents an older in-flight response from restoring a
 *   token generated before refresh-token rotation.
 */
export async function ensureCsrfToken(force = false): Promise<void> {
  if (force) {
    invalidateCsrfToken();
  } else if (_cached) {
    return;
  }

  // Two bounded attempts cover the important race where a background warm-up
  // fails while the submit interceptor is waiting on the same promise.
  for (let attempt = 0; attempt < 2 && !_cached; attempt += 1) {
    const generation = _generation;
    const existing = _inflight?.generation === generation ? _inflight : null;

    if (existing) {
      await existing.promise;
      continue;
    }

    const request = fetchCsrfToken(generation);
    _inflight = { generation, promise: request };

    try {
      await request;
    } finally {
      if (_inflight?.promise === request) {
        _inflight = null;
      }
    }

  }
}
