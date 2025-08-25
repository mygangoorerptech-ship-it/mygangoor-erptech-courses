import type { Attachment } from '@/types/assessmentQuestion'

export type SubmissionStatus = 'submitted' | 'graded' | 'returned'

export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  studentName: string
  studentEmail?: string
  attempt: number
  submittedAt: string // ISO
  status: SubmissionStatus
  score?: number
  maxPoints?: number
  feedback?: string
  gradedBy?: string
  files?: Attachment[]
  textEntry?: string
  url?: string
}

export type SubmissionFilters = {
  q?: string
  status?: 'all' | SubmissionStatus
  minAttempt?: number
  maxAttempt?: number
}