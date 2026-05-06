// src/api/courses.ts
import { api } from './client'
import type { Course, CourseStatus } from '../admin/types/course'
type CoursePayload = Partial<Course> & {
  centerIds?: string[]
}

export async function fetchCourses(params: { q?: string; status?: 'all' | CourseStatus }) {
  const r = await api.get('/courses', { params })

  // ✅ handle both formats: [] OR { items: [] }
  if (Array.isArray(r.data)) return r.data as Course[]
  if (Array.isArray(r.data?.items)) return r.data.items as Course[]

  return []
}
export async function createCourse(payload: CoursePayload) {
  const r = await api.post('/courses', payload)
  return r.data as Course
}
export async function updateCourse(id: string, patch: CoursePayload) {
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
