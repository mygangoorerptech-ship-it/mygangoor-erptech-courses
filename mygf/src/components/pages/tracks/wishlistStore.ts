// src/components/pages/tracks/wishlistStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getWishlistIds, addWishlist, removeWishlist } from '../../../api/wishlist';

let _inited = false;

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
        if (_inited) return;
        _inited = true;
        try {
          const ids = await getWishlistIds(); // GET /api/student/wishlist
          set({ ids: new Set(ids), ready: true });
        } catch {
          // If unauthorized or network error, don't crash the page.
          // Keep whatever we have (from sessionStorage) and just mark ready.
          set({ ready: true });
        }
      },

      isWishlisted: (id: string) => get().ids.has(String(id)),

      // Optimistic toggle. Server receives POST /api/student/wishlist/toggle
      toggle: async (id: string) => {
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
