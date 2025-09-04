// src/admin/api/courses.ts
import { api } from './client'
import type { Course, CourseFilters, CourseStatus } from '../types/course'

// Admin + Vendor org-scoped surface -> /courses
export async function listCourses(filters: CourseFilters) {
  const r = await api.get('/courses', { params: filters })
  const data = r.data
  if (Array.isArray(data)) {
    return { items: data as Course[], total: data.length, page: 1, pageSize: data.length }
  }
  return data as { items: Course[]; total: number; page: number; pageSize: number }
}

export async function createCourse(payload: Partial<Course>) {
  const r = await api.post('/courses', payload)
  return r.data as Course
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const r = await api.patch(`/courses/${id}`, patch)
  return r.data as Course
}

export async function deleteCourse(id: string) {
  const r = await api.delete(`/courses/${id}`)
  return r.data as any
}

export async function setCourseStatus(id: string, status: CourseStatus) {
  const r = await api.post(`/courses/${id}/status`, { status })
  return r.data as Course
}

// Back-compat for existing imports
export function fetchCourses(filters: CourseFilters) {
  return listCourses(filters)
}

export async function bulkUpsertCourses(rows: any[]) {
  const r = await api.post('/courses/bulk-upsert', { rows })
  return r.data as { created: number; updated: number; total: number }
}