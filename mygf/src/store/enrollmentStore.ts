// src/store/enrollmentStore.ts
// Single source of truth for student enrollment / premium-access state.
//
// Rules (enforced here, not by callers):
//   • premiumIds is the authoritative Set shown in the UI.
//   • optimisticIds holds IDs added post-payment-confirmation that have not yet
//     been confirmed by a server sync. They survive exactly one sync cycle.
//   • After each setFromServer() call, premiumIds is REPLACED with the union of
//     server-confirmed IDs and any still-pending optimisticIds, then optimisticIds
//     is cleared. This makes server-side revocations visible after the next fetch
//     without regressing the optimistic unlock UX.
//   • IDs are ALWAYS stored as String(...) for consistent matching.
//   • fetchActive() is idempotent: concurrent calls are deduplicated by the
//     loading flag. Only ONE fetch is ever in-flight at a time.
import { create } from "zustand";
import { api } from "../api/client";

type EnrollmentStore = {
  /** Authoritative Set of course IDs the current user has premium access to. */
  premiumIds: Set<string>;

  /**
   * Transient Set of course IDs added optimistically (post-payment-confirmation)
   * that have not yet been confirmed by a server sync.
   * Cleared by setFromServer() after each sync cycle.
   */
  optimisticIds: Set<string>;

  /**
   * Monotonic counter incremented by refresh().
   * Components add it to their useEffect dependency array to re-fetch
   * enrollment state from the server (e.g., 4 s after a payment).
   */
  tick: number;

  /** True while fetchActive() is in-flight. */
  loading: boolean;

  /**
   * Instantly unlocks a course in the UI (post-payment-confirmation update).
   * Adds to BOTH optimisticIds and premiumIds so the unlock is immediate.
   * The ID survives until the next setFromServer() call, which either confirms
   * it (server returns it) or drops it (server does not return it — e.g. refund).
   */
  addOptimistic: (id: string) => void;

  /**
   * Replaces premiumIds with the union of server-confirmed IDs and any still-pending
   * optimisticIds, then clears optimisticIds.
   * This makes revocations visible after each sync while preserving optimistic unlocks
   * that haven't been through a sync cycle yet.
   */
  setFromServer: (ids: string[]) => void;

  /**
   * Increments tick → triggers re-fetch in subscribed components.
   * Call with a setTimeout delay so the backend has time to commit the
   * enrollment before we ask for it.
   */
  refresh: () => void;

  /**
   * Fetches /student/enrollments/active and replaces premiumIds with the
   * authoritative server result (plus any pending optimistic IDs).
   * Safe to call from multiple components simultaneously — deduplicated by
   * the loading flag.
   */
  fetchActive: () => Promise<void>;
};

export const useEnrollmentStore = create<EnrollmentStore>((set, get) => ({
  premiumIds: new Set(),
  optimisticIds: new Set(),
  tick: 0,
  loading: false,

  addOptimistic: (id) =>
    set((s) => {
      const sid = String(id);
      return {
        optimisticIds: new Set([...s.optimisticIds, sid]),
        premiumIds: new Set([...s.premiumIds, sid]),
      };
    }),

  // RF-1: replace-semantics — premiumIds becomes server truth ∪ pending optimistic IDs.
  // Revocations processed by the server are now reflected after the next sync.
  setFromServer: (ids) =>
    set((s) => {
      const serverSet = new Set(ids.map(String).filter(Boolean));
      // Preserve optimistic IDs that haven't been through a sync yet
      s.optimisticIds.forEach((id) => serverSet.add(id));
      return {
        premiumIds: serverSet,
        optimisticIds: new Set(), // cleared: this sync cycle is their confirmation window
      };
    }),

  refresh: () =>
    set((s) => ({ tick: s.tick + 1 })),

  fetchActive: async () => {
    // Deduplicate concurrent calls — only one fetch in-flight at a time.
    if (get().loading) return;
    set({ loading: true });
    try {
      console.log(
        "[ENROLLMENTS] fetchActive:start",
        {
          loading: get().loading,
          tick: get().tick,
          time: new Date().toISOString(),
        }
      );
      const res = await api.get("/student/enrollments/active", { withCredentials: true });
      console.log(
        "[ENROLLMENTS] fetchActive:response",
        {
          status: res?.status,
          data: res?.data,
        }
      );

      // Handle both { items: [] } and flat [] response shapes
      const raw = res?.data;
      const items: unknown[] =
        Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw)
            ? raw
            : [];

      const ids = (items as Record<string, unknown>[])
        .filter((e) =>
          // ONLY confirmed enrollment states belong in premiumIds.
          // DO NOT treat payment-only states as enrolled premium access.
          e.premium === true ||
          e.status === "premium" ||
          e.access === "premium"
        )
        // Robust ID extraction: camelCase + snake_case + nested + direct
        .map((e) =>
          String(
            e.courseId ??
            e.course_id ??
            (e.course as Record<string, unknown>)?.id ??
            e.id ??
            ""
          )
        )
        .filter(Boolean);

      // Replace — never merge — so revocations are reflected.
      get().setFromServer(ids);
    } catch (e: any) {
      console.error(
        "[ENROLLMENTS] fetchActive:error",
        e?.response?.data || e?.message || e
      );
    } finally {
      console.log(
        "[ENROLLMENTS] fetchActive:end"
      );
      set({ loading: false });
    }
  },
}));
