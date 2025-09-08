// mygf/src/admin/features/courses/Courses.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../auth/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Course, CourseFilters, CourseStatus } from "../../types/course";
import {
  listSaCourses, createSaCourse, updateSaCourse, deleteSaCourse, setSaCourseStatus, bulkUpsertSaCourses,
} from "../../api/saCourses";
import {
  fetchCourses as listAdCourses, createCourse as createAdCourse,
  updateCourse as updateAdCourse, deleteCourse as deleteAdCourse, setCourseStatus as setAdCourseStatus,
  bulkUpsertCourses,
} from "../../api/courses";
import { listOrganizations, type Organization } from "../../api/organizations";
import { listSaUsers } from "../../api/saUsers";
import type { SAUser } from "../../types/user";
import Button from "../../components/Button";
import { Input, Label, Select } from "../../components/Input";
import { Pencil, Trash2, Plus, CheckCircle2, XCircle, Upload } from "lucide-react";

// NEW imports (split files)
import CourseFormModal from "./CourseForm";
import BulkUploadModal from "./BulkUploadModal";
import { PreviewButton } from "./CoursePreview";
import { formatINRFromPaise } from "../../utils/currency";

type Filters = { q: string; status: "all" | CourseStatus; orgId?: string; ownerEmail?: string };

export default function CoursesUnified() {
  const qc = useQueryClient();
  const { user } = useAuth() as any;
  const role: string = (user?.role || "").toLowerCase();

  const [filters, setFilters] = useState<Filters>({ q: "", status: "all" });
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ mode: "create" | "edit"; initial?: Course } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const isSA = role === "superadmin";

  // Lookups
  const orgsQ = useQuery<Organization[]>({
    enabled: isSA,
    queryKey: ["orgs-lite"],
    queryFn: async () => {
      const res = await listOrganizations({ q: "", status: "active" } as any);
      return Array.isArray(res) ? res : Array.isArray((res as any).items) ? (res as any).items : [];
    },
  });

  const adminsQ = useQuery<SAUser[]>({
    enabled: isSA,
    queryKey: ["sa-admins:lookup"],
    queryFn: () => listSaUsers({ role: "admin" } as any),
  });

  // Data
  const query = useQuery({
    queryKey: ["courses:unified", { ...filters, role, page, limit: PAGE_SIZE }],
    queryFn: async () => {
      if (isSA) {
        const params: CourseFilters = {
          q: filters.q || undefined,
          status: filters.status,
          orgId: filters.orgId && filters.orgId !== "all" ? filters.orgId : undefined,
          ownerEmail: filters.ownerEmail || undefined,
          page,
          limit: PAGE_SIZE,
        };
        return listSaCourses(params);
      }
      return listAdCourses({ q: filters.q || undefined, status: filters.status, page, limit: PAGE_SIZE } as any);
    },
  });

    const paged = query.data ?? { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const rows: Course[] = (paged as any).items ?? [];
  const total: number = (paged as any).total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Mutations
  const createMut = useMutation({
    mutationFn: (payload: any) => (isSA ? createSaCourse(payload) : createAdCourse(payload)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      isSA ? updateSaCourse(id, patch) : updateAdCourse(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CourseStatus }) =>
      isSA ? setSaCourseStatus(id, status) : setAdCourseStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => (isSA ? deleteSaCourse(id) : deleteAdCourse(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const importMut = useMutation({
    mutationFn: (rows: any[]) => (isSA ? bulkUpsertSaCourses(rows) : bulkUpsertCourses(rows)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });

  // Options
  const owners = useMemo(() => (Array.isArray(adminsQ.data) ? adminsQ.data : []).map(a => ({ label: a.name || a.email, value: a.email })), [adminsQ.data]);
  const orgOptions = useMemo(() => {
    const arr = Array.isArray(orgsQ.data) ? orgsQ.data : [];
    const base = [
      { label: "All", value: "all" },
      { label: "Global", value: "global" },
      ...arr.map((o: any) => ({
        label: o.name,
        value: String(o._id ?? o.id ?? ""),
      })),
    ];
    // de-dupe by value (guards against double-inserts on slow loads)
    const seen = new Set<string>();
    return base.filter((o) => !seen.has(o.value) && seen.add(o.value));
  }, [orgsQ.data]);

  // ⬇️ Form-only options: NO "All". Ensure the current course org appears, without duplicates.
  const orgFormOptions = useMemo(() => {
    const arr = Array.isArray(orgsQ.data) ? orgsQ.data : [];
    const list = [
      { label: "Global", value: "global" },
      ...arr.map((o: any) => ({
        label: o.name,
        value: String(o._id ?? o.id ?? ""),
      })),
    ];
    // current course org (null => "global")
    const currentId = open?.mode === "edit"
      ? (open?.initial?.orgId ? String(open.initial.orgId) : "global")
      : "global";

    // if current not present, append it once
    const hasCurrent = list.some((o) => o.value === currentId);
    const withCurrent = hasCurrent
      ? list
      : [
          ...list,
          {
            label:
              (open?.initial as any)?.orgName ||
              (currentId === "global" ? "Global" : currentId),
            value: currentId,
          },
        ];

    // final de-dupe by value
    const seen = new Set<string>();
    return withCurrent.filter((o) => !seen.has(o.value) && seen.add(o.value));
  }, [orgsQ.data, open]);

  // Reset to page 1 whenever filters change
  React.useEffect(() => { setPage(1); }, [filters.q, filters.status, filters.orgId, filters.ownerEmail]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input
            placeholder="title, slug, category…"
            value={filters.q}
            onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value as any }))}>
            <option value="all">All</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
          </Select>
        </div>

        {isSA ? (
          <>
            <div>
              <Label>Org</Label>
              <Select value={filters.orgId || "all"} onChange={(e) => setFilters((s) => ({ ...s, orgId: e.target.value }))}>
                {orgOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Owner (Admin)</Label>
              <Select value={filters.ownerEmail || ""} onChange={(e) => setFilters((s) => ({ ...s, ownerEmail: e.target.value || undefined }))}>
                <option value="">Any</option>
                {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </>
        ) : (<div className="md:col-span-2" />)}

        <div className="md:col-span-1 flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={() => setBulkOpen(true)}><Upload size={16} /> Bulk Upload</Button>
          <Button onClick={() => setOpen({ mode: "create" })}><Plus size={16} /> New</Button>
        </div>
      </header>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Title</th>
              <th className="text-left font-medium p-3">Category</th>
              <th className="text-left font-medium p-3">Price</th>
              {isSA && <th className="text-left font-medium p-3">Owner</th>}
              {isSA && <th className="text-left font-medium p-3">Org</th>}
              <th className="text-left font-medium p-3">Bundle</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-72">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: Course) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  {c.slug && <div className="text-xs text-slate-500">/{c.slug}</div>}
                    {/* meta badges (tiny, unobtrusive) */}
  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
    {/* Free/Paid */}
    <span
      className={
        (c.courseType ?? "paid") === "free"
          ? "rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700"
          : "rounded px-1.5 py-0.5 bg-slate-100 text-slate-700"
      }
      title="Course type"
    >
      {(c.courseType ?? "paid") === "free" ? "Free" : "Paid"}
    </span>
    {/* Duration */}
    {!!c.durationText && (
      <span className="rounded px-1.5 py-0.5 bg-sky-50 text-sky-700" title="Duration">
        {c.durationText}
      </span>
    )}
    {/* Teacher */}
    {(((c as any).teacherName) || ((c as any).teacherEmail)) && (
      <span className="rounded px-1.5 py-0.5 bg-violet-50 text-violet-700" title="Teacher">
        {((c as any).teacherName) || ((c as any).teacherEmail)}
      </span>
    )}
  </div>
                </td>
                <td className="p-3">{c.category || "—"}</td>
                <td className="p-3">{formatINRFromPaise(c.price)}</td>
                {isSA && <td className="p-3">{(c as any).ownerName || (c as any).ownerEmail || "—"}</td>}
                {isSA && <td className="p-3">{(c as any).orgName || (c.orgId ? c.orgId : "Global")}</td>}
                <td className="p-3">{c.isBundled ? `Yes (${c.chapters?.length ?? 0})` : "No"}</td>
                <td className="p-3">
                  <span className={c.status === "published" ? "text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"
                    : c.status === "draft" ? "text-amber-700 bg-amber-50 rounded px-2 py-0.5"
                    : "text-slate-700 bg-slate-100 rounded px-2 py-0.5"}>{c.status}</span>
                </td>
                <td className="p-3 whitespace-nowrap space-x-2">
                  {/* Preview from shared component (table action) */}
                  {c.isBundled && (c.chapters?.length ?? 0) > 0 && <PreviewButton chapters={c.chapters!} />}
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen({ mode: "edit", initial: c })}><Pencil size={14} /></Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs"
                    onClick={() => statusMut.mutate({ id: c.id, status: c.status === "published" ? "draft" : "published" })}
                    title={c.status === "published" ? "Set Draft" : "Publish"}>
                    {c.status === "published" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => deleteMut.mutate(c.id)}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">No courses</td></tr>
            )}
          </tbody>
        </table>
      </div>

        {/* Pagination controls */} 
      <div className="flex items-center justify-between gap-3"> 
        <div className="text-xs text-slate-600"> 
          Showing{" "} 
          {total === 0 
            ? "0" 
            : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`}{" "} 
          of {total} 
        </div> 
        <div className="flex items-center gap-2"> 
          <Button 
            variant="secondary" 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            disabled={page <= 1 || query.isFetching} 
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
            disabled={page >= totalPages || query.isFetching} 
            title="Next page" 
          > 
            Next 
          </Button> 
        </div> 
      </div>

      {!!open && (
        <CourseFormModal
          open={true}
          mode={open.mode}
          initial={open.initial}
          role={role}
          orgs={orgFormOptions}
          admins={owners}
          onClose={() => setOpen(null)}
          onSubmit={async (payload) => {
            const toServer = { ...payload, price: payload.price, chapters: payload.isBundled ? payload.chapters ?? [] : [],
                            description: (payload.description ?? "") || undefined,
              tags: Array.isArray(payload.tags) ? payload.tags : [],
             };
            if (open.mode === "create") await createMut.mutateAsync(toServer);
            else if (open.initial?.id) await updateMut.mutateAsync({ id: open.initial.id, patch: toServer });
          }}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          role={role}
          orgs={orgOptions}
          admins={owners}
          onClose={() => setBulkOpen(false)}
          onImport={async (rows) => { await importMut.mutateAsync(rows); setBulkOpen(false); }}
        />
      )}
    </div>
  );
}
