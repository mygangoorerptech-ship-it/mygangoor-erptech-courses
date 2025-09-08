// src/api/refreshGate.ts
// One-flight refresh gate shared across the whole app (public + admin).
// Avoids double /auth/refresh calls and keeps cookies/CSRF in sync.
import { API_BASE } from "../config/env";
import { invalidateCsrfToken, ensureCsrfToken } from "../config/csrf";

declare global {
  interface Window {
    __ecaRefreshInflight?: Promise<boolean> | null;
  }
}

const DBG = true; // flip to false to silence

function dlog(...a: any[]) {
  if (DBG) console.log(new Date().toISOString(), "[refreshGate]", ...a);
}

async function doRefresh(): Promise<boolean> {
  dlog("begin POST /auth/refresh");
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  dlog("result", res.status, res.ok);
  if (!res.ok) return false;

  // rotate CSRF after success
  invalidateCsrfToken();
  await ensureCsrfToken(true);
  dlog("csrf rotated, refresh OK");
  return true;
}

export async function refreshOnce(): Promise<boolean> {
  if (!window.__ecaRefreshInflight) {
    dlog("no inflight → creating one");
    window.__ecaRefreshInflight = (async () => {
      try {
        const ok = await doRefresh();
        dlog("resolve inflight", ok);
        return ok;
      } finally {
        // release the latch on microtask turn
        await Promise.resolve();
        window.__ecaRefreshInflight = null;
        dlog("released inflight latch");
      }
    })();
  } else {
    dlog("joining existing inflight");
  }
  return await window.__ecaRefreshInflight!;
}