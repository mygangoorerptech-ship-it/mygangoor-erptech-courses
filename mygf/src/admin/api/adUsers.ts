import { api } from './client'
import type { SAUser, UserStatus } from '../types/user'

export type AdminUserRole = 'vendor' | 'student'
export type AdminMfa = { required: boolean; method: 'otp' | 'totp' | null }

// Narrow SAUser.role and add mfa (returned by backend for vendor/student)
export type AdminUser = Omit<SAUser, 'role'> & {
  role: AdminUserRole
  mfa?: AdminMfa
}

export type AdminUserFilters = {
  q?: string
  role?: 'all' | AdminUserRole
  status?: 'all' | UserStatus
  showUnverified?: boolean
}

export type CreateAdminUserPayload = {
  name?: string
  email: string
  role: AdminUserRole
  // server forces orgId from session
  mfa?: AdminMfa
}

export type UpdateAdminUserPayload = Partial<CreateAdminUserPayload> & {
  status?: UserStatus
}

export function listAdUsers(filters: AdminUserFilters) {
  return api.get('/ad/users', { params: filters }).then(r => r.data as AdminUser[])
}

export function createAdUser(payload: CreateAdminUserPayload) {
  // vendor → returns AdminUser, student invite → { ok: true }
  return api.post('/ad/users', payload).then(r => r.data as AdminUser | { ok: true })
}

export function updateAdUser({ id, patch }: { id: string; patch: UpdateAdminUserPayload }) {
  return api.patch(`/ad/users/${id}`, patch).then(r => r.data as AdminUser)
}

export function deleteAdUser(id: string) {
  return api.delete(`/ad/users/${id}`).then(r => r.data as any)
}

export function setAdUserStatus(id: string, status: UserStatus) {
  return api.post(`/ad/users/${id}/status`, { status }).then(r => r.data as AdminUser)
}

export function setAdUserRole(id: string, role: AdminUserRole) {
  return api.post(`/ad/users/${id}/role`, { role }).then(r => r.data as AdminUser)
}

export function bulkUpsertAdUsers(
  rows: Array<Partial<AdminUser> & { email?: string; role?: AdminUserRole }>
) {
  return api.post('/ad/users/bulk-upsert', { rows })
    .then(r => r.data as { created: number; updated: number; total: number })
}
