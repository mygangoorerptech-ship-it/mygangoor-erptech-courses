// src/api/enrollments.ts
import { api } from './client';
import type { Enrollment, EnrollmentListPage } from '../types/enrollment';

export async function listOrgEnrollments(params?: {
  studentId?: string;
  courseId?: string;
  status?: string;
  /** Page number (1-based). Sent to backend after M-3 pagination fix. */
  page?: number;
  /** Items per page. Backend default is 100, hard cap 500. */
  limit?: number;
}): Promise<Enrollment[]> {
  const r = await api.get('/enrollments/org', { params });
  // Phase 2 — backward-compatible normalization.
  // Old backend: returns Enrollment[] directly.
  // New backend: returns { items, total, page, pageSize }.
  // Both shapes are handled safely; callers always receive Enrollment[].
  const data: Enrollment[] | EnrollmentListPage = r.data;
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function myEnrollments(): Promise<Enrollment[]> {
  const r = await api.get('/enrollments/me');
  // /enrollments/me (ctrl.my) was NOT paginated — still returns Enrollment[] directly.
  return r.data || [];
}
