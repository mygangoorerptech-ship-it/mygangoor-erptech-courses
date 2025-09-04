import { create } from "zustand";
import { api } from "../../../api/client";
import type { CourseOption } from "../types";

export type CatalogState = {
  courses: CourseOption[];
  loading: boolean;
  error: string;
  lastFetchedAt: number | null;
  fetch: (opts?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

type RawCourse = any; // backend shape varies a bit across endpoints

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useJoinCatalog = create<CatalogState>((set, get) => ({
  courses: [],
  loading: false,
  error: "",
  lastFetchedAt: null,

  async fetch(opts) {
    const force = !!opts?.force;
    const { lastFetchedAt, courses, loading } = get();
    const now = Date.now();

    if (!force && !loading && lastFetchedAt && now - lastFetchedAt < TTL_MS && courses.length > 0) return;

    set({ loading: true, error: "" });
    try {
      // keep your existing endpoint; it already returns the data you need in most cases
      const res = await api.get("student-catalog/courses", { withCredentials: true });
      // accept either an array or { items: [...] }
      const raw: RawCourse[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : [];

      const list: CourseOption[] = raw.map((rc: RawCourse, idx: number) => {
        const id = String(rc.id ?? rc._id ?? idx);
        const title = String(rc.title ?? "Untitled");

        // ----- price & discount (match /tracks logic) -----
        // Prefer paise. If backend sent rupees earlier, we’ll convert.
        const rawPricePaise =
          Number.isFinite(rc.price) ? Number(rc.price) :
          Number.isFinite(rc.pricePaise) ? Number(rc.pricePaise) :
          null;

        const discountPercent = Number.isFinite(rc.discountPercent) ? Number(rc.discountPercent) : 0;

        const mrpPaise = rawPricePaise;
        const salePaise =
          mrpPaise != null && discountPercent > 0
            ? Math.max(0, Math.round(mrpPaise * (1 - discountPercent / 100)))
            : mrpPaise;

        // ----- visuals used by the card (all optional) -----
        const cover = rc.cover ?? rc.bundleCoverUrl ?? rc.coverUrl ?? undefined;
        const pill = rc.category ?? null;
        const track = rc.slug ?? null;

        // Level mapping like /tracks (fallback "Beginner")
        const level = (() => {
          const s = String(rc.level ?? "all").toLowerCase();
          if (s === "beginner") return "Beginner";
          if (s === "intermediate") return "Intermediate";
          if (s === "advanced") return "Advanced";
          return "Beginner";
        })();

        const rating = Number.isFinite(rc.rating) ? Number(rc.rating) : 0;
        const ratingCount = Number.isFinite(rc.ratingCount) ? Number(rc.ratingCount) : 0;
        const durationHours = Number.isFinite(rc.durationHours) ? Number(rc.durationHours) : undefined;

        // Keep your existing public shape (price in rupees for forms/UI)
        const item: CourseOption = {
          id,
          title,
          duration: rc.duration ?? (durationHours ? `${durationHours}h` : ""),
          price: mrpPaise != null ? Math.round(mrpPaise / 100) : 0, // ✅ preserves previous consumers
        };

        // Attach extended fields (TS-safe without changing CourseOption type)
        Object.assign(item as any, {
          cover,
          pill,
          track,
          level,
          rating,
          ratingCount,
          durationHours,

          // pricing fields used by Join → CourseStep (mirrors /tracks)
          pricePaise: mrpPaise,
          mrpPaise,
          salePaise,
          discountPercent,
        });

        return item;
      });

      // Keep your existing "same list" cheap equality (don’t churn state unnecessarily)
      const current = get().courses;
      const same =
        list.length === current.length &&
        list.every((c, i) =>
          c.id === current[i]?.id &&
          c.title === current[i]?.title &&
          c.duration === current[i]?.duration &&
          c.price === current[i]?.price
        );

      if (!same) set({ courses: list });
      set({ lastFetchedAt: now, loading: false, error: "" });
    } catch {
      set({ error: "Could not load courses. Please try again.", loading: false });
    }
  },

  invalidate() {
    set({ lastFetchedAt: null });
  },
}));
