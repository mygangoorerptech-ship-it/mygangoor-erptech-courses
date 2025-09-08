// src/admin/store/adUsers.ts
import { create } from 'zustand'
import { api } from '../api/client'
import type { UserStatus } from '../types/user'
import type {
  AdminUser, AdminUserRole, AdminUserFilters,
  CreateAdminUserPayload, UpdateAdminUserPayload
} from '../api/adUsers'

type State = {
  items: AdminUser[]
  loading: boolean
  error: any
  etag?: string | null
  version?: string | null
  lastFilters?: AdminUserFilters | null

  fetchIfStale: (filters: AdminUserFilters) => Promise<void>
  createOne: (payload: CreateAdminUserPayload) => Promise<AdminUser | { ok: true }>
  updateOne: (id: string, patch: UpdateAdminUserPayload) => Promise<AdminUser>
  deleteOne: (id: string) => Promise<void>
  setStatus: (id: string, status: UserStatus) => Promise<AdminUser>
  setRole: (id: string, role: AdminUserRole) => Promise<AdminUser>
  bulkUpsert: (
    rows: Array<Partial<AdminUser> & { email?: string; role?: AdminUserRole }>
  ) => Promise<{ created: number; updated: number; total: number }>
}

// Map DB role -> UI role
function toClient(u: any): AdminUser {
  const role = u.role === 'orguser' ? 'student' : u.role
  return { ...u, role } as AdminUser
}

export const useAdUsers = create<State>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  etag: null,
  version: null,
  lastFilters: null,

  async fetchIfStale(filters) {
    const { etag, lastFilters, loading } = get()
    // If a request with the same filters is already in-flight, don't start another
    if (loading) return
    set({ loading: true, error: null })

    try {
      const r = await api.get('/ad/users', {
        params: filters,
        headers: etag ? { 'If-None-Match': etag } : undefined,
        // allow 304 pass-through
        validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
      })

      if (r.status === 304) {
        // Data unchanged
        set({ loading: false, lastFilters: filters })
        return
      }

      const nextEtag = r.headers?.etag ?? null
      const version = r.headers?.['x-data-version'] ?? null
      const rows = Array.isArray(r.data) ? r.data.map(toClient) : []

      set({
        items: rows,
        loading: false,
        error: null,
        etag: nextEtag,
        version,
        lastFilters: filters,
      })
    } catch (err) {
      set({ loading: false, error: err })
    }
  },

  async createOne(payload) {
    const r = await api.post('/ad/users', payload)
    // Vendor returns the created doc; student may also return a doc; normalize when present
    const data = r.data
    if (data && data.id) {
      const item = toClient(data)
      set((s) => ({ items: [item, ...s.items] }))
    }
    // If it was an invite/ok-only response, caller can refetch if needed
    return data
  },

  async updateOne(id, patch) {
    const r = await api.patch(`/ad/users/${id}`, patch)
    const item = toClient(r.data)
    set((s) => ({ items: s.items.map((x) => (x.id === id ? item : x)) }))
    return item
  },

  async deleteOne(id) {
    await api.delete(`/ad/users/${id}`)
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  },

  async setStatus(id, status) {
    const r = await api.post(`/ad/users/${id}/status`, { status })
    const item = toClient(r.data)
    set((s) => ({ items: s.items.map((x) => (x.id === id ? item : x)) }))
    return item
  },

  async setRole(id, role) {
    const r = await api.post(`/ad/users/${id}/role`, { role })
    const item = toClient(r.data)
    set((s) => ({ items: s.items.map((x) => (x.id === id ? item : x)) }))
    return item
  },

  async bulkUpsert(rows) {
    const r = await api.post('/ad/users/bulk-upsert', { rows })
    // mark cache stale so next fetch pulls fresh data
    set({ version: null, etag: null })
    const { lastFilters, fetchIfStale } = get()
    if (lastFilters) {
      // fire-and-forget refresh; caller UI doesn't have to worry
      fetchIfStale(lastFilters)
    }
    return r.data
  },
}))
