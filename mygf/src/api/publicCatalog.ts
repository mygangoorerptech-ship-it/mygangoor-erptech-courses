// src/api/publicCatalog.ts
import { api } from "./client";

export type FeaturedCourse = {
  id: string;
  slug: string | null;
  title: string;
  courseType: "free" | "paid";
  price: number;           // paise
  coverUrl?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  durationText?: string | null;
};

export type FeaturedPayload = { paid: FeaturedCourse[]; free: FeaturedCourse[] };

export async function getFeaturedCourses(): Promise<FeaturedPayload> {
  const r = await api.get("/public/catalog/featured");
  const data = r.data ?? {};
  return {
    paid: Array.isArray(data.paid) ? data.paid : [],
    free: Array.isArray(data.free) ? data.free : [],
  };
}
