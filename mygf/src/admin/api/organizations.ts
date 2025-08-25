// src/admin/api/organizations.ts
import { api } from './client';

export type Organization = {
  _id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  suspended: boolean;
  suspendReason?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listOrganizations(params: {
  q?: string;
  status?: 'active' | 'inactive';
  suspended?: boolean | 'true' | 'false';
  page?: number;
  limit?: number;
}) {
  const normalized = {
    ...params,
    suspended:
      typeof params.suspended === 'boolean'
        ? (params.suspended ? 'true' : 'false')
        : params.suspended
  };
  const { data } = await api.get('/organizations', { params: normalized });
  return data as {
    items: Organization[];
    page: number; limit: number; total: number;
    counts: { total: number; active: number; inactive: number; suspended: number };
  };
}

export async function createOrganization(payload: Partial<Organization>) {
  const { data } = await api.post('/organizations', payload);
  return data.organization as Organization;
}

export async function updateOrganization(id: string, payload: Partial<Organization>) {
  const { data } = await api.patch(`/organizations/${id}`, payload);
  return data.organization as Organization;
}

export async function updateOrganizationStatus(id: string, status: 'active' | 'inactive') {
  const { data } = await api.patch(`/organizations/${id}/status`, { status });
  return data.organization as Organization;
}

export async function suspendOrganization(id: string, suspend: boolean, reason?: string) {
  const { data } = await api.post(`/organizations/${id}/suspend`, { suspend, reason });
  return data.organization as Organization;
}

export async function deleteOrganization(id: string) {
  await api.delete(`/organizations/${id}`);
  return { ok: true };
}

export async function bulkOrganizations(payload: {
  action: 'status' | 'suspend' | 'delete';
  ids: string[];
  payload?: any;
}) {
  const { data } = await api.post('/organizations/bulk', payload);
  return data as { ok: true; summary: { matchedCount: number; modifiedCount: number } };
}
