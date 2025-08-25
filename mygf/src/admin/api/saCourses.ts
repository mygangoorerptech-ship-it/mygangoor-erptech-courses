import { api } from './client'
import { USE_MOCK } from './env'
import { SaCoursesDB } from './mockSaCourses'
import type { Course, CourseFilters, CourseStatus } from '../types/course'
import { logAudit } from '../api/audit'

export function listSaCourses(filters: CourseFilters){
  if (USE_MOCK) return SaCoursesDB.list(filters as any)
  return api.get('/sa/courses', { params: filters }).then(r => r.data as Course[])
}

export function createSaCourse(payload: Omit<Course,'id'|'createdAt'|'updatedAt'>){
  if (USE_MOCK) {
    return SaCoursesDB.create(payload as any).then((rec: any) => {
      logAudit({ action:'create', resource:'course', resourceId:rec.id, orgId:(rec as any).orgId, message:`[SA] Created course ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.post('/sa/courses', payload).then(r => r.data as Course)
}

export function updateSaCourse(id: string, patch: Partial<Course>){
  if (USE_MOCK) {
    return SaCoursesDB.update(id, patch as any).then((rec: any) => {
      logAudit({ action:'update', resource:'course', resourceId:id, orgId:(rec as any).orgId, message:`[SA] Updated course ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.patch(`/sa/courses/${id}`, patch).then(r => r.data as Course)
}

export function deleteSaCourse(id: string){
  if (USE_MOCK) {
    return SaCoursesDB.delete(id).then((res: any) => {
      logAudit({ action:'delete', resource:'course', resourceId:id, message:`[SA] Deleted course ${id}` })
      return res
    })
  }
  return api.delete(`/sa/courses/${id}`).then(r => r.data as any)
}

export function setSaCourseStatus(id: string, status: CourseStatus){
  if (USE_MOCK) {
    return SaCoursesDB.setStatus(id, status).then((rec: any) => {
      logAudit({ action:'status_change', resource:'course', resourceId:id, orgId:(rec as any).orgId, message:`[SA] Course status -> ${status}`, after:rec })
      return rec
    })
  }
  return api.post(`/sa/courses/${id}/status`, { status }).then(r => r.data as Course)
}
