export type AuditAction =
  | 'create' | 'update' | 'delete' | 'status_change'
  | 'refund' | 'cancel' | 'reorder' | 'attach' | 'detach'
  | 'publish' | 'unpublish' | 'bulk_upsert'
  | 'login' | 'logout' | 'other'

export type AuditStatus = 'success' | 'failure'

export type AuditResource =
  | 'student' | 'organization' | 'user' | 'course' | 'subscription'
  | 'assessment' | 'assignment' | 'certificate' | 'question'
  | 'payout' | 'payment' | 'cms' | 'integration' | 'other'

export interface AuditLog {
  id: string
  ts: string

  action: AuditAction
  status: AuditStatus

  actorId?: string
  actorEmail?: string
  actorName?: string
  actorRole?: string

  resource: AuditResource
  resourceId?: string
  orgId?: string

  message?: string
  method?: string
  path?: string

  before?: any
  after?: any
  diff?: any

  meta?: Record<string, any>
}

export type AuditFilters = {
  q?: string
  action?: AuditAction | 'all'
  resource?: AuditResource | 'all'
  status?: AuditStatus | 'all'
  orgId?: string
  actorEmail?: string
  from?: string // ISO
  to?: string   // ISO
}
