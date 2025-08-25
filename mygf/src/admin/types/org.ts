// mygf/src/admin/types/org.ts
export type OrgStatus = 'active' | 'inactive' | 'suspended';

export interface Organization {
  id: string;
  code: string;
  name: string;

  // Optional org profile fields (match backend + UI)
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  notes?: string;

  status: OrgStatus;
  suspended?: boolean;          // surfaced separately in UI
  createdAt?: string;
  updatedAt?: string;
}

export type OrgFilters = {
  q?: string;
  status?: 'all' | OrgStatus;
};
