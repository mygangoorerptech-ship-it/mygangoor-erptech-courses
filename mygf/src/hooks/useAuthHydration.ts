// src/hooks/useAuthHydration.ts
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/store";
import { checkSession } from "../api/auth";

/**
 * Public routes: previously we avoided calling /auth/check unless we had a
 * localStorage hint. We've removed localStorage; instead we keep a volatile
 * in-memory hint in the auth store (`hadRefreshHint`) that's set after a
 * successful login in this tab. This preserves the old behaviour (no extra
 * 401s on fully public pages) without persisting anything to disk.
 */
const PUBLIC_PREFIXES = ["/", "/home", "/login", "/signup", "/forgot-password", "/reset-password"];
const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** one-flight across the tab */
let hydrationOnce = false;

export function useAuthHydration() {
  const { user, hadRefreshHint, setUser } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;

    // On private paths: always try once. On public paths: only if we have the hint.
    const shouldPing = !user && (!isPublicPath(pathname) || hadRefreshHint);

    if (!shouldPing || hydrationOnce) {
      // nothing to do; treat as hydrated for public pages
      setIsHydrated(true);
      return;
    }

    hydrationOnce = true;
    setIsLoading(true);

    (async () => {
      try {
        const res = await checkSession();
        if (!cancelled && res?.ok && res?.user) {
          setUser(res.user);
        }
      } catch {
        // ignore 401/419
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, hadRefreshHint, pathname, setUser]);

  return { user: user || null, isHydrated, isLoading };
}

/** Compatibility shim for places that call this after logout */
export function resetAuthHydration() {
  hydrationOnce = false;
}
