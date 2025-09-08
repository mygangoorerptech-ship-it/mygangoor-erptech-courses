// src/admin/store/saUsers.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { api } from '../api/client';
import type { SAUser, UserRole, UserStatus } from '../types/user';

export type SaUserFilters = {
  q?: string;
  role?: 'all' | UserRole;
  status?: 'all' | UserStatus;
  orgId?: string;
  verified?: 'all';
};

type State = {
  items: SAUser[];
  loading: boolean;
  error: string | null;
  etag?: string;
  version?: string;
  lastFetched?: number;
  inFlight?: Promise<void> | null;
  fetchIfStale: (filters?: SaUserFilters) => Promise<void>;
  createOne: (payload: Partial<SAUser> & { password?: string; managerId?: string }) => Promise<SAUser>;
  updateOne: (id: string, patch: Partial<SAUser>) => Promise<SAUser>;
  deleteOne: (id: string) => Promise<void>;
  setStatus: (id: string, status: UserStatus) => Promise<SAUser>;
  setRole: (id: string, role: UserRole) => Promise<SAUser>;
  bulkUpsert: (rows: Array<Partial<SAUser> & { email?: string }>) => Promise<any>;
  clear: () => void;
};

function buildParams(filters?: SaUserFilters) {
  const params: any = {};
  if (!filters) return params;
  if (filters.q) params.q = filters.q;
  if (filters.role && filters.role !== 'all') params.role = filters.role;
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.orgId) params.orgId = filters.orgId;
  if (filters.verified === 'all') params.verified = 'all';
  return params;
}

export const useSaUsers = create<State>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      items: [],
      loading: false,
      error: null,
      etag: undefined,
      version: undefined,
      lastFetched: undefined,
      inFlight: null,

      async fetchIfStale(filters) {
        const { etag, inFlight } = get();
        if (inFlight) return inFlight;
        const p = (async () => {
          set({ loading: true, error: null });
          try {
            const resp = await api.get('/sa/users', {
              params: buildParams(filters),
              headers: etag ? { 'If-None-Match': etag } : undefined,
              validateStatus: (s) => s === 200 || s === 304,
            });
            if (resp.status === 304) {
              set({ loading: false, lastFetched: Date.now() });
              return;
            }
            const data = resp.data;
            const items: SAUser[] = Array.isArray(data) ? data.map((u: any) => ({
              id: String(u.id || u._id),
              name: u.name || undefined,
              email: String(u.email || ''),
              role: u.role,
              status: u.status,
              orgId: u.orgId ?? undefined,
              orgName: u.orgName ?? undefined,
              provider: u.provider,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
              isVerified: u.isVerified,
              mfa: u.mfa,
            })) : [];
            const newEtag = resp.headers?.etag ?? resp.headers?.ETag;
            const version = resp.headers?.['x-data-version'] ?? resp.headers?.['X-Data-Version'];
            set({ items, loading: false, error: null, etag: newEtag, version, lastFetched: Date.now() });
          } catch (e:any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to load users';
            set({ loading:false, error: msg });
          } finally {
            set({ inFlight: null });
          }
        })();
        set({ inFlight: p });
        return p;
      },

      async createOne(payload) {
        const tempId = `tmp_${Math.random().toString(36).slice(2)}`;
        const optimistic: SAUser = {
          id: tempId,
          email: String(payload.email || ''),
          name: payload.name,
          role: (payload.role as UserRole) || 'student',
          status: (payload.status as UserStatus) || 'active',
          orgId: payload.orgId,
          orgName: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isVerified: false,
          mfa: payload.mfa ? { required: !!payload.mfa.required, method: payload.mfa.method || 'otp' } : { required: false, method: null }
        };
        set(s => ({ items: [optimistic, ...s.items] }));
        try {
          const { data } = await api.post('/sa/users', payload);
          const mapped: SAUser = {
            id: String(data.id || data._id),
            name: data.name,
            email: data.email,
            role: data.role,
            status: data.status,
            orgId: data.orgId ?? undefined,
            orgName: data.orgName ?? undefined,
            provider: data.provider,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isVerified: data.isVerified,
            mfa: data.mfa,
          };
          set(s => ({ items: s.items.map(x => x.id === tempId ? mapped : x) }));
          return mapped;
        } catch (e) {
          set(s => ({ items: s.items.filter(x => x.id !== tempId) }));
          throw e;
        }
      },

      async updateOne(id, patch) {
        const prev = get().items;
        set({ items: prev.map(x => x.id === id ? { ...x, ...patch } as SAUser : x) });
        try {
          const { data } = await api.patch(`/sa/users/${id}`, patch);
          const mapped: SAUser = {
            id: String(data.id || data._id),
            name: data.name,
            email: data.email,
            role: data.role,
            status: data.status,
            orgId: data.orgId ?? undefined,
            orgName: data.orgName ?? undefined,
            provider: data.provider,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isVerified: data.isVerified,
            mfa: data.mfa,
          };
          set(s => ({ items: s.items.map(x => x.id === id ? mapped : x) }));
          return mapped;
        } catch (e) {
          set({ items: prev });
          throw e;
        }
      },

      async deleteOne(id) {
        const prev = get().items;
        set({ items: prev.filter(x => x.id !== id) });
        try {
          await api.delete(`/sa/users/${id}`);
        } catch (e) {
          set({ items: prev });
          throw e;
        }
      },

      async setStatus(id, status) {
        const prev = get().items;
        set({ items: prev.map(x => x.id === id ? { ...x, status } as SAUser : x) });
        try {
          const { data } = await api.post(`/sa/users/${id}/status`, { status });
          const mapped: SAUser = {
            id: String(data.id || data._id),
            name: data.name,
            email: data.email,
            role: data.role,
            status: data.status,
            orgId: data.orgId ?? undefined,
            orgName: data.orgName ?? undefined,
            provider: data.provider,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isVerified: data.isVerified,
            mfa: data.mfa,
          };
          set(s => ({ items: s.items.map(x => x.id === id ? mapped : x) }));
          return mapped;
        } catch (e) {
          set({ items: prev });
          throw e;
        }
      },

      async setRole(id, role) {
        const prev = get().items;
        set({ items: prev.map(x => x.id === id ? { ...x, role } as SAUser : x) });
        try {
          const { data } = await api.post(`/sa/users/${id}/role`, { role });
          const mapped: SAUser = {
            id: String(data.id || data._id),
            name: data.name,
            email: data.email,
            role: data.role,
            status: data.status,
            orgId: data.orgId ?? undefined,
            orgName: data.orgName ?? undefined,
            provider: data.provider,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isVerified: data.isVerified,
            mfa: data.mfa,
          };
          set(s => ({ items: s.items.map(x => x.id === id ? mapped : x) }));
          return mapped;
        } catch (e) {
          set({ items: prev });
          throw e;
        }
      },

      async bulkUpsert(rows) {
        const { data } = await api.post('/sa/users/bulk-upsert', { rows });
        await get().fetchIfStale();
        return data;
      },

      clear() {
        set({
          items: [], loading: false, error: null,
          etag: undefined, version: undefined, lastFetched: undefined, inFlight: null
        });
      },
    }))
  )
);
