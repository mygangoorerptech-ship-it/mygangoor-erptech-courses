// mygf/src/hooks/useAuthHydration.ts
import { useEffect, useState } from "react";
import { useAuth } from "../auth/store";
import { checkSession } from "../api/auth";

/**
 * Module-scoped guards so multiple components don't all call /auth/check
 */
let hydratedOnce = false;
let inflight: Promise<void> | null = null;

export function resetAuthHydration() {
  hydratedOnce = false;
  inflight = null;
}

/**
 * One-time auth hydration from cookie-based session.
 * Keeps design/UX untouched; just fills Zustand with the current user.
 */
export function useAuthHydration() {
  const { user, login: setAuthUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(hydratedOnce || !!user);

  useEffect(() => {
    if (hydratedOnce || user) {
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const run = async () => {
      if (inflight) {
        await inflight;
      } else {
        inflight = (async () => {
          try {
            const res = await checkSession();
            if (!cancelled && res?.ok && res.user) {
              // tokens are cookie-based; store user only
              setAuthUser({ user: res.user, tokens: undefined } as any);
            }
          } finally {
            hydratedOnce = true;
            inflight = null;
          }
        })();
        await inflight;
      }

      if (!cancelled) {
        setIsLoading(false);
        setIsHydrated(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user, setAuthUser]);

  return { user: user || null, isHydrated, isLoading };
}
