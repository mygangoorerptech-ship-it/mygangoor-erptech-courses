// src/types/assessment.ts
export type AssessmentStatus = 'draft' | 'published' | 'archived'

export interface Assessment {
  id: string
  courseId?: string
  courseTitle?: string
  title: string
  description?: string
  timeLimitMin?: number
  passingScore?: number
  totalQuestions: number
  status: AssessmentStatus
  tags?: string[]
  orgId?: string
  orgName?: string
  createdAt: string
  updatedAt: string
}

export type AssessmentFilters = {
  q?: string
  status?: 'all' | AssessmentStatus
  courseId?: string
  orgId?: string
}