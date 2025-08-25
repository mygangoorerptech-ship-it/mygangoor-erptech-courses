// src/config/api.ts
import axios from "axios";
import { ensureCsrfToken, getCsrfToken } from "./csrf";

const baseURL =
  import.meta.env.VITE_API_URL ??
  (location.origin.startsWith("https://")
    ? `${location.origin.replace(/\/$/, "")}/api`
    : "http://localhost:5002/api");

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- CSRF header on unsafe methods (double-submit) ----
api.interceptors.request.use(async (config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    await ensureCsrfToken();
    const token = getCsrfToken();
    config.headers = config.headers ?? {};
    (config.headers as any)["X-CSRF-Token"] = token;
  }
  return config;
});

// ---- 401 -> refresh (cookie-only) -> retry once ----
let isRefreshing = false;
const waiters: Array<() => void> = [];
const waitForRefresh = () => new Promise<void>((resolve) => waiters.push(resolve));
const releaseWaiters = () => { while (waiters.length) waiters.shift()!(); };

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = (error?.config ?? {}) as any;
    const status = error?.response?.status as number | undefined;

    if (!status || status !== 401 || cfg._retry) {
      return Promise.reject(error);
    }

    cfg._retry = true;

    if (isRefreshing) {
      await waitForRefresh();
      return api(cfg);
    }

    isRefreshing = true;
    try {
      await api.post("/auth/refresh", {}); // your backend mounts /refresh under the same baseURL
      releaseWaiters();
      return api(cfg);
    } catch (e) {
      releaseWaiters();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
