//src/config/env.ts
// Extract base URL, removing trailing slashes and /api suffix if present
// This ensures API_ROOT is the backend base URL (without /api)
// and API_BASE is always API_ROOT + /api (never double /api/api)
function normalizeApiRoot(url: string): string {
  return url
    .replace(/\/+$/, "") // Remove trailing slashes
    .replace(/\/api$/i, ""); // Remove /api suffix if present
}

const viteEnv = import.meta.env as { VITE_API_URL?: string };
export const API_ROOT: string =
  viteEnv?.VITE_API_URL
    ? normalizeApiRoot(String(viteEnv.VITE_API_URL))
    : "";

export const API_BASE: string = API_ROOT ? `${API_ROOT}/api` : "/api";
