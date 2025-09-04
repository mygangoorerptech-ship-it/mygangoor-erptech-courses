// src/components/pages/tracks/wishlistStore.ts
import { create } from 'zustand';
import { getWishlistIds, addWishlist, removeWishlist } from '../../../api/wishlist';

let _inited = false;

type State = {
  ids: Set<string>;
  ready: boolean;
  init: () => Promise<void>;
  isWishlisted: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
};

export const useWishlist = create<State>((set, get) => ({
  ids: new Set<string>(),
  ready: false,

  async init() {
    if (_inited) return;
    _inited = true;
    try {
      const ids = await getWishlistIds();
      set({ ids: new Set(ids), ready: true });
    } catch {
      set({ ids: new Set(), ready: true });
    }
  },

  isWishlisted(id) {
    return get().ids.has(String(id));
  },

  async toggle(id) {
    const key = String(id);
    const before = new Set(get().ids);
    const has = before.has(key);

    // optimistic update
    const next = new Set(before);
    if (has) next.delete(key);
    else next.add(key);
    set({ ids: next });

    try {
      if (has) await removeWishlist(key);
      else await addWishlist(key);
    } catch {
      // revert on failure
      set({ ids: before });
      throw new Error('Failed to update wishlist');
    }
  },
}));