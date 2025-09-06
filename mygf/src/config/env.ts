export const API_ROOT: string =
  (import.meta as any)?.env?.VITE_API_URL
    ? String((import.meta as any).env.VITE_API_URL).replace(/\/+$/, "")
    : "";

export const API_BASE: string = API_ROOT ? `${API_ROOT}/api` : "/api";
