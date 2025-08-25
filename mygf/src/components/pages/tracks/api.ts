// mygf/src/components/pages/tracks/api.ts
import { COURSES } from "./data";
import type { Course } from "./types";

/**
 * Fake API — replace with real fetch later.
 * Simulates latency and optional failures.
 */
export async function fetchCourses(): Promise<Course[]> {
  // simulate network delay
  await new Promise((r) => setTimeout(r, 900));

  // optional: simulate an intermittent failure (comment out if you hate surprises)
  // if (Math.random() < 0.08) throw new Error("Network error");

  // you can clone/expand the list to feel more “real”
  const extra = COURSES.map((c, i) => ({
    ...c,
    id: `dup-${i}`,
    title: c.title + " (Alt)",
  }));
  return [...COURSES, ...extra];
}
