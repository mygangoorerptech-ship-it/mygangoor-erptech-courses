// src/admin/api/adUsers.ts
import { api } from './client'
import type { SAUser, UserStatus } from '../types/user'

export type AdminUserRole = 'teacher' | 'orguser' | 'student'
export type AdminMfa = { required: boolean; method: 'otp' | 'totp' | null }

// Narrow SAUser.role and add mfa (returned by backend for teacher/student/orguser)
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
  sendMethod?: 'credentials' | 'invitation' // New: method to send credentials or invitation link
}

export type UpdateAdminUserPayload = Partial<CreateAdminUserPayload> & {
  status?: UserStatus
}

export async function listAdUsers(filters: AdminUserFilters) {
  const r = await api.get('/ad/users', { params: filters });
  const users = r.data as AdminUser[];
  return users.map(u => u.role === 'orguser' ? { ...u, role: 'student' as AdminUserRole } : u);
}

export async function createAdUser(payload: CreateAdminUserPayload) {
  // teacher → returns AdminUser, student/orguser invite → { ok: true }
  const r = await api.post('/ad/users', payload);
  return r.data as AdminUser | { ok: true; };
}

export async function updateAdUser({ id, patch }: { id: string; patch: UpdateAdminUserPayload }) {
  const r = await api.patch(`/ad/users/${id}`, patch);
  return r.data as AdminUser;
}

export async function deleteAdUser(id: string) {
  const r = await api.delete(`/ad/users/${id}`);
  return r.data as any;
}

export async function setAdUserStatus(id: string, status: UserStatus) {
  const r = await api.post(`/ad/users/${id}/status`, { status });
  return r.data as AdminUser;
}

export async function setAdUserRole(id: string, role: AdminUserRole) {
  const r = await api.post(`/ad/users/${id}/role`, { role });
  return r.data as AdminUser;
}

export async function bulkUpsertAdUsers(
  rows: Array<Partial<AdminUser> & { email?: string; role?: AdminUserRole }>
) {
  const r = await api.post('/ad/users/bulk-upsert', { rows });
  return r.data as { created: number; updated: number; total: number; };
}
