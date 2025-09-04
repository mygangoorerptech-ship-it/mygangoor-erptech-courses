// src/admin/api/adCourses.ts
import { api } from './client'
import type { Course, CourseFilters } from '../types/course'

export async function listAdCourses(filters: CourseFilters) {
  const r = await api.get('/courses', { params: filters })
  return r.data as Course[]
}
