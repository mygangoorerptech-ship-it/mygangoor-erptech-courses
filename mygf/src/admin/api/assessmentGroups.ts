// src/admin/api/assessmentGroups.ts
import { api } from "./client";

export type AssessmentGroup = {
  _id: string;
  name: string;
  scope: "global" | "org";
  orgId?: string | null;
  isActive?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function listAssessmentGroups(params?: Record<string, any>): Promise<AssessmentGroup[]> {
  const { data } = await api.get("assessment-groups", { params });
  return data.groups || [];
}

export async function createAssessmentGroup(payload: { name: string; scope: "global" | "org"; orgId?: string | null }) {
  const { data } = await api.post("assessment-groups", payload);
  return data.group as AssessmentGroup;
}

export async function updateAssessmentGroup(id: string, payload: Partial<AssessmentGroup>) {
  const { data } = await api.put(`assessment-groups/${id}`, payload);
  return data.group as AssessmentGroup;
}

export async function deleteAssessmentGroup(id: string) {
  const { data } = await api.delete(`assessment-groups/${id}`);
  return data.ok === true;
}
