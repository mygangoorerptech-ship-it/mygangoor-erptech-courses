// src/api/assessments.ts
import { api } from './client'
import { USE_MOCK } from './env'
import { AssessmentsDB } from './mockAssessments'
import type {
  Assessment,
  AssessmentStatus,
  AssessmentFilters,
} from '../types/assessment'
import { logAudit } from '../api/audit'

// ✅ Use AssessmentFilters (includes orgId)
export function listAssessments(filters: AssessmentFilters = {}) {
  if (USE_MOCK) return AssessmentsDB.list(filters)
  return api.get('/assessments', { params: filters }).then(r => r.data as Assessment[])
}

export function createAssessment(payload: Omit<Assessment,'id'|'createdAt'|'updatedAt'>) {
  if (USE_MOCK) {
    return AssessmentsDB.create(payload).then(rec => {
      logAudit({ action:'create', resource:'assessment', resourceId:rec.id, orgId:rec.orgId, message:`Created assessment ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.post('/assessments', payload).then(r => r.data as Assessment)
}

export function updateAssessment(id: string, patch: Partial<Assessment>) {
  if (USE_MOCK) {
    return AssessmentsDB.update(id, patch).then(rec => {
      logAudit({ action:'update', resource:'assessment', resourceId:id, orgId:rec.orgId, message:`Updated assessment ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.patch(`/assessments/${id}`, patch).then(r => r.data as Assessment)
}

export function deleteAssessment(id: string) {
  if (USE_MOCK) {
    return AssessmentsDB.delete(id).then(res => {
      logAudit({ action:'delete', resource:'assessment', resourceId:id, message:`Deleted assessment ${id}` })
      return res
    })
  }
  return api.delete(`/assessments/${id}`).then(r => r.data as any)
}

export function setAssessmentStatus(id: string, status: AssessmentStatus) {
  if (USE_MOCK) {
    return AssessmentsDB.setStatus(id, status).then(rec => {
      logAudit({ action:'status_change', resource:'assessment', resourceId:id, orgId:rec.orgId, message:`Assessment status -> ${status}`, after:rec })
      return rec
    })
  }
  return api.post(`/assessments/${id}/status`, { status }).then(r => r.data as Assessment)
}
