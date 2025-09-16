// src/admin/api/courses.ts
import { api } from "./client";
import type { Course, CourseFilters, CourseStatus } from "../types/course";

/**
 * Some stacks expose courses at different admin surfaces:
 * - /api/courses
 * - /api/admin/courses
 * - /api/sa/courses
 * - /api/catalog/courses   (fallback used by catalog surfaces)
 *
 * We keep the same listCourses() signature and try known paths in order.
 * This DOES NOT change the calling logic anywhere else.
 */
const COURSE_PATH_CANDIDATES = [
  "/courses",
  "/admin/courses",
  "/sa/courses",
  "/catalog/courses",
];

// Normalizes both array + paged responses
function normalize(data: any) {
  if (Array.isArray(data)) {
    return { items: data as Course[], total: data.length, page: 1, pageSize: data.length };
  }
  return data as { items: Course[]; total: number; page: number; pageSize: number };
}

// Admin + Vendor org-scoped surface -> /courses (or fallbacks)
export async function listCourses(filters: CourseFilters) {
  let lastErr: any = null;

  for (const path of COURSE_PATH_CANDIDATES) {
    try {
      const r = await api.get(path, { params: filters });
      return normalize(r.data);
    } catch (err: any) {
      // If it's an auth error, bubble up so your refresh gate/guards can handle it.
      const status = err?.response?.status;
      if (status && status !== 404) throw err;
      // Otherwise, try the next candidate
      lastErr = err;
    }
  }

  // If we get here, none of the candidates exist on this env
  const e = new Error("courses-endpoint-not-found");
  (e as any).cause = lastErr;
  throw e;
}

export async function createCourse(payload: Partial<Course>) {
  // Keep current path for create/update/delete (unchanged logic)
  const r = await api.post("/courses", payload);
  return r.data as Course;
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const r = await api.patch(`/courses/${id}`, patch);
  return r.data as Course;
}

export async function deleteCourse(id: string) {
  const r = await api.delete(`/courses/${id}`);
  return r.data as any;
}

export async function setCourseStatus(id: string, status: CourseStatus) {
  const r = await api.post(`/courses/${id}/status`, { status });
  return r.data as Course;
}

// Back-compat for existing imports
export function fetchCourses(filters: CourseFilters) {
  return listCourses(filters);
}

export async function bulkUpsertCourses(rows: any[]) {
  const r = await api.post("/courses/bulk-upsert", { rows });
  return r.data as { created: number; updated: number; total: number };
}
