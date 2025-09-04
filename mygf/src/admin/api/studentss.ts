// src/api/mockStudents.ts
import { api } from './client'
import { USE_MOCK } from './env'
import { StudentsDB } from './mockStudents'
import type { Student, StudentFilters, StudentStatus } from '../types/student'

export function listStudents(filters: StudentFilters) {
  if (USE_MOCK) return StudentsDB.list(filters)
  return api.get('/students', { params: filters }).then(r => r.data as Student[])
}

export function createStudent(payload: Omit<Student,'id'|'createdAt'|'updatedAt'>) {
  if (USE_MOCK) {
    return StudentsDB.create(payload).then(rec => {
      return rec
    })
  }
  return api.post('/students', payload).then(r => r.data as Student)
}

export function updateStudent(id: string, patch: Partial<Student>) {
  if (USE_MOCK) {
    return StudentsDB.update(id, patch).then(rec => {
      return rec
    })
  }
  return api.patch(`/students/${id}`, patch).then(r => r.data as Student)
}

export function deleteStudent(id: string) {
  if (USE_MOCK) {
    // If your StudentsDB.delete can return the deleted record, you can include it in 'before'
    return StudentsDB.delete(id).then(res => {
      return res
    })
  }
  return api.delete(`/students/${id}`).then(r => r.data as any)
}

export function setStudentStatus(id: string, status: StudentStatus) {
  if (USE_MOCK) {
    return StudentsDB.setStatus(id, status).then(rec => {
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
      return summary
    })
  }
  return api
    .post('/students/bulk-upsert', { rows })
    .then(r => r.data as { created: number; updated: number; total: number })
}
