
// src/admin/store/saOrganizations.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { api } from '../../api/client';
import type { Organization, OrgStatus } from '../types/org';

type Filters = { q?: string; status?: 'all' | OrgStatus };

type State = {
  items: Organization[];
  total: number;
  loading: boolean;
  error: string | null;
  etag?: string;                // from server ETag header
  version?: string;             // from X-Data-Version header
  lastFetched?: number;         // epoch ms
  inFlight?: Promise<void> | null;
  // actions
  fetchIfStale: (filters?: Filters, opts?: { force?: boolean }) => Promise<void>;
  createOne: (payload: Partial<Organization>) => Promise<Organization>;
  updateOne: (id: string, patch: Partial<Organization>) => Promise<Organization>;
  deleteOne: (id: string) => Promise<void>;
  setStatus: (id: string, status: OrgStatus) => Promise<Organization>;
  bulkUpsert: (rows: Array<Partial<Organization>>) => Promise<any>;
  clear: () => void;
};

function buildParams(filters?: Filters) {
  const params: any = {};
  if (filters?.q) params.q = filters.q;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  return params;
}

export const useSaOrgs = create<State>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      items: [],
      total: 0,
      loading: false,
      error: null,
      etag: undefined,
      version: undefined,
      lastFetched: undefined,
      inFlight: null,

      async fetchIfStale(filters?: Filters, opts?: { force?: boolean }) {
        const { etag, inFlight } = get();
        if (inFlight) return inFlight;

        const doFetch = async () => {
          set({ loading: true, error: null });
          try {
            const resp = await api.get('/organizations', {
              params: buildParams(filters),
              headers: etag ? { 'If-None-Match': etag } : undefined,
              // treat 200 and 304 as success
              validateStatus: (s) => s === 200 || s === 304,
            });

            // Not modified: keep cache, just bump lastFetched
            if (resp.status === 304) {
              set({ lastFetched: Date.now(), loading: false });
              return;
            }

            const items: Organization[] = (resp.data?.items ?? resp.data ?? []).map((raw: any) => ({
              id: raw._id || raw.id,
              code: raw.code,
              name: raw.name,
              domain: raw.domain,
              contactName: raw.contactName,
              contactEmail: raw.contactEmail,
              phone: raw.phone,
              address: raw.address,
              city: raw.city,
              state: raw.state,
              country: raw.country,
              postal: raw.postal,
              notes: raw.notes,
              status: raw.status === 'suspended' || raw.suspended ? 'suspended' : (raw.status ?? 'active'),
              suspended: raw.suspended,
              createdAt: raw.createdAt || raw.created_at,
              updatedAt: raw.updatedAt || raw.updated_at,
            }));
            const total = Array.isArray(resp.data?.items) ? (resp.data?.total ?? items.length) : items.length;

            const newEtag = resp.headers?.etag ?? resp.headers?.ETag;
            const version = resp.headers?.['x-data-version'] ?? resp.headers?.['X-Data-Version'];

            set({
              items,
              total,
              etag: newEtag,
              version,
              lastFetched: Date.now(),
              loading: false,
              error: null,
            });
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to load organizations';
            set({ loading: false, error: msg });
          } finally {
            set({ inFlight: null });
          }
        };

        const p = doFetch();
        set({ inFlight: p });
        return p;
      },

      async createOne(payload) {
        // optimistic add with temporary id to avoid duplicate API fetch
        const tempId = `tmp_${Math.random().toString(36).slice(2)}`;
        const optimistic: Organization = { status: 'active', ...payload, id: tempId } as Organization;
        set((s) => ({ items: [optimistic, ...s.items] }));

        try {
          const { data } = await api.post('/organizations', payload);
          const mapped: Organization = {
            id: data?.organization?._id || data?._id || data?.id,
            code: data?.organization?.code ?? data?.code,
            name: data?.organization?.name ?? data?.name,
            domain: data?.organization?.domain ?? data?.domain,
            contactName: data?.organization?.contactName ?? data?.contactName,
            contactEmail: data?.organization?.contactEmail ?? data?.contactEmail,
            phone: data?.organization?.phone ?? data?.phone,
            address: data?.organization?.address ?? data?.address,
            city: data?.organization?.city ?? data?.city,
            state: data?.organization?.state ?? data?.state,
            country: data?.organization?.country ?? data?.country,
            postal: data?.organization?.postal ?? data?.postal,
            notes: data?.organization?.notes ?? data?.notes,
            status: (data?.organization?.status ?? data?.status) || 'active',
            suspended: (data?.organization?.suspended ?? data?.suspended) || false,
            createdAt: data?.organization?.createdAt ?? data?.createdAt,
            updatedAt: data?.organization?.updatedAt ?? data?.updatedAt,
          };
          set((s) => ({
            items: s.items.map((x) => (x.id === tempId ? mapped : x)),
            total: Math.max(1, s.total + 0), // don't double-count
          }));
          return mapped;
        } catch (e) {
          // rollback
          set((s) => ({ items: s.items.filter((x) => x.id !== tempId) }));
          throw e;
        }
      },

      async updateOne(id, patch) {
        // optimistic patch
        const prev = get().items;
        set({ items: prev.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
        try {
          const { data } = await api.patch(`/organizations/${id}`, patch);
          const doc = data?.organization ?? data;
          set((s) => ({
            items: s.items.map((x) => (x.id === id ? { ...x, ...doc, id: doc._id || doc.id } : x)),
          }));
          return doc;
        } catch (e) {
          // rollback
          set({ items: prev });
          throw e;
        }
      },

      async deleteOne(id) {
        const prev = get().items;
        set({ items: prev.filter((x) => x.id !== id) });
        try {
          await api.delete(`/organizations/${id}`);
        } catch (e) {
          // rollback
          set({ items: prev });
          throw e;
        }
      },

      async setStatus(id, status) {
        const prev = get().items;
        set({ items: prev.map((x) => (x.id === id ? { ...x, status } : x)) });
        try {
          let data;
          if (status === 'suspended') {
            ({ data } = await api.post(`/organizations/${id}/suspend`, { suspend: true }));
          } else {
            ({ data } = await api.patch(`/organizations/${id}/status`, { status }));
          }
          const doc = data?.organization ?? data;
          set((s) => ({
            items: s.items.map((x) => (x.id === id ? { ...x, ...doc, id: doc._id || doc.id } : x)),
          }));
          return doc;
        } catch (e) {
          // rollback
          set({ items: prev });
          throw e;
        }
      },

      async bulkUpsert(rows) {
        const { data } = await api.post('/organizations/bulk', { rows });
        // ensure we refresh from server to reflect all upserts accurately
        await get().fetchIfStale(undefined, { force: true });
        return data;
      },

      clear() {
        set({
          items: [],
          total: 0,
          loading: false,
          error: null,
          etag: undefined,
          version: undefined,
          lastFetched: undefined,
          inFlight: null,
        });
      },
    }))
  )
);
