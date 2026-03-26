// src/admin/api/audit.ts
import { api } from "./client";

export type AuditLog = {
  id?: string;
  _id?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  message?: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  orgId?: string | null;
  createdAt?: string;
  ip?: string;
  ua?: string;
  meta?: Record<string, any>;
};

export type AuditPage = {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
};

export type AuditParams = {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
};

// Extracts items array from either paginated { items: [] } or legacy flat []
function extractItems(data: any): AuditLog[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

// ---- READ: recent audit logs — backward-compat, returns flat array ----
// Used by Overview.tsx. Do NOT change the return type.
export async function listAuditLogs(params?: {
  limit?: number;
  roles?: string[];
  orgOnly?: boolean;
}): Promise<AuditLog[]> {
  const query: any = {};
  if (params?.limit) query.limit = params.limit;
  if (params?.roles?.length) query.roles = params.roles.join(",");

  try {
    const r = await api.get("/audit/logs", { params: query });
    return extractItems(r.data);
  } catch {
    try {
      const r = await api.get("/sa/audit/logs", { params: query });
      return extractItems(r.data);
    } catch {
      return [];
    }
  }
}

// ---- READ: paginated audit logs — used by AuditLogs page ----
export async function listAuditLogsPaged(params: AuditParams = {}): Promise<AuditPage> {
  const empty: AuditPage = { items: [], total: 0, page: 1, limit: 50 };
  const query: Record<string, any> = {};
  if (params.page)   query.page   = params.page;
  if (params.limit)  query.limit  = params.limit;
  if (params.userId) query.userId = params.userId;
  if (params.action && params.action !== "all") query.action = params.action;
  if (params.from)   query.from   = params.from;
  if (params.to)     query.to     = params.to;

  try {
    const r = await api.get("/sa/audit/logs", { params: query });
    const d = r.data;
    if (d && Array.isArray(d.items)) return d as AuditPage;
    // backend returned flat array (legacy)
    return { items: extractItems(d), total: extractItems(d).length, page: 1, limit: params.limit ?? 50 };
  } catch {
    return empty;
  }
}

// ---- WRITE: lightweight mutation logger used by axios interceptors ----
// Safe by default (NO-OP). Set VITE_ENABLE_CLIENT_AUDIT=1 to turn it on.
// Uses navigator.sendBeacon to avoid interceptor recursion / retry loops.
const ENABLE_CLIENT_AUDIT =
  (import.meta as any)?.env?.VITE_ENABLE_CLIENT_AUDIT === "1";

export function logAxiosMutation(
  success: boolean,
  cfg?: any,
  respOrErr?: any
): void {
  try {
    if (!ENABLE_CLIENT_AUDIT || !cfg) return;

    const method = String(cfg.method || "get").toLowerCase();
    // only log mutations
    if (!["post", "put", "patch", "delete"].includes(method)) return;

    // avoid logging auth refresh/check noise
    const url = String(cfg.url || "");
    if (url.includes("/auth/refresh") || url.includes("/auth/check")) return;

    const status =
      respOrErr?.status ?? respOrErr?.response?.status ?? undefined;

    const payload = {
      ts: Date.now(),
      success,
      method,
      url,
      status,
    };

    const base =
      (import.meta as any)?.env?.VITE_API_URL
        ? `${(import.meta as any).env.VITE_API_URL}/api`
        : "/api";

    const beaconUrl = `${base}/audit/client`;

    // Prefer sendBeacon (non-blocking, no interceptor recursion).
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      (navigator as any).sendBeacon(beaconUrl, blob);
      return;
    }

    // Fallback: fire-and-forget fetch; swallow all errors.
    fetch(beaconUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  } catch {
    // never throw from a logger
  }
}
