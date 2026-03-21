// mygf/src/admin/features/reports/Reports.tsx
import React, { useMemo, useState } from 'react';
import { useAuth } from '../../auth/store';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { Role } from '../../../config/nav';
import {
  listReports,
  upsertReport,
  deleteReport as apiDeleteReport,
  publishCertificate as apiPublishCertificate,
  exportReportsCsv,
  type ReportsListResponse,
} from '../../api/reports';
import { listOrganizations } from '../../api/organizations';
import Button from '../../components/Button';
import { Input, Label, Select } from '../../components/Input';
import Modal from '../../components/Modal';
import { Pencil, Trash2, FileCheck2, Download, ExternalLink } from 'lucide-react';
import { FilePlus2 } from 'lucide-react';
import TemplateModal from './TemplateModal';
import { fetchCertificateBlobFromUrl } from '../../api/certificates';

// Types for local state
interface ReportItem {
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

type Filters = {
  orgId?: string;
  studentId?: string;
  courseId?: string;
  status?: string;
};

function CertificatePreviewModal({
  item,
  onClose,
}: {
  item: ReportItem;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('certificate.pdf');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // deterministic fallback "mithun_student--react_course.pdf"
  const slug = (s: string) =>
    (s || '')
      .normalize('NFD')                // strip accents
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')     // non-alnum -> _
      .replace(/^_+|_+$/g, '');        // trim _
  const fallbackFileName = `${slug(item.student.name || item.student.email)}--${slug(item.course.title)}.pdf`;

  React.useEffect(() => {
    let toRevoke: string | null = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const url = item.certificateUrl || '';
        if (!url) {
          setError('No certificate URL found.');
          setLoading(false);
          return;
        }

const { blob, filename } = await fetchCertificateBlobFromUrl(url);

// Ensure correct MIME so PDF viewers paint properly
let pdfBlob = blob;
if (blob.type !== 'application/pdf') {
  const buf = await blob.arrayBuffer();
  pdfBlob = new Blob([buf], { type: 'application/pdf' });
}

const objUrl = window.URL.createObjectURL(pdfBlob);
toRevoke = objUrl;
setBlobUrl(objUrl);
setFileName(filename || fallbackFileName);

      } catch (e: any) {
        console.error('preview fetch failed', e);
        setError(e?.message || 'Failed to load certificate');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (toRevoke) window.URL.revokeObjectURL(toRevoke);
    };
  }, [item.certificateUrl, fallbackFileName]);

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="xl"
      title={`Certificate – ${item.student.name || item.student.email} • ${item.course.title}`}
    >
      <div className="grid gap-4 md:grid-cols-[1fr,320px]">
        <div className="rounded-lg border bg-slate-50 p-2">
          {loading && (
            <div className="h-[70vh] flex items-center justify-center text-slate-500">
              Loading PDF…
            </div>
          )}
          {!loading && error && (
            <div className="h-[70vh] flex items-center justify-center">
              <div className="text-center">
                <div className="text-rose-600 font-medium mb-1">Unable to load</div>
                <div className="text-sm text-slate-600">{error}</div>
              </div>
            </div>
          )}
{!loading && !error && blobUrl && (
  <iframe
    key={blobUrl}               // force repaint if URL changes
    src={blobUrl}
    title="Certificate Preview"
    className="w-full h-[70vh] rounded-md shadow-sm bg-white"
  />
)}

        </div>

        <aside className="h-max rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Student</div>
            <div className="font-medium">{item.student.name || item.student.email}</div>
            <div className="text-xs text-slate-500">{item.student.email}</div>
          </div>

          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Course</div>
            <div className="font-medium">{item.course.title}</div>
          </div>

          <div className="mb-6">
            <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
            <div className="inline-block rounded px-2 py-0.5 bg-slate-100 text-slate-700 text-sm">
              {item.overallStatus || '—'}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={blobUrl || '#'}
              download={fileName}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${
                blobUrl ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
              onClick={(e) => { if (!blobUrl) e.preventDefault(); }}
            >
              <Download size={16} />
              Download
            </a>

            <a
              href={blobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${
                blobUrl ? 'bg-white hover:bg-slate-50 text-slate-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
              onClick={(e) => { if (!blobUrl) e.preventDefault(); }}
            >
              <ExternalLink size={16} />
              Open in new tab
            </a>

            <button
              type="button"
              className="mt-3 text-slate-600 hover:text-slate-800 text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {item.certificateUrl && (
            <div className="mt-6 border-t pt-3">
              <div className="text-xs text-slate-500">Source URL</div>
              <div className="text-xs text-slate-700 break-all">{item.certificateUrl}</div>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}

export default function Reports() {
  const qc = useQueryClient();
  const { user } = useAuth() as any;
  const role: Role = (user?.role || '').toLowerCase() as Role;
  const isSA = role === 'superadmin';
  const isTeacher = role === 'teacher';

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  // Modal state for editing progress
  const [editItem, setEditItem] = useState<ReportItem | null>(null);
  // Modal state for updating certificate
  const [certItem, setCertItem] = useState<ReportItem | null>(null);
  // Modal state for template-based certificate issuance
  const [templateItem, setTemplateItem] = useState<ReportItem | null>(null);

  // Lookups: organizations (only for SA)
  const orgsQ = useQuery({
    enabled: isSA,
    queryKey: ['reports:orgs'],
    queryFn: async () => {
      const res = await listOrganizations({ status: 'active', page: 1, limit: 200 });
      return Array.isArray(res.items) ? res.items : [];
    },
  });

  // Facets: derive dropdowns from the reports dataset itself
  const facetsQ = useQuery<ReportsListResponse>({
    queryKey: ['reports:facets', { role, orgId: isSA ? (filters.orgId || '') : 'self' }],
    queryFn: async () => {
      // Only scope by org for SA; admin/teacher are auto-scoped server-side
      const base: any = { page: 1, limit: 50 };
      if (isSA && filters.orgId) base.orgId = filters.orgId;
      return listReports(base);
    },
    placeholderData: keepPreviousData,
  });

  // Data: reports list (table)
  const reportsQ = useQuery<ReportsListResponse>({
    queryKey: ['reports:list', { ...filters, page, limit: PAGE_SIZE, role }],
    queryFn: async () => listReports({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const reports = (reportsQ.data?.items || []) as ReportItem[];
  const total = reportsQ.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Mutations
  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsertReport(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports:list'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports:list'] }),
  });
  const publishMut = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => apiPublishCertificate(id, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports:list'] }),
  });

  // Build Student/Course options from the reports dataset (facets)
  const facetItems = (facetsQ.data?.items || []) as ReportItem[];

  const studentOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts = facetItems
      .map((it) => ({
        value: it.student.id,
        label: it.student.name || it.student.email,
      }))
      .filter((o) => o.value && !seen.has(o.value) && (seen.add(o.value), true))
      .sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [facetItems]);

  const courseOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts = facetItems
      .map((it) => ({
        value: it.course.id,
        label: it.course.title,
      }))
      .filter((o) => o.value && !seen.has(o.value) && (seen.add(o.value), true))
      .sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [facetItems]);

  const orgOptions = useMemo(() => {
    if (!isSA) return [];
    const arr = Array.isArray(orgsQ.data) ? orgsQ.data : [];
    const base = [{ label: 'All', value: '' }, ...arr.map((o: any) => ({ label: o.name, value: String(o._id || o.id) }))];
    // de-dup by value
    const seen = new Set<string>();
    return base.filter((o) => !seen.has(o.value) && seen.add(o.value));
  }, [orgsQ.data, isSA]);

  const [previewItem, setPreviewItem] = useState<ReportItem | null>(null);

  // Handle CSV export
  const handleExport = async () => {
    try {
      const blob = await exportReportsCsv({ ...filters });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reports.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('export csv failed', e);
    }
  };

  // Compute progress summary
  function progressSummary(item: ReportItem): string {
    if (item.course.isBundled) {
      const statuses = (item.statuses ?? []) as Array<{
        chapterIndex: number;
        status: string;
        updatedAt?: string;
      }>;
      const completed = statuses.filter((s) => s.status === 'complete').length;
      const totalCh = item.course.chapterCount || 0;
      return `${completed}/${totalCh}`;
    }
    return item.overallStatus || '—';
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <header className="grid gap-3 md:grid-cols-6">
        {isSA && (
          <div>
            <Label>Organization</Label>
            <Select
              value={filters.orgId || ''}
              onChange={(e) => {
                const val = e.target.value || '';
                setFilters((s) => ({ ...s, orgId: val || undefined }));
                setPage(1);
              }}
            >
              {orgOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label>Student</Label>
          <Select
            value={filters.studentId || ''}
            onChange={(e) => {
              const val = e.target.value || '';
              setFilters((s) => ({ ...s, studentId: val || undefined }));
              setPage(1);
            }}
          >
            <option value="">Any</option>
            {studentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Course</Label>
          <Select
            value={filters.courseId || ''}
            onChange={(e) => {
              const val = e.target.value || '';
              setFilters((s) => ({ ...s, courseId: val || undefined }));
              setPage(1);
            }}
          >
            <option value="">Any</option>
            {courseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={filters.status || ''}
            onChange={(e) => {
              const val = e.target.value || '';
              setFilters((s) => ({ ...s, status: val || undefined }));
              setPage(1);
            }}
          >
            <option value="">Any</option>
            <option value="not-started">Not started</option>
            <option value="complete">Complete (any chapter)</option>
            <option value="completed">Completed (all)</option>
          </Select>
        </div>
        {/* Spacer */}
        <div className="md:col-span-1" />
        <div className="md:col-span-1 flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={handleExport} title="Export CSV">
            <Download size={16} /> Export
          </Button>
        </div>
      </header>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Student</th>
              <th className="text-left font-medium p-3">Course</th>
              <th className="text-left font-medium p-3">Progress</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3">Certificate</th>
              <th className="text-left font-medium p-3 w-48">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{r.student.name || r.student.email}</div>
                  <div className="text-xs text-slate-500">{r.student.email}</div>
                </td>
                <td className="p-3">
                  <div className="font-medium">{r.course.title}</div>
                </td>
                <td className="p-3">{progressSummary(r)}</td>
                <td className="p-3">
                  {r.overallStatus ? (
                    <span className="rounded px-2 py-0.5 bg-slate-100 text-slate-700">
                      {r.overallStatus}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
<td className="p-3">
  {r.certificateUrl ? (
    <button
      type="button"
      className="text-indigo-600 hover:underline"
      onClick={() => setPreviewItem(r)}
      title="Preview certificate"
    >
      View
    </button>
  ) : (
    '—'
  )}
</td>
                <td className="p-3 whitespace-nowrap space-x-2">
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => setEditItem(r)}
                  >
                    <Pencil size={14} />
                  </Button>

                  {(() => {
                    const statuses = (r.statuses ?? []) as ReportItem['statuses'];
                    const completedCount = statuses.filter((s) => s.status === 'complete').length;
                    const allComplete = r.course.isBundled
                      ? r.course.chapterCount > 0 && completedCount >= r.course.chapterCount
                      : r.overallStatus === 'completed';
                    return allComplete ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        title={r.certificateUrl ? 'Update certificate' : 'Publish certificate'}
                        onClick={() => setCertItem(r)}
                      >
                        <FileCheck2 size={14} />
                      </Button>
                    ) : null;
                  })()}

                  {/* Issue template certificate button. Visible only when progress is complete. */}
                  {(() => {
                    const statuses = (r.statuses ?? []) as ReportItem['statuses'];
                    const completedCount = statuses.filter((s) => s.status === 'complete').length;
                    const allComplete = r.course.isBundled
                      ? r.course.chapterCount > 0 && completedCount >= r.course.chapterCount
                      : r.overallStatus === 'completed';
                    return allComplete ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        title="Issue template certificate"
                        onClick={() => setTemplateItem(r)}
                      >
                        <FilePlus2 size={14} />
                      </Button>
                    ) : null;
                  })()}

                  {!isTeacher && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        if (confirm('Delete this report?')) deleteMut.mutate(r.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No reports
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          Showing{' '}
          {total === 0
            ? '0'
            : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`}{' '}
          of {total}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || reportsQ.isFetching}
            title="Previous page"
          >
            Prev
          </Button>
          <span className="text-sm text-slate-700">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || reportsQ.isFetching}
            title="Next page"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit progress modal */}
      {editItem && (
        <ProgressModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (payload) => {
            await upsertMut.mutateAsync({
              studentId: editItem.student.id,
              courseId: editItem.course.id,
              ...payload,
            });
            setEditItem(null);
          }}
        />
      )}

      {/* Certificate modal */}
      {certItem && (
        <CertificateModal
          item={certItem}
          onClose={() => setCertItem(null)}
          onSave={async (url) => {
            await publishMut.mutateAsync({ id: certItem.id, url });
            setCertItem(null);
          }}
        />
      )}

      {/* Template certificate issuance modal */}
      {templateItem && (
        <TemplateModal
          item={templateItem}
          onClose={() => setTemplateItem(null)}
        />
      )}

      {previewItem && (
  <CertificatePreviewModal
    item={previewItem}
    onClose={() => setPreviewItem(null)}
  />
)}
    </div>
  );
}

/**
 * Modal for updating progress. Shows a form with selects per chapter or
 * overall status depending on whether the course is bundled. The
 * caller supplies onSave() which is invoked with either
 * { statuses: [...] } or { overallStatus: ... }.
 */
function ProgressModal({
  item,
  onClose,
  onSave,
}: {
  item: ReportItem;
  onClose: () => void;
  onSave: (payload: { statuses?: Array<{ chapterIndex: number; status: string }>; overallStatus?: string }) => Promise<void>;
}) {
  const isBundled = item.course.isBundled;
  const [states, setStates] = useState(() => {
    if (isBundled) {
      // Build array for each chapter index with existing status or default
      const map = new Map<number, string>();
      (item.statuses || []).forEach((s) => {
        map.set(s.chapterIndex, s.status || 'not-started');
      });
      const arr: Array<{ chapterIndex: number; status: string }> = [];
      for (let i = 0; i < item.course.chapterCount; i++) {
        arr.push({ chapterIndex: i, status: map.get(i) || 'not-started' });
      }
      return arr;
    }
    return { overallStatus: item.overallStatus || 'not-started' } as any;
  });

  const handleChange = (idx: number, value: string) => {
    setStates((s) => {
      if (isBundled) {
        const clone = [...(s as any)];
        clone[idx] = { chapterIndex: idx, status: value };
        return clone;
      }
      return { overallStatus: value } as any;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBundled) {
      await onSave({ statuses: states as any });
    } else {
      await onSave({ overallStatus: (states as any).overallStatus });
    }
  };

  return (
    <Modal open={true} title={`Update Progress - ${item.course.title}`} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-1">Student</div>
          <div className="text-sm text-slate-700">
            {item.student.name || item.student.email} ({item.student.email})
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Course</div>
          <div className="text-sm text-slate-700">{item.course.title}</div>
        </div>
        {isBundled ? (
          <div className="space-y-4">
            {Array.from({ length: item.course.chapterCount }).map((_, idx) => (
              <div key={idx} className="grid md:grid-cols-3 gap-2 items-center">
                <div className="text-sm font-medium">Chapter {idx + 1}</div>
                <Select
                  value={(states as any)[idx]?.status || 'not-started'}
                  onChange={(e) => handleChange(idx, e.target.value)}
                >
                  <option value="not-started">Not started</option>
                  <option value="complete">Complete</option>
                </Select>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-2 items-center">
            <div className="text-sm font-medium">Status</div>
            <Select
              value={(states as any).overallStatus || 'not-started'}
              onChange={(e) => handleChange(0, e.target.value)}
            >
              <option value="not-started">Not started</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
        )}
        <div className="pt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Modal for editing or publishing a certificate URL. Allows the
 * administrator/teacher to paste a URL or remove the existing one.
 */
function CertificateModal({
  item,
  onClose,
  onSave,
}: {
  item: ReportItem;
  onClose: () => void;
  onSave: (url: string) => Promise<void>;
}) {
  // Certificate modal now supports three modes:
  // 1. URL – paste a link to a hosted PDF certificate
  // 2. Upload – upload a local PDF file; the file will be converted to a Data URL
  // 3. Template – choose a pre‑built HTML template (stored in src/assets/certificateTemplates)

  // Available templates. When adding new templates under
  // src/assets/certificateTemplates, list them here with a label.
  const TEMPLATE_OPTIONS = useMemo(
    () => [
      { value: 'default', label: 'Classic Certificate' },
    ],
    []
  );

  // Define a union type for the certificate sources
  type CertMode = 'url' | 'upload' | 'template';

  // Determine initial mode based on existing certificate URL
  const initialMode = useMemo<CertMode>(() => {
    const existing = item.certificateUrl || '';
    if (existing.startsWith('data:')) return 'upload';
    if (existing.startsWith('template:')) return 'template';
    return 'url';
  }, [item.certificateUrl]);

  const [mode, setMode] = useState<CertMode>(initialMode);
  // Text URL state for URL mode
  const [url, setUrl] = useState(item.certificateUrl || '');
  // Data URL state for upload mode
  const [fileDataUrl, setFileDataUrl] = useState('');
  // Selected template for template mode
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    const existing = item.certificateUrl || '';
    return existing.startsWith('template:') ? existing.slice('template:'.length) : TEMPLATE_OPTIONS[0].value;
  });

  // Handle file uploads – convert the selected PDF into a Data URL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setFileDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = '';
    if (mode === 'url') {
      finalUrl = url.trim();
    } else if (mode === 'upload') {
      finalUrl = fileDataUrl.trim();
    } else if (mode === 'template') {
      finalUrl = `template:${selectedTemplate}`;
    }
    await onSave(finalUrl);
  };

  return (
    <Modal open={true} title={`Certificate - ${item.course.title}`} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label>Certificate Source</Label>
          <div className="space-y-1 mt-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="certMode"
                value="url"
                checked={mode === 'url'}
                onChange={() => setMode('url')}
              />
              <span>URL</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="certMode"
                value="upload"
                checked={mode === 'upload'}
                onChange={() => setMode('upload')}
              />
              <span>Upload PDF</span>
            </label>
          </div>
        </div>

        {mode === 'url' && (
          <div>
            <Label>Certificate URL</Label>
            <Input
              type="url"
              placeholder="https://example.com/certificate.pdf"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Paste a link to a PDF or hosted certificate. Leave blank to remove.
            </p>
          </div>
        )}

        {mode === 'upload' && (
          <div>
            <Label>Upload PDF certificate</Label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-pink-500 file:to-blue-500 file:text-white hover:file:cursor-pointer"
            />
            {fileDataUrl && (
              <p className="text-xs text-green-600 mt-1">PDF selected. Click Save to publish.</p>
            )}
            {!fileDataUrl && (
              <p className="text-xs text-slate-500 mt-1">Select a PDF file to upload.</p>
            )}
          </div>
        )}

        <div className="pt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mode === 'upload' && !fileDataUrl}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
