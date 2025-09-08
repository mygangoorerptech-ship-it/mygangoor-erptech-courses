// src/api/client.ts
import axios, { AxiosError } from 'axios';
import { API_BASE } from "../config/env";
import { ensureCsrfToken, getCsrfToken } from '../config/csrf';
import { refreshOnce } from './refreshGate';

// Prefer env var in prod; fallback to same-origin "/api"

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// Attach Authorization header from dev cookie
//
// In development we mirror the access token into a non-HttpOnly cookie named
// `access`. The server already accepts the token via cookies, but during
// development the proxy (Vite -> backend) sometimes strips cookies due to
// SameSite/Secure policies. By explicitly copying the value of the `access`
// cookie into an `Authorization` bearer header on every request, we ensure
// protected endpoints always receive a valid token even when cookies are not
// forwarded. In production this interceptor has no effect because the
// `access` cookie is never set (NODE_ENV === 'production').
api.interceptors.request.use((config) => {
  try {
    // Match the `access` cookie value; ignore if not present
    const match = document.cookie.match(/(?:^|;\s*)access=([^;]+)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      // If headers exist, set Authorization; otherwise create a typed object
      if (config.headers) {
        // Cast because AxiosHeaders doesn’t have index signatures
        (config.headers as any).Authorization = `Bearer ${token}`;
      } else {
        // When headers are undefined, assign a minimal compatible object
        config.headers = { Authorization: `Bearer ${token}` } as any;
      }
    }
  } catch {
    // silently ignore any errors reading cookies (e.g. SSR)
  }
  return config;
});

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const urlStr = String(config.url || '');
  const isUnsafe = ['post', 'put', 'patch', 'delete'].includes(method);
  const skip = urlStr.includes('/auth/refresh') || urlStr === '/csrf';

  if (isUnsafe && !skip) {
    await ensureCsrfToken();
    const tok = getCsrfToken();
    if (tok) (config.headers as any)['X-CSRF-Token'] = tok;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const res = err.response;
    const cfg: any = err.config || {};
    const status = res?.status ?? 0;

    const isRefresh = (cfg?: any) => (cfg?.url || '').toString().includes('/auth/refresh');

    // Only handle typical auth-expiry codes and never loop or touch /auth/refresh itself
    if (!cfg || cfg.__retried || isRefresh(cfg) || (status !== 401 && status !== 419)) {
      throw err;
    }

    // Single-flight, shared across the whole app
    const ok = await refreshOnce();
    if (!ok) throw err;

    cfg.__retried = true;

    // If the original was unsafe, attach the (fresh) CSRF header
    try {
      const method = (cfg.method || 'get').toLowerCase();
      if (['post','put','patch','delete'].includes(method)) {
        const { getCsrfToken } = await import('../config/csrf');
        const tok = getCsrfToken();
        if (tok) cfg.headers = { ...(cfg.headers || {}), 'X-CSRF-Token': tok };
      }
    } catch {}

    return api(cfg);
  }
);
