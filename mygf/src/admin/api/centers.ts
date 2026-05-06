// mygf/src/admin/api/centers.ts
import { api } from './client';

export type Center = {
  id: string;
  name: string;
  location?: string | null;
  region?: string | null;
  address?: string | null;
  orgId: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export async function listCenters(params?: { orgId?: string; status?: string; q?: string }) {
  const { data } = await api.get('/centers', { params });
  return data as Center[];
}

export async function createCenter(payload: { name: string; location?: string; region?: string; address?: string; orgId?: string }) {
  const { data } = await api.post('/centers', payload);
  return data as Center;
}

export async function updateCenter(id: string, payload: Partial<Pick<Center, 'name' | 'location' | 'region' | 'address' | 'status'>>) {
  const { data } = await api.patch(`/centers/${id}`, payload);
  return data as Center;
}

export async function deleteCenter(id: string) {
  await api.delete(`/centers/${id}`);
  return { ok: true };
}
