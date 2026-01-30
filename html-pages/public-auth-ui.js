// Shared public auth UI helpers (HTML pages only)
(function () {
  const apiBase = window.API_BASE_URL || "/api";
  const LOCK_KEY = "eca:auth:refresh_lock";
  const SIGNAL_KEY = "eca:auth:refresh_signal";
  const TERMINATED_KEY = "eca:auth:terminated";
  const LOCK_TTL_MS = 12000;

  function getReturnUrl() {
    return encodeURIComponent(window.location.pathname + window.location.search);
  }

  function now() { return Date.now(); }

  function getJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function clearKey(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function isTerminatedRecent() {
    const t = getJson(TERMINATED_KEY);
    return !!(t && t.ts && now() - t.ts < 5 * 60 * 1000);
  }

  function markTerminated() {
    setJson(TERMINATED_KEY, { ts: now() });
  }

  function tryAcquireLock(ownerId) {
    const cur = getJson(LOCK_KEY);
    if (cur && cur.ts && now() - cur.ts < LOCK_TTL_MS) return false;
    setJson(LOCK_KEY, { ownerId, ts: now() });
    const confirm = getJson(LOCK_KEY);
    return confirm && confirm.ownerId === ownerId;
  }

  function waitForSignal(timeoutMs) {
    return new Promise((resolve) => {
      const start = now();
      function check() {
        const sig = getJson(SIGNAL_KEY);
        if (sig && sig.status === "ok") return cleanup(true);
        if (sig && sig.status === "fail") return cleanup(false);
        if (now() - start > timeoutMs) return cleanup(false);
        setTimeout(check, 200);
      }
      function onStorage(e) {
        if (e.key !== SIGNAL_KEY) return;
        const sig = getJson(SIGNAL_KEY);
        if (sig && sig.status === "ok") cleanup(true);
        if (sig && sig.status === "fail") cleanup(false);
      }
      function cleanup(ok) {
        window.removeEventListener("storage", onStorage);
        resolve(ok);
      }
      window.addEventListener("storage", onStorage);
      check();
    });
  }

  let inflightRefresh = null;
  async function refreshOnce() {
    if (isTerminatedRecent()) return false;
    if (inflightRefresh) return inflightRefresh;

    inflightRefresh = (async () => {
      const ownerId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());
      const acquired = tryAcquireLock(ownerId);
      if (!acquired) {
        const ok = await waitForSignal(LOCK_TTL_MS + 2000);
        if (!ok) markTerminated();
        return ok;
      }

      try {
        const res = await fetch(`${apiBase}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        const ok = !!res.ok;
        setJson(SIGNAL_KEY, { status: ok ? "ok" : "fail", ts: now() });
        if (!ok) markTerminated();
        return ok;
      } catch {
        setJson(SIGNAL_KEY, { status: "fail", ts: now() });
        markTerminated();
        return false;
      } finally {
        const cur = getJson(LOCK_KEY);
        if (cur && cur.ownerId === ownerId) clearKey(LOCK_KEY);
        await Promise.resolve();
        inflightRefresh = null;
      }
    })();

    return inflightRefresh;
  }

  async function checkWithSilentRefresh() {
    const first = await fetch(`${apiBase}/auth/check`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = await first.json().catch(() => ({ ok: false }));
    if (data && data.ok && data.user) return data;

    const ok = await refreshOnce();
    if (!ok) return { ok: false };

    const second = await fetch(`${apiBase}/auth/check`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return await second.json().catch(() => ({ ok: false }));
  }

  function setDashboardVisible(visible) {
    const dashboardNavItem = document.getElementById("dashboardNavItem");
    if (dashboardNavItem) {
      dashboardNavItem.style.display = visible ? "list-item" : "none";
    }
  }

  async function checkAuthAndShowDashboard() {
    try {
      const data = await checkWithSilentRefresh();
      setDashboardVisible(!!(data && data.ok && data.user));
    } catch (error) {
      console.error("Error checking authentication for dashboard icon:", error);
      setDashboardVisible(false);
    }
  }

  async function handleDashboardClick(event) {
    event.preventDefault();
    try {
      const data = await checkWithSilentRefresh();

      if (data && data.ok && data.user) {
        const role = String(data.user.role || "").toLowerCase();
        if (role.startsWith("org")) {
          window.location.href = "/dashboard";
          return;
        }
        switch (role) {
          case "superadmin":
            window.location.href = "/superadmin";
            break;
          case "admin":
            window.location.href = "/admin";
            break;
          case "vendor":
            window.location.href = "/vendor";
            break;
          case "student":
            window.location.href = "/dashboard";
            break;
          default:
            window.location.href = "/dashboard";
        }
      } else {
        // Terminal session condition: do a best-effort server logout then redirect.
        try {
          await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
        } catch {}
        window.location.href = `/login.html?returnUrl=${getReturnUrl()}`;
      }
    } catch (error) {
      console.error("Error navigating to dashboard:", error);
      try {
        await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
      } catch {}
      window.location.href = `/login.html?returnUrl=${getReturnUrl()}`;
    }
  }

  // Expose a small public surface for other static scripts (notification bell, etc.)
  window.__ecaAuth = {
    refreshOnce,
    checkWithSilentRefresh,
    isTerminatedRecent,
  };

  window.handleDashboardClick = handleDashboardClick;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAuthAndShowDashboard);
  } else {
    checkAuthAndShowDashboard();
  }
})();
