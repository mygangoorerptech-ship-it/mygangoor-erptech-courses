// src/api/courses.ts
import { api } from './client'
import type { Course, CourseStatus } from '../admin/types/course'

export async function fetchCourses(params: { q?: string; status?: 'all' | CourseStatus }) {
  const r = await api.get('/courses', { params })
  return r.data as Course[]
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
