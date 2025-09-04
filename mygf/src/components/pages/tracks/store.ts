import { create } from "zustand";
import type { Course } from "./types";
import { fetchCoursesPage, type Audience } from "./api";

type CatalogState = {
  items: Course[];
  nextCursor: string | null;

  // prefetch buffer
  buffer: Course[];
  bufferNextCursor: string | null;

  loadedOnce: boolean;
  loading: boolean;
  prefetching: boolean;
  error: string | null;

  // load APIs (audience passed per call; orgId is NOT stored)
  fetchNext:   (opts: { audience: Audience; orgId?: string | null }) => Promise<void>;
  prefetchNext:(opts: { audience: Audience; orgId?: string | null }) => Promise<void>;
  consumeBuffered: () => boolean;
  smartLoadMore:(opts: { audience: Audience; orgId?: string | null }) => Promise<void>;

  refresh: (opts: { audience: Audience; orgId?: string | null }) => Promise<void>;
  invalidate: () => void;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  nextCursor: null,

  buffer: [],
  bufferNextCursor: null,

  loadedOnce: false,
  loading: false,
  prefetching: false,
  error: null,

  fetchNext: async ({ audience, orgId }) => {
    const { loading, nextCursor, items } = get();
    if (loading) return;
    if (nextCursor === null && items.length > 0) return;

    set({ loading: true, error: null });
    try {
      const { items: page, nextCursor: nc } = await fetchCoursesPage({
        cursor: items.length ? nextCursor : undefined,
        limit: 12,
        offset: items.length,
        audience,
        orgId,
      });

      const seen = new Set(items.map((i) => i.id));
      const merged = [...items];
      for (const c of page) if (!seen.has(c.id)) merged.push(c);

      set({
        items: merged,
        nextCursor: nc,
        loadedOnce: true,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      set({ loading: false, error: e?.message || "Failed to load courses" });
    }
  },

  prefetchNext: async ({ audience, orgId }) => {
    const { prefetching, nextCursor, buffer, items } = get();
    if (prefetching) return;
    if (buffer.length > 0) return;
    if (nextCursor === null) return;

    set({ prefetching: true });
    try {
      const { items: page, nextCursor: nc } = await fetchCoursesPage({
        cursor: nextCursor!,
        limit: 12,
        offset: items.length,
        audience,
        orgId,
      });
      set({ buffer: page, bufferNextCursor: nc, prefetching: false });
    } catch {
      set({ prefetching: false });
    }
  },

  consumeBuffered: () => {
    const { buffer, items, bufferNextCursor } = get();
    if (!buffer.length) return false;

    const seen = new Set(items.map((i) => i.id));
    const merged = [...items];
    for (const c of buffer) if (!seen.has(c.id)) merged.push(c);

    set({
      items: merged,
      nextCursor: bufferNextCursor ?? null,
      buffer: [],
      bufferNextCursor: null,
      loadedOnce: true,
    });
    return true;
  },

  smartLoadMore: async (opts) => {
    const consumed = get().consumeBuffered();
    if (!consumed) await get().fetchNext(opts);
    await get().prefetchNext(opts);
  },

  refresh: async (opts) => {
    set({
      items: [],
      nextCursor: null,
      buffer: [],
      bufferNextCursor: null,
      loadedOnce: false,
      error: null,
    });
    await get().fetchNext(opts);
    await get().prefetchNext(opts);
  },

  invalidate: () => {
    set({
      items: [],
      nextCursor: null,
      buffer: [],
      bufferNextCursor: null,
      loadedOnce: false,
      error: null,
    });
  },
}));
