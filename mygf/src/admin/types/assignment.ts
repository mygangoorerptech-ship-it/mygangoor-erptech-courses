export type AssignmentStatus = 'draft'|'published'|'archived'

export type Assignment = {
  id: string
  title: string
  description?: string
  courseId?: string
  courseTitle?: string
  maxPoints: number
  submissionType: 'file'|'text'|'url'
  allowedFileTypes?: string
  allowMultipleAttempts?: boolean
  dueAt?: string
  status: AssignmentStatus
  tags?: string[]
  // 👇 add org fields
  orgId?: string
  orgName?: string
  createdAt: string
  updatedAt: string
}

export type AssignmentFilters = {
  q?: string
  status?: 'all' | AssignmentStatus
  courseId?: string
  due?: 'all'|'overdue'|'upcoming'
  orgId?: string            // 👈 add this
}
