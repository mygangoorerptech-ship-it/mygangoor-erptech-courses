//mygf/src/components/pages/tracks/api.ts
import type { Course, Level } from "./types";
import { api } from "../../../api/client";

type RawCardsResponse = { items: any[]; nextCursor: string | null };
export type Audience = "public" | "org";

/** Parse common duration text forms like "3h 20m", "95m", "2h" → hours number. */
function parseDurationTextToHours(input: unknown): number {
  if (!input || typeof input !== "string") return 0;
  const s = input.trim().toLowerCase();

  // "3h 20m", "3h", "2 h", etc
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const mMatch = s.match(/(\d+(?:\.\d+)?)\s*m/);

  const h = hMatch ? parseFloat(hMatch[1]) : 0;
  const m = mMatch ? parseFloat(mMatch[1]) : 0;

  if (h || m) return Math.max(0, Math.round((h + m / 60) * 1) / 1);

  // fallback: pure minutes like "95"
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 0) return Math.max(0, Math.round((asNum / 60) * 1) / 1);

  return 0;
}

export async function fetchCoursesPage({
  cursor,
  limit = 12,
}: {
  cursor?: string | null;
  limit?: number;
  offset?: number;
  audience?: Audience;
  orgId?: string | null;
} = {}): Promise<{ items: Course[]; nextCursor: string | null }> {
  let payload: RawCardsResponse = { items: [], nextCursor: null };
  try {
    const res = await api.get<RawCardsResponse>(
      "/student-catalog/courses/cards",
      {
        params: { limit, cursor: cursor ?? undefined },
        withCredentials: false, // ✅ CRITICAL FIX
      }
    );
    console.log("✅ CARDS API:", res.data?.items?.[0]);
    const data = res.data;

if (Array.isArray(data)) {
  // fallback shape (old API)
  payload = { items: data, nextCursor: null };
} else {
  // expected shape
  payload = {
    items: Array.isArray(data?.items) ? data.items : [],
    nextCursor: data?.nextCursor ?? null,
  };
}
  } catch (err: any) {
    console.error("❌ PRIMARY API FAILED:", err?.response?.data || err.message);

    // ❌ DO NOT fallback (breaks centers)
    return { items: [], nextCursor: null };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];

  const accepted: Course[] = items.map((it: any, idx: number) => {
    const rating = Number.isFinite(it.rating) ? it.rating : (Number.isFinite(it.ratingAvg) ? it.ratingAvg : 0);
    const ratingCount = Number.isFinite(it.ratingCount) ? it.ratingCount : 0;

    // --- price math (paise) ---
    const rawPricePaise = Number.isFinite(it.pricePaise) ? Number(it.pricePaise) : (Number.isFinite(it.price) ? Number(it.price) : null);
    const rawDiscount = Number.isFinite(it.discountPercent) ? Number(it.discountPercent) : 0;
    const mrpPaise = rawPricePaise;
    const salePaise =
      mrpPaise != null && rawDiscount > 0
        ? Math.max(0, Math.round(mrpPaise * (1 - rawDiscount / 100)))
        : mrpPaise;

    // ✅ duration: prefer numeric durationHours from backend; fallback to durationText; else 0
    const durationHours =
      Number.isFinite(it.durationHours) && it.durationHours >= 0
        ? Number(it.durationHours)
        : parseDurationTextToHours(it.durationText ?? it.duration ?? null);

    const item: Course = {
      durationHours: Number.isFinite(durationHours) ? durationHours : 0,

      id: String(it.id ?? it._id ?? idx),
      title: String(it.title ?? "Untitled"),
      track: it.slug ?? null,
      pill: it.category ?? null,


      cover: (it.cover ?? it.bundleCoverUrl ?? it.coverUrl) ?? undefined,
      previewUrl: it.previewUrl ?? it.demoVideoUrl ?? undefined,

      rating,
      ratingCount,
      description: it.description ?? "",

      level: (() => {
        const lv = String(it.level ?? "all").toLowerCase();
        const map: Record<string, Level> = {
          beginner: "Beginner",
          intermediate: "Intermediate",
          advanced: "Advanced",
        };
        return map[lv] ?? "Beginner";
      })(),

      category: it.category ?? null,
      tags: Array.isArray(it.tags) ? it.tags : [],

      // keep existing public API
      price: undefined,
      pricePaise: mrpPaise,

      discountPercent: rawDiscount,
      orgName: it.orgName ?? null,
      centerIds: Array.isArray(it.centerIds) ? it.centerIds : [],
      centerNames: Array.isArray(it.centerNames) ? it.centerNames : [],
    };

    // attach computed fields without touching Course type
    Object.assign(item as any, { mrpPaise, salePaise });

    return item;
  });

  return { items: accepted, nextCursor: payload.nextCursor ?? null };
}
