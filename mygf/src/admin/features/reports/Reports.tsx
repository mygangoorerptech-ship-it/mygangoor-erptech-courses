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
import {
  Pencil,
  Trash2,
  FileCheck2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { FilePlus2 } from 'lucide-react';
import TemplateModal from './TemplateModal';
import { fetchCertificateBlobFromUrl } from '../../api/certificates';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

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

type ReportStatus =
  | 'not-started'
  | 'complete'
  | 'completed';

type Filters = {
  q: string;
  orgId: string;
  studentId: string;
  courseId: string;
  status: '' | ReportStatus;
};

type ReportSectionKey =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'older';

type SectionState = Record<
  ReportSectionKey,
  {
    collapsed: boolean;
    page: number;
  }
>;

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
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${blobUrl ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
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
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${blobUrl ? 'bg-white hover:bg-slate-50 text-slate-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
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
  const [filters, setFilters] = useState<Filters>({
    q: '',
    orgId: '',
    studentId: '',
    courseId: '',
    status: '',
  });
  const [search, setSearch] = useState('');

  const SECTION_PAGE_SIZE = 5;

  const [sections, setSections] = useState<SectionState>({
    today: {
      collapsed: false,
      page: 1,
    },

    yesterday: {
      collapsed: false,
      page: 1,
    },

    last7days: {
      collapsed: false,
      page: 1,
    },

    older: {
      collapsed: true,
      page: 1,
    },
  });

  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        q: search.trim(),
      }));
    }, 400);

    return () => clearTimeout(t);
  }, [search]);
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

  // Data: reports list (table)
  const reportsQ = useQuery<ReportsListResponse>({
    queryKey: ['reports:list', { ...filters, role }],

    queryFn: async () =>
      listReports({
        limit: 5000,

        q: filters.q || undefined,
        orgId: filters.orgId || undefined,
        studentId: filters.studentId || undefined,
        courseId: filters.courseId || undefined,
        status: filters.status || undefined,
      }),

    staleTime: 60 * 1000,
  });

  const reports = (reportsQ.data?.items || []) as ReportItem[];

  // Mutations
  const upsertMut = useMutation({
    mutationFn: (payload: any) =>
      upsertReport(payload),

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['reports:list'],
        type: 'active',
      });

      toast.success(
        'Progress updated successfully'
      );
    },

    onError: (err: any) => {
      console.error(err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update progress'
      );
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiDeleteReport(id),

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['reports:list'],
        type: 'active',
      });

      toast.success(
        'Report deleted successfully'
      );
    },

    onError: (err: any) => {
      console.error(err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete report'
      );
    },
  });
  const publishMut = useMutation({
    mutationFn: ({
      id,
      url,
    }: {
      id: string;
      url: string;
    }) =>
      apiPublishCertificate(id, url),

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['reports:list'],
        type: 'active',
      });

      toast.success(
        'Certificate updated successfully'
      );
    },

    onError: (err: any) => {
      console.error(err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update certificate'
      );
    },
  });

  const studentsQ = useQuery({
    queryKey: ['reports:students', filters.orgId],
    queryFn: async () => {
      const r = await listReports({
        orgId: filters.orgId || undefined,
        limit: 1000,
      });

      const map = new Map();

      (r.items || []).forEach((it: any) => {
        if (!map.has(it.student.id)) {
          map.set(it.student.id, {
            value: it.student.id,
            label: it.student.name || it.student.email,
          });
        }
      });

      return Array.from(map.values()).sort((a: any, b: any) =>
        a.label.localeCompare(b.label)
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  const coursesQ = useQuery({
    queryKey: ['reports:courses', filters.orgId],
    queryFn: async () => {
      const r = await listReports({
        orgId: filters.orgId || undefined,
        limit: 1000,
      });

      const map = new Map();

      (r.items || []).forEach((it: any) => {
        if (!map.has(it.course.id)) {
          map.set(it.course.id, {
            value: it.course.id,
            label: it.course.title,
          });
        }
      });

      return Array.from(map.values()).sort((a: any, b: any) =>
        a.label.localeCompare(b.label)
      );
    },
    staleTime: 5 * 60 * 1000,
  });

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

  function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  const groupedReports = useMemo(() => {
    const now = new Date();

    const today = startOfDay(now);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const last7 = new Date(today);
    last7.setDate(today.getDate() - 7);

    const groups: Record<ReportSectionKey, ReportItem[]> = {
      today: [],
      yesterday: [],
      last7days: [],
      older: [],
    };

    [...reports]
      .sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime()
        - new Date(a.updatedAt || a.createdAt || 0).getTime()
      )
      .forEach((r) => {
        const dt = startOfDay(
          new Date(r.updatedAt || r.createdAt || Date.now())
        );

        if (dt.getTime() === today.getTime()) {
          groups.today.push(r);
        } else if (dt.getTime() === yesterday.getTime()) {
          groups.yesterday.push(r);
        } else if (dt >= last7) {
          groups.last7days.push(r);
        } else {
          groups.older.push(r);
        }
      });

    return groups;
  }, [reports]);

  React.useEffect(() => {
    setSections({
      today: {
        collapsed: false,
        page: 1,
      },

      yesterday: {
        collapsed: false,
        page: 1,
      },

      last7days: {
        collapsed: false,
        page: 1,
      },

      older: {
        collapsed: true,
        page: 1,
      },
    });
  }, [filters, reports.length]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <header className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-12">

          {/* SEARCH */}
          <div className="lg:col-span-4">
            <Label>Search</Label>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <Input
                className="pl-9 pr-9"
                placeholder="Search student or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* ORG */}
          {isSA && (
            <div className="lg:col-span-2">
              <Label>Organization</Label>

              <Select
                value={filters.orgId}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    orgId: e.target.value,
                    studentId: '',
                    courseId: '',
                  }));
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

          {/* STUDENT */}
          <div className="lg:col-span-2">
            <Label>Student</Label>

            <Select
              value={filters.studentId}
              onChange={(e) => {
                setFilters(prev => ({
                  ...prev,
                  studentId: e.target.value,
                }));

              }}
            >
              <option value="">All Students</option>

              {(studentsQ.data || []).map((o: any) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {/* COURSE */}
          <div className="lg:col-span-2">
            <Label>Course</Label>

            <Select
              value={filters.courseId}
              onChange={(e) => {
                setFilters(prev => ({
                  ...prev,
                  courseId: e.target.value,
                }));

              }}
            >
              <option value="">All Courses</option>

              {(coursesQ.data || []).map((o: any) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {/* STATUS */}
          <div className="lg:col-span-2">
            <Label>Status</Label>

            <Select
              value={filters.status}
              onChange={(e) => {
                setFilters(prev => ({
                  ...prev,
                  status: e.target.value as Filters['status'],
                }));

              }}
            >
              <option value="">All Status</option>
              <option value="not-started">Not Started</option>
              <option value="complete">Chapter Complete</option>
              <option value="completed">Fully Completed</option>
            </Select>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">

          {/* ACTIVE FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            {filters.q && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                Search: {filters.q}
              </span>
            )}

            {filters.status && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                {filters.status}
              </span>
            )}

            {filters.studentId && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                Student selected
              </span>
            )}

            {filters.courseId && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                Course selected
              </span>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');

                setFilters({
                  q: '',
                  orgId: '',
                  studentId: '',
                  courseId: '',
                  status: '',
                });
              }}
            >
              Reset Filters
            </Button>

            <Button
              variant="secondary"
              onClick={handleExport}
            >
              <Download size={16} />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="space-y-5">

        {[
          {
            key: 'today',
            label: 'Today',
          },

          {
            key: 'yesterday',
            label: 'Yesterday',
          },

          {
            key: 'last7days',
            label: 'Last 7 Days',
          },

          {
            key: 'older',
            label: 'Older Reports',
          },
        ].map((section) => {
          const key =
            section.key as ReportSectionKey;

          const rows =
            groupedReports[key] || [];

          const state =
            sections[key];

          const totalPages =
            Math.max(
              1,
              Math.ceil(rows.length / SECTION_PAGE_SIZE)
            );

          const paginatedRows =
            rows.slice(
              (state.page - 1) * SECTION_PAGE_SIZE,
              state.page * SECTION_PAGE_SIZE
            );

          return (
            <section
              key={key}
              className="rounded-2xl border bg-white shadow-sm overflow-hidden"
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() =>
                  setSections(prev => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      collapsed: !prev[key].collapsed,
                    },
                  }))
                }
                className="flex w-full items-center justify-between bg-slate-50 px-5 py-4 text-left hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-3">
                  {state.collapsed ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}

                  <div>
                    <div className="font-semibold text-slate-800">
                      {section.label}
                    </div>

                    <div className="text-xs text-slate-500">
                      {rows.length} reports
                    </div>
                  </div>
                </div>
              </button>

              {!state.collapsed && (
                <>
                  {/* TABLE */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left font-medium p-3">
                            Student
                          </th>

                          <th className="text-left font-medium p-3">
                            Course
                          </th>

                          <th className="text-left font-medium p-3">
                            Progress
                          </th>

                          <th className="text-left font-medium p-3">
                            Status
                          </th>

                          <th className="text-left font-medium p-3">
                            Updated
                          </th>

                          <th className="text-left font-medium p-3">
                            Certificate
                          </th>

                          <th className="text-left font-medium p-3 w-48">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {paginatedRows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t"
                          >
                            <td className="p-3">
                              <div className="font-medium">
                                {r.student.name || r.student.email}
                              </div>

                              <div className="text-xs text-slate-500">
                                {r.student.email}
                              </div>
                            </td>

                            <td className="p-3">
                              {r.course.title}
                            </td>

                            <td className="p-3">
                              {progressSummary(r)}
                            </td>

                            <td className="p-3">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                                {r.overallStatus || '—'}
                              </span>
                            </td>

                            <td className="p-3 whitespace-nowrap text-xs text-slate-500">
                              {new Date(
                                r.updatedAt || r.createdAt || ''
                              ).toLocaleString()}
                            </td>

                            <td className="p-3">
                              {r.certificateUrl ? (
                                <button
                                  type="button"
                                  className="text-indigo-600 hover:underline"
                                  onClick={() =>
                                    setPreviewItem(r)
                                  }
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

                        {paginatedRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-6 text-center text-slate-500"
                            >
                              No reports
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION */}
                  {rows.length > SECTION_PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t bg-white px-5 py-3">
                      <div className="text-xs text-slate-500">
                        Showing {(state.page - 1) * SECTION_PAGE_SIZE + 1}
                        –
                        {Math.min(
                          state.page * SECTION_PAGE_SIZE,
                          rows.length
                        )}{' '}
                        of {rows.length}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          disabled={state.page <= 1}
                          onClick={() =>
                            setSections(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                page: Math.max(
                                  1,
                                  prev[key].page - 1
                                ),
                              },
                            }))
                          }
                        >
                          Prev
                        </Button>

                        <span className="text-sm text-slate-600">
                          {state.page} / {totalPages}
                        </span>

                        <Button
                          variant="secondary"
                          disabled={
                            state.page >= totalPages
                          }
                          onClick={() =>
                            setSections(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                page: Math.min(
                                  totalPages,
                                  prev[key].page + 1
                                ),
                              },
                            }))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      {/* Edit progress modal */}
      {editItem && (
        <ProgressModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (payload) => {
            await upsertMut.mutateAsync({
              orgId: editItem.orgId,
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
  const [saving, setSaving] =
    useState(false);
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

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);

      if (isBundled) {
        await onSave({
          statuses: states as any,
        });
      } else {
        await onSave({
          overallStatus:
            (states as any).overallStatus,
        });
      }
    } finally {
      setSaving(false);
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
          <Button
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save'}
          </Button>
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
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);

      let finalUrl = '';

      if (mode === 'url') {
        finalUrl = url.trim();
      } else if (mode === 'upload') {
        finalUrl =
          fileDataUrl.trim();
      } else if (mode === 'template') {
        finalUrl =
          `template:${selectedTemplate}`;
      }

      await onSave(finalUrl);
    } finally {
      setSaving(false);
    }
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
          <Button
            type="submit"
            disabled={
              saving ||
              (mode === 'upload' &&
                !fileDataUrl)
            }
          >
            {saving
              ? 'Saving...'
              : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
