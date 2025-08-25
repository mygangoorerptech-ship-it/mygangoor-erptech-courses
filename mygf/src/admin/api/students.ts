// src/api/mockStudents.ts
import { api } from './client'
import { USE_MOCK } from './env'
import { StudentsDB } from './mockStudents'
import type { Student, StudentFilters, StudentStatus } from '../types/student'
import { logAudit } from '../api/audit'

export function listStudents(filters: StudentFilters) {
  if (USE_MOCK) return StudentsDB.list(filters)
  return api.get('/students', { params: filters }).then(r => r.data as Student[])
}

export function createStudent(payload: Omit<Student,'id'|'createdAt'|'updatedAt'>) {
  if (USE_MOCK) {
    return StudentsDB.create(payload).then(rec => {
      logAudit({
        action: 'create',
        resource: 'student',
        resourceId: rec.id,
        orgId: rec.orgId,
        message: `Created student ${rec.email}`,
        after: rec,
      })
      return rec
    })
  }
  return api.post('/students', payload).then(r => r.data as Student)
}

export function updateStudent(id: string, patch: Partial<Student>) {
  if (USE_MOCK) {
    return StudentsDB.update(id, patch).then(rec => {
      logAudit({
        action: 'update',
        resource: 'student',
        resourceId: id,
        orgId: rec.orgId,
        message: `Updated student ${rec.email}`,
        // If you want a real diff, log from inside StudentsDB.update where you have 'before'
        after: rec,
      })
      return rec
    })
  }
  return api.patch(`/students/${id}`, patch).then(r => r.data as Student)
}

export function deleteStudent(id: string) {
  if (USE_MOCK) {
    // If your StudentsDB.delete can return the deleted record, you can include it in 'before'
    return StudentsDB.delete(id).then(res => {
      logAudit({
        action: 'delete',
        resource: 'student',
        resourceId: id,
        message: `Deleted student ${id}`,
      })
      return res
    })
  }
  return api.delete(`/students/${id}`).then(r => r.data as any)
}

export function setStudentStatus(id: string, status: StudentStatus) {
  if (USE_MOCK) {
    return StudentsDB.setStatus(id, status).then(rec => {
      logAudit({
        action: 'status_change',
        resource: 'student',
        resourceId: id,
        orgId: rec.orgId,
        message: `Student status -> ${status}`,
        after: rec,
      })
      return rec
    })
  }
  return api.post(`/students/${id}/status`, { status }).then(r => r.data as Student)
}

export function bulkUpsertStudents(
  rows: Array<Partial<Student> & { email?: string; username?: string }>
) {
  if (USE_MOCK) {
    return StudentsDB.bulkUpsert(rows).then(summary => {
      logAudit({
        action: 'bulk_upsert',
        resource: 'student',
        message: `Bulk upsert students: created ${summary.created}, updated ${summary.updated}`,
        meta: summary,
      })
      return summary
    })
  }
  return api
    .post('/students/bulk-upsert', { rows })
    .then(r => r.data as { created: number; updated: number; total: number })
}
