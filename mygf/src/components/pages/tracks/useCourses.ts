// mygf/src/components/pages/tracks/useCourses.ts
import { useEffect, useMemo } from "react";
import { useCatalogStore } from "./store";
// ⬇️ read user/roles/orgId from your auth store (no changes to auth code)
import { useAuth } from "../../../auth/store";
import type { Audience } from "./api";

function useAudience() {
  const { user } = useAuth();
  const roles: string[] = useMemo(() => {
    const r = (user as any)?.roles || ((user as any)?.role ? [(user as any).role] : []);
    return Array.isArray(r) ? r.map(String) : [];
  }, [user]);

  const orgIdRaw = (user as any)?.orgId ?? null;
  const isOrg = !!orgIdRaw && roles.some((r) => {
    const v = String(r).toLowerCase();
    return v === "orguser" || v === "orgadmin";
  });

  const audience: Audience = isOrg ? "org" : "public"; // ← no `as const`
  const orgId = isOrg ? String(orgIdRaw) : undefined;

  return { audience, orgId };
}

export function useCourses(opts?: { enabled?: boolean } = {}) {
  const enabled = opts?.enabled ?? true;
  const { audience, orgId } = useAudience();

  const items         = useCatalogStore((s) => s.items);
  const loading       = useCatalogStore((s) => s.loading);
  const prefetching   = useCatalogStore((s) => s.prefetching);
  const error         = useCatalogStore((s) => s.error);
  const loadedOnce    = useCatalogStore((s) => s.loadedOnce);
  const nextCursor    = useCatalogStore((s) => s.nextCursor);
  const refresh       = useCatalogStore((s) => s.refresh);
  const smartLoadMore = useCatalogStore((s) => s.smartLoadMore);
  const prefetchNext  = useCatalogStore((s) => s.prefetchNext);
  const fetchNext     = useCatalogStore((s) => s.fetchNext);

  const invalidate = useCatalogStore((s) => s.invalidate);

useEffect(() => {
  invalidate();
}, [audience, orgId]);

  // Initial load for this audience
  useEffect(() => {
    if (!enabled) return;
    if (!loadedOnce && !loading) fetchNext({ audience, orgId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadedOnce, loading, audience, orgId]);

  // Prefetch the next page for this audience
  useEffect(() => {
    if (!enabled) return;
    if (loadedOnce && !loading && nextCursor !== null) prefetchNext({ audience, orgId });
  }, [enabled, items.length, loadedOnce, loading, nextCursor, audience, orgId, prefetchNext]);

  return {
    data: items,
    loading,
    prefetching,
    error,
    reload: () => refresh({ audience, orgId }),
    loadMore: () => smartLoadMore({ audience, orgId }),
    hasMore: nextCursor !== null,
    loadedOnce,
  };
}
