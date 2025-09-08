// src/admin/api/client.ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from "../../config/env";
import { ensureCsrfToken, getCsrfToken } from '../../config/csrf';
import { logAxiosMutation } from './audit';
import { refreshOnce } from '../../api/refreshGate';

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

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const res = error.response;
    const cfg: any = error.config || {};
    const status = res?.status ?? 0;

    const isRefresh = (cfg?: any) => ((cfg?.url || '') as string).includes('/auth/refresh');

    if (!cfg || cfg.__retryAfterRefresh || isRefresh(cfg) || (status !== 401 && status !== 419)) {
      return Promise.reject(error);
    }

    const ok = await refreshOnce();
    if (!ok) return Promise.reject(error);

    cfg.__retryAfterRefresh = true;

    try {
      const method = (cfg.method || 'get').toLowerCase();
      if (['post','put','patch','delete'].includes(method)) {
        const { getCsrfToken } = await import('../../config/csrf');
        const tok = getCsrfToken();
        if (tok) cfg.headers = { ...(cfg.headers || {}), 'X-CSRF-Token': tok };
      }
    } catch {}

    return api(cfg);
  }
);
