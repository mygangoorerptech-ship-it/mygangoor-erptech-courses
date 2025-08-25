import { api } from './client'
import { USE_MOCK } from './env'
import { SubmissionsDB } from './mockSubmissions'
import type { Submission, SubmissionFilters, SubmissionStatus } from '../types/submission'
import type { Attachment } from '../types/assessmentQuestion'

export function listSubmissions(assignmentId: string, filters: SubmissionFilters){
  if (USE_MOCK) return SubmissionsDB.list(assignmentId, filters)
  return api.get(`/assignments/${assignmentId}/submissions`, { params: filters }).then(r => r.data as Submission[])
}

export function addSubmission(assignmentId: string, payload: Omit<Submission,'id'|'assignmentId'|'submittedAt'|'status'> & { status?: SubmissionStatus }){
  if (USE_MOCK) return SubmissionsDB.add(assignmentId, payload)
  return api.post(`/assignments/${assignmentId}/submissions`, payload).then(r => r.data as Submission)
}

export function gradeSubmission(id: string, score: number, feedback?: string, gradedBy?: string){
  if (USE_MOCK) return SubmissionsDB.grade(id, score, feedback, gradedBy)
  return api.post(`/submissions/${id}/grade`, { score, feedback, gradedBy }).then(r => r.data as Submission)
}

export function setSubmissionStatus(id: string, status: SubmissionStatus){
  if (USE_MOCK) return SubmissionsDB.setStatus(id, status)
  return api.post(`/submissions/${id}/status`, { status }).then(r => r.data as Submission)
}

export function deleteSubmission(id: string){
  if (USE_MOCK) return SubmissionsDB.delete(id)
  return api.delete(`/submissions/${id}`).then(r => r.data as any)
}

export function attachSubmissionFile(id: string, file: Attachment){
  if (USE_MOCK) return SubmissionsDB.attachFile(id, file)
  const fd = new FormData()
  fd.append('file', new Blob([file.dataUrl || '']), file.name)
  return api.post(`/submissions/${id}/files`, fd).then(r => r.data as any)
}

export function removeSubmissionFile(id: string, attachmentId: string){
  if (USE_MOCK) return SubmissionsDB.removeFile(id, attachmentId)
  return api.delete(`/submissions/${id}/files/${attachmentId}`).then(r => r.data as any)
}