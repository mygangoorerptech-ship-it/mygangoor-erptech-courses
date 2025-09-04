// src/admin/api/saCourses.ts
import { api } from './client'
import type { Course, CourseFilters, CourseStatus } from '../types/course'

export async function listSaCourses(filters: CourseFilters) {
  const r = await api.get('/sa/courses', { params: filters })
  const data = r.data
  if (Array.isArray(data)) {
    return { items: data as Course[], total: data.length, page: 1, pageSize: data.length }
  }
  return data as { items: Course[]; total: number; page: number; pageSize: number }
}
export async function createSaCourse(payload: Partial<Course>) {
  const r = await api.post('/sa/courses', payload)
  return r.data as Course
}
export async function updateSaCourse(id: string, patch: Partial<Course>) {
  const r = await api.patch(`/sa/courses/${id}`, patch)
  return r.data as Course
}
export async function deleteSaCourse(id: string) {
  const r = await api.delete(`/sa/courses/${id}`)
  return r.data as any
}
export async function setSaCourseStatus(id: string, status: CourseStatus) {
  const r = await api.post(`/sa/courses/${id}/status`, { status })
  return r.data as Course
}

export async function bulkUpsertSaCourses(rows: any[]) {
  const r = await api.post('/sa/courses/bulk-upsert', { rows })
  return r.data as { created: number; updated: number; total: number }
}