// src/api/courses.ts
import { api } from './client'
import { USE_MOCK } from './env'
import { CoursesDB } from './mockdb'
import type { Course, CourseFilters, CourseStatus } from '../types/course'
import { logAudit } from '../api/audit'

export function listCourses(filters: CourseFilters){
  if (USE_MOCK) return (CoursesDB as any).list(filters)
  return api.get('/courses', { params: filters }).then(r => r.data as Course[])
}

export function createCourse(payload: Omit<Course,'id'|'createdAt'|'updatedAt'>){
  if (USE_MOCK) {
    // mock DB wants createdAt present in the input type
    const withTimestamps = { ...payload, createdAt: new Date().toISOString() } as Omit<Course,'id'|'updatedAt'>
    return (CoursesDB as any).create(withTimestamps).then((rec: Course) => {
      logAudit({ action:'create', resource:'course', resourceId: rec.id, orgId: (rec as any).orgId, message:`Created course ${rec.title}`, after: rec })
      return rec
    })
  }
  return api.post('/courses', payload).then(r => r.data as Course)
}

export function updateCourse(id: string, patch: Partial<Course>){
  if (USE_MOCK) {
    return (CoursesDB as any).update(id, patch).then((rec: Course) => {
      logAudit({ action:'update', resource:'course', resourceId:id, orgId: (rec as any).orgId, message:`Updated course ${rec.title}`, after: rec })
      return rec
    })
  }
  return api.patch(`/courses/${id}`, patch).then(r => r.data as Course)
}

export function deleteCourse(id: string){
  if (USE_MOCK) {
    // Some mocks name it 'remove' instead of 'delete'
    const fn = (CoursesDB as any).remove ?? (CoursesDB as any).delete
    return fn.call(CoursesDB, id).then((res: any) => {
      logAudit({ action:'delete', resource:'course', resourceId:id, message:`Deleted course ${id}` })
      return res
    })
  }
  return api.delete(`/courses/${id}`).then(r => r.data as any)
}

export function setCourseStatus(id: string, status: CourseStatus){
  if (USE_MOCK) {
    // Prefer native setStatus if available, otherwise patch via update
    const setStatus = (CoursesDB as any).setStatus
    if (typeof setStatus === 'function') {
      return setStatus.call(CoursesDB, id, status).then((rec: Course) => {
        logAudit({ action:'status_change', resource:'course', resourceId:id, orgId: (rec as any).orgId, message:`Course status -> ${status}`, after: rec })
        return rec
      })
    }
    return (CoursesDB as any).update(id, { status }).then((rec: Course) => {
      logAudit({ action:'status_change', resource:'course', resourceId:id, orgId: (rec as any).orgId, message:`Course status -> ${status}`, after: rec })
      return rec
    })
  }
  return api.post(`/courses/${id}/status`, { status }).then(r => r.data as Course)
}

export function fetchCourses(filters: CourseFilters) {
  return listCourses(filters);
}
