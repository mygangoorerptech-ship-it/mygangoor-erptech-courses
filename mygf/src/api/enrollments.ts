// src/api/enrollments.ts
import { api } from './client';
import type { Enrollment } from '../types/enrollment';

export async function listOrgEnrollments(params?: { studentId?: string; courseId?: string; status?: string }): Promise<Enrollment[]> {
  const r = await api.get('/enrollments/org', { params });
  return r.data || [];
}

export async function myEnrollments(): Promise<Enrollment[]> {
  const r = await api.get('/enrollments/me');
  return r.data || [];
}
