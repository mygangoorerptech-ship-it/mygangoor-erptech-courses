// src/components/pages/tracks/wishlistStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getWishlistIds, addWishlist, removeWishlist } from '../../../api/wishlist';

let _initedForUser: string | null = null;

type State = {
  ids: Set<string>;
  ready: boolean;
  init: () => Promise<void>;
  isWishlisted: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
};

export const useWishlist = create<State>()(
  persist(
    (set, get) => ({
      ids: new Set<string>(),
      ready: false,

      // Call ONLY after auth is ready to avoid 401s
      init: async () => {
        /**
         * Guest users must never hit protected wishlist API.
         * Also reset state correctly across login/logout
         * and different users.
         */
        const authState =
          typeof window !== "undefined"
            ? (await import("../../../auth/store")).useAuth.getState()
            : null;

        const currentUserId = authState?.user?.id
          ? String(authState.user.id)
          : null;

        /**
         * Guest mode:
         * clear stale previous-user wishlist state
         */
        if (!currentUserId) {
          _initedForUser = null;

          set({
            ids: new Set<string>(),
            ready: true,
          });

          return;
        }

        /**
         * Already initialized for this same user
         */
        if (_initedForUser === currentUserId) {
          set({ ready: true });
          return;
        }

        /**
         * New login OR switched user
         */
        _initedForUser = currentUserId;

        try {
          const ids = await getWishlistIds();

          set({
            ids: new Set(ids),
            ready: true,
          });
        } catch {
          /**
           * Never break public page rendering
           */
          set({
            ids: new Set<string>(),
            ready: true,
          });
        }
      },

      isWishlisted: (id: string) => get().ids.has(String(id)),

      // Optimistic toggle. Server receives POST /api/student/wishlist/toggle
      toggle: async (id: string) => {
        const authState =
          typeof window !== "undefined"
            ? (await import("../../../auth/store")).useAuth.getState()
            : null;

        if (!authState?.user?.id) {
          throw new Error("Login required");
        }
        const key = String(id);
        const before = get().ids;
        const has = before.has(key);

        const next = new Set(before);
        if (has) next.delete(key);
        else next.add(key);
        set({ ids: next });

        try {
          if (has) await removeWishlist(key);
          else await addWishlist(key);
        } catch {
          set({ ids: before }); // revert on failure
          throw new Error('Failed to update wishlist');
        }
      },
    }),
    {
      name: 'wishlist',
      storage: createJSONStorage(() => sessionStorage),
      // Persist only the ids; rehydrate them into a Set
      partialize: (s) => ({ ids: Array.from(s.ids) as any } as any),
      merge: (persisted: any, current: any) => {
        try {
          const ids = new Set<string>(
            Array.isArray(persisted?.state?.ids) ? persisted.state.ids : []
          );
          return { ...current, ids };
        } catch {
          return current;
        }
      },
    }
  )
);
