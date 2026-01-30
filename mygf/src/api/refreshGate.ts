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
const LOCK_KEY = "eca:auth:refresh_lock";
const SIGNAL_KEY = "eca:auth:refresh_signal";
const TERMINATED_KEY = "eca:auth:terminated";
const LOCK_TTL_MS = 12_000;

function dlog(...a: unknown[]) {
  if (DBG) console.log(new Date().toISOString(), "[refreshGate]", ...a);
}

type RefreshSignal = { status: "ok" | "fail"; ts: number };

function now() { return Date.now(); }

function getJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function clearKey(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function isTerminatedRecent(): boolean {
  const t = getJson<{ ts: number }>(TERMINATED_KEY);
  return !!(t?.ts && now() - t.ts < 5 * 60_000);
}

function markTerminated() {
  setJson(TERMINATED_KEY, { ts: now() });
}

function tryAcquireLock(ownerId: string): boolean {
  const cur = getJson<{ ownerId: string; ts: number }>(LOCK_KEY);
  if (cur?.ts && now() - cur.ts < LOCK_TTL_MS) return false;
  setJson(LOCK_KEY, { ownerId, ts: now() });
  const confirm = getJson<{ ownerId: string; ts: number }>(LOCK_KEY);
  return confirm?.ownerId === ownerId;
}

function waitForSignal(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = now();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIGNAL_KEY) return;
      const sig = getJson<RefreshSignal>(SIGNAL_KEY);
      if (sig?.status === "ok") cleanup(true);
      if (sig?.status === "fail") cleanup(false);
    };
    const tick = () => {
      const sig = getJson<RefreshSignal>(SIGNAL_KEY);
      if (sig?.status === "ok") return cleanup(true);
      if (sig?.status === "fail") return cleanup(false);
      if (now() - start > timeoutMs) return cleanup(false);
      setTimeout(tick, 200);
    };
    const cleanup = (ok: boolean) => {
      window.removeEventListener("storage", onStorage);
      resolve(ok);
    };
    window.addEventListener("storage", onStorage);
    tick();
  });
}

async function doRefresh(): Promise<boolean> {
  dlog("begin POST /auth/refresh");
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  dlog("result", res.status, res.ok);
  if (!res.ok) {
    dlog("refresh failed:", res.status, res.statusText);
    return false;
  }

  // rotate CSRF after success
  invalidateCsrfToken();
  await ensureCsrfToken(true);
  dlog("csrf rotated, refresh OK");
  return true;
}

export async function refreshOnce(): Promise<boolean> {
  // If another tab already declared termination, do not retry endlessly
  if (isTerminatedRecent()) return false;

  if (!window.__ecaRefreshInflight) {
    dlog("no inflight → creating one");
    window.__ecaRefreshInflight = (async () => {
      const ownerId = (globalThis.crypto?.randomUUID?.() || String(Math.random()));
      const acquired = tryAcquireLock(ownerId);
      if (!acquired) {
        dlog("lock held by another tab; waiting for signal");
        const ok = await waitForSignal(LOCK_TTL_MS + 2_000);
        dlog("wait complete", ok);
        if (!ok) markTerminated();
        return ok;
      }

      try {
        const ok = await doRefresh();
        dlog("resolve inflight", ok);
        setJson(SIGNAL_KEY, { status: ok ? "ok" : "fail", ts: now() } satisfies RefreshSignal);
        if (!ok) markTerminated();
        return ok;
      } finally {
        // Release cross-tab lock
        const cur = getJson<{ ownerId: string }>(LOCK_KEY);
        if (cur?.ownerId === ownerId) clearKey(LOCK_KEY);
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