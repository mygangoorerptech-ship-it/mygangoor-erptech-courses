// src/admin/api/assessments.ts
import { api } from './client';
import type {
  Assessment,
  AssessmentStatus,
  AssessmentFilters,
} from '../types/assessment'

export type ListParams = {
  q?: string;
  status?: "all" | "draft" | "published" | "archived";
  orgId?: string | "global";
};

export async function listAssessments(params: ListParams = {}): Promise<Assessment[]> {
  const { data } = await api.get("assessments", { params });
  return data as Assessment[];
}

export async function createAssessment(
  payload: Partial<Assessment> & { title: string; orgId?: string | null }
): Promise<Assessment> {
  const { data } = await api.post("assessments", payload);
  return data as Assessment;
}

export async function updateAssessment(id: string, changes: Partial<Assessment>): Promise<Assessment> {
  const { data } = await api.patch(`assessments/${id}`, changes);
  return data as Assessment;
}

export async function setAssessmentStatus(id: string, status: "draft" | "published" | "archived"): Promise<Assessment> {
  const { data } = await api.post(`assessments/${id}/status`, { status });
  return data as Assessment;
}

export async function deleteAssessment(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`assessments/${id}`);
  return data as { ok: boolean };
}