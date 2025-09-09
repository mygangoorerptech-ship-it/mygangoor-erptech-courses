// src/api/publicCatalog.ts

function resolveApiBase() {
  const raw = (import.meta as any)?.env?.VITE_API_URL?.trim() || "";
  if (!raw) return "/api"; // dev: vite proxy

  // Remove trailing slashes
  const cleaned = raw.replace(/\/+$/, "");
  // If it already ends with /api, use as-is; else append /api
  return /\/api$/i.test(cleaned) ? cleaned : `${cleaned}/api`;
}

const PUBLIC_BASE = resolveApiBase();

export type FeaturedCourse = {
  id: string;
  slug: string | null;
  title: string;
  courseType: "free" | "paid";
  price: number;
  coverUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  durationText?: string | null;
};

export type FeaturedPayload = { paid: FeaturedCourse[]; free: FeaturedCourse[] };

export async function getFeaturedCourses(): Promise<FeaturedPayload> {
  try {
    const res = await fetch(`${PUBLIC_BASE}/public/catalog/featured`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { paid: [], free: [] };
    const json = await res.json().catch(() => ({} as any));
    return {
      paid: Array.isArray(json?.paid) ? json.paid : [],
      free: Array.isArray(json?.free) ? json.free : [],
    };
  } catch {
    return { paid: [], free: [] };
  }
}
