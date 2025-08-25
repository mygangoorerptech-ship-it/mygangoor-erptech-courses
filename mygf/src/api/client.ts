// src/api/client.ts
import axios, { AxiosError } from "axios";
import { SERVER_URL } from "../components/constants";
import { ensureCsrfToken, getCsrfToken } from "../config/csrf";

const baseURL = SERVER_URL ? `${SERVER_URL}/api` : "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true, // send HttpOnly cookies
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ---- ALWAYS attach CSRF header (even on GET) ----
api.interceptors.request.use(async (config) => {
  try {
    await ensureCsrfToken();
    const token = getCsrfToken();
    if (token) {
      (config.headers as any) = config.headers ?? {};
      // use canonical casing
      (config.headers as any)['X-CSRF-Token'] = token;
    }
  } catch {}
  return config;
});

// ---- 401 -> refresh (cookie-only) -> retry once
let isRefreshing = false;
const waiters: Array<() => void> = [];
const waitForRefresh = () => new Promise<void>((resolve) => waiters.push(resolve));
const releaseWaiters = () => { while (waiters.length) waiters.shift()!(); };

// Helper: refetch CSRF then retry once (for 403/CSRF)
async function retryWithFreshCsrf(cfg: any) {
  if (cfg._csrfRetry) throw new Error("CSRF retry already attempted");
  cfg._csrfRetry = true;
  await ensureCsrfToken(true);
  const t = getCsrfToken();
  (cfg.headers ??= {});
  delete (cfg.headers as any)['X-CSRF-Token'];  // avoid dup keys
  (cfg.headers as any)['x-csrf-token'] = t;
  return api.request(cfg);
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const cfg = (error?.config ?? {}) as any;
    const status = error?.response?.status as number | undefined;
    const url: string = cfg?.url || "";

    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/mfa") ||
      url.includes("/auth/totp") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    // If CSRF likely failed (403 on unsafe method), refresh CSRF and retry once.
    if (
      status === 403 &&
      ["post", "put", "patch", "delete"].includes((cfg.method || "get").toLowerCase()) &&
      !cfg._csrfRetry
    ) {
      try {
        return await retryWithFreshCsrf(cfg);
      } catch {
        // fall through to normal handling
      }
    }

    if (status !== 401 || isAuthEndpoint || cfg._retry) {
      return Promise.reject(error);
    }

    cfg._retry = true;

    if (isRefreshing) {
      await waitForRefresh();
      return api.request(cfg);
    }

    isRefreshing = true;
    try {
      await api.post("/auth/refresh", {}, { withCredentials: true }); // uses HttpOnly refresh cookie
      releaseWaiters();
      return api.request(cfg);
    } catch (e) {
      releaseWaiters();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
