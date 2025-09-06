// src/admin/api/client.ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from "../../config/env";
import { ensureCsrfToken, getCsrfToken, invalidateCsrfToken } from '../../config/csrf';
import { logAxiosMutation } from './audit';

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// ---- Log mutations (best-effort) ----
api.interceptors.response.use(
  (r) => {
    try { logAxiosMutation(true, r.config, r); } catch {}
    return r;
  },
  (err) => {
    try { logAxiosMutation(false, err?.config, err); } catch {}
    // Let auth errors bubble; no extra wrapping
    return Promise.reject(err);
  }
);

// ---- Auto-attach CSRF header on unsafe methods, but NEVER for /auth/refresh ----
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  const urlStr = (config.url || '').toString();
  const isUnsafe = ['post','put','patch','delete'].includes(method);
  const skipCsrf = urlStr.includes('/auth/refresh') || urlStr === '/csrf';

  if (isUnsafe && !skipCsrf) {
    await ensureCsrfToken(); // cached unless we called ensureCsrfToken(true) after refresh
    const token = getCsrfToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)['X-CSRF-Token'] = token;
    }
  }
  return config;
});

// ---- 401/419 → refresh (single-flight) → rotate CSRF → replay ----
let refreshing = false;
let waiters: Array<(ok: boolean) => void> = [];
const isRefresh = (cfg?: any) => ((cfg?.url || '') as string).includes('/auth/refresh');

function waitForRefresh(): Promise<boolean> {
  return new Promise((resolve) => waiters.push(resolve));
}
function releaseWaiters(ok: boolean) {
  const w = waiters.slice();
  waiters = [];
  for (const fn of w) {
    try { fn(ok); } catch {}
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const res = error.response;
    const cfg: any = error.config || {};
    const status = res?.status ?? 0;

    // Only handle auth-expiry codes; never loop; never intercept /auth/refresh itself
    if (!cfg || cfg.__retryAfterRefresh || isRefresh(cfg) || (status !== 401 && status !== 419)) {
      return Promise.reject(error);
    }

    if (refreshing) {
      const ok = await waitForRefresh();
      if (!ok) return Promise.reject(error);
      cfg.__retryAfterRefresh = true;
      return api(cfg);
    }

    refreshing = true;
    try {
      // IMPORTANT: do NOT fetch CSRF before refresh
      await api.post('/auth/refresh', {}); // cookies + withCredentials

      // New access cookie set → rotate CSRF to match the new session
      invalidateCsrfToken();
      await ensureCsrfToken(true);

      releaseWaiters(true);
      cfg.__retryAfterRefresh = true;
      return api(cfg);
    } catch (e) {
      releaseWaiters(false);
      return Promise.reject(error);
    } finally {
      refreshing = false;
    }
  }
);
