// src/api/students.ts
import { api } from './client';

export async function listStudents(params?: { q?: string; limit?: number; lite?: 1 }) {
  const r = await api.get('/students', { params });
  return Array.isArray(r.data) ? r.data : [];
}
