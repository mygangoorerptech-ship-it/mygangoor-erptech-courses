//mygf/src/admin/api/reports.ts
import { api } from '../../api/client';

export interface ReportItemDTO {
  id: string;
  student: { id: string; name: string; email: string };
  course: { id: string; title: string; isBundled: boolean; chapterCount: number };
  orgId: string;
  statuses: Array<{ chapterIndex: number; status: string; updatedAt?: string }>;
  overallStatus: string;
  certificateUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportsListResponse {
  items: ReportItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportFilters {
  orgId?: string;
  studentId?: string;
  courseId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function listReports(filters: ReportFilters = {}): Promise<ReportsListResponse> {
  const r = await api.get('/reports', { params: filters });
  return r.data as ReportsListResponse;
}

export async function upsertReport(payload: {
  studentId: string;
  courseId: string;
  statuses?: Array<{ chapterIndex: number; status: string }>;
  overallStatus?: string;
}) {
  const r = await api.post('/reports', payload);
  return r.data;
}

export async function deleteReport(id: string) {
  const r = await api.delete(`/reports/${id}`);
  return r.data;
}

export async function publishCertificate(id: string, url: string) {
  const r = await api.post(`/reports/${id}/certificate`, { url });
  return r.data;
}

export async function exportReportsCsv(filters: ReportFilters = {}): Promise<Blob> {
  const r = await api.get('/reports/export/csv', { params: filters, responseType: 'blob' });
  return r.data;
}
