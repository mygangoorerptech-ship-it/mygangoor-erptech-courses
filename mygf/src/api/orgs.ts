// src/api/orgs.ts
import { api } from './client';
import type { Organization, OrgFilters, OrgStatus } from '../admin/types/org';

function mapOne(raw: any): Organization {
  return {
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
    status: raw.status ?? 'inactive',
    suspended: !!raw.suspended,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

let cachedBase: string | null = null;

async function getBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  // try the known routes in order; 404 => try next
  for (const b of ['/organizations', '/orgs', '/superadmin/orgs']) {
    try {
      await api.get(`${b}?limit=1`);
      cachedBase = b;
      return b;
    } catch (e: any) {
      if (e?.response?.status !== 404) throw e;
    }
  }
  // fallback (should not really happen)
  cachedBase = '/organizations';
  return cachedBase;
}

export type ListOrgsResp = { ok?: boolean; items: Organization[]; total?: number };
export type BulkSummary = { count: number; created: number; updated: number; skipped: number; errors: number }
export type BulkResult = { ok: boolean; key: string; created?: boolean; error?: string }
export type BulkResp = { ok: true; summary: BulkSummary; results: BulkResult[] }

export async function listOrgs(filters?: OrgFilters): Promise<ListOrgsResp> {
  const params: any = {};
  if (filters?.q) params.q = filters.q;
  if (filters?.status && filters.status !== "all") {
    if (filters.status === "suspended") params.suspended = "true";
    else params.status = filters.status;
  }
  const { data } = await api.get("/organizations", { params });
  const items = Array.isArray(data?.items) ? data.items.map(mapOne) : [];
  return { ok: data?.ok ?? true, items, total: data?.total };
}

export async function createOrg(input: Partial<Organization>) {
  const { data } = await api.post('/organizations', input);
  return mapOne(data.organization ?? data);
}

export async function updateOrg(id: string, patch: Partial<Organization>) {
  const { data } = await api.patch(`/organizations/${id}`, patch);
  return mapOne(data.organization ?? data);
}

export async function deleteOrg(id: string) {
  await api.delete(`/organizations/${id}`);
  return { ok: true };
}

export async function setOrgStatus(id: string, status: OrgStatus) {
  if (status === 'suspended') {
    const { data } = await api.post(`/organizations/${id}/suspend`, { suspend: true });
    return mapOne(data.organization ?? data);
  } else {
    const { data } = await api.patch(`/organizations/${id}/status`, { status });
    return mapOne(data.organization ?? data);
  }
}

// Bulk upsert (unchanged)
export async function bulkUpsertOrgs(rows: Array<Partial<Organization>>): Promise<BulkResp> {
  const base = await getBase();
  const { data } = await api.post(`${base}/bulk`, { rows });
  return data;
}

export async function bulkUploadOrgsFile(file: File): Promise<BulkResp> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post('/organizations/bulk-file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}
