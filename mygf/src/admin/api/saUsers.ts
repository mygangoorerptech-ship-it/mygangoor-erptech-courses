// src/admin/api/saUsers.ts
import { api } from './client'
import type { SAUser, SAUserFilters, UserRole, UserStatus } from '../types/user'

export type CreateSaUserPayload = {
  name?: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  orgId?: string;
  mfa?: { required: boolean; method: 'otp'|'totp'|null };
  managerId?: string; // for vendors under an admin
}

export type UpdateSaUserPayload = Partial<CreateSaUserPayload>

export function listSaUsers(filters: SAUserFilters){
  return api.get('/sa/users', { params: filters }).then(r => r.data as SAUser[])
}
export function createSaUser(payload: CreateSaUserPayload){
  return api.post('/sa/users', payload).then(r => r.data as SAUser)
}
export function updateSaUser(id: string, patch: UpdateSaUserPayload){
  return api.patch(`/sa/users/${id}`, patch).then(r => r.data as SAUser)
}
export function deleteSaUser(id: string){
  return api.delete(`/sa/users/${id}`).then(r => r.data as any)
}
export function setSaUserStatus(id: string, status: UserStatus){
  return api.post(`/sa/users/${id}/status`, { status }).then(r => r.data as SAUser)
}
export function setSaUserRole(id: string, role: UserRole){
  return api.post(`/sa/users/${id}/role`, { role }).then(r => r.data as SAUser)
}
export function bulkUpsertSaUsers(rows: Array<Partial<SAUser> & { email?: string }>) {
  return api.post('/sa/users/bulk-upsert', { rows }).then(r => r.data as { created:number; updated:number; total:number })
}
