// mygf/src/admin/pages/superadmin/Assessments.tsx
import { useEffect, useMemo, useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Assessment } from "../../types/assessment";
import { useAuth } from "../../auth/store";
import {
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  setAssessmentStatus,
} from "../../api/assessments";
import { listOrganizations } from "../../api/organizations";
import {
  listAssessmentGroups,
  createAssessmentGroup,
} from "../../api/assessmentGroups";

type QuestionType = "mcq" | "truefalse" | "puzzle";
export type AssessmentQuestion = {
  type: QuestionType;
  text: string;
  options?: string[];
  answer: any;
  points?: number;
  explanation?: string;
};

type Draft = {
  title: string;
  description?: string;
  status: "draft" | "published";
  isActive: boolean;
  scope: "global" | "org";
  orgId?: string | null;
  groupId?: string | null;
  group?: string;
  groupOrder?: number | null;
  openAt?: string | null;
  closeAt?: string | null;
  timeLimitSeconds?: number | null;
  maxAttempts?: number;
  questions: AssessmentQuestion[];
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  status: "draft",
  isActive: true,
  scope: "org",
  orgId: null,
  groupId: null,
  group: "",
  groupOrder: null,
  openAt: null,
  closeAt: null,
  timeLimitSeconds: null,
  maxAttempts: 1,
  questions: [],
};

export default function SA_Assessments() {
  const qc = useQueryClient();
  const { user, status: authStatus } = useAuth();
  const isReady = authStatus === "ready" && !!user && user.role === "superadmin";
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string | "global" | "">("");

  const orgQuery = useQuery({
    queryKey: ["sa-orgs"],
    queryFn: () => listOrganizations({ q: "" }),
    enabled: isReady,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const orgs = Array.isArray(orgQuery.data) ? orgQuery.data : orgQuery.data?.items ?? [];

  const listQ = useQuery<Assessment[]>({
    queryKey: [
      "assessments",
      { q, status: statusFilter, orgId: orgFilter || undefined },
    ],
    queryFn: () => listAssessments({ q, status: statusFilter, orgId: orgFilter || undefined }),
    enabled: isReady,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const rows = listQ.data ?? [];

  const [agroups, setAgroups] = useState<Array<{ _id: string; name: string; scope: "global" | "org"; orgId?: string | null }>>([]);
  const [groupMode, setGroupMode] = useState<"existing" | "new">("existing");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupPreview, setGroupPreview] = useState<Array<{ _id: string; title: string; groupOrder?: number | null; createdAt: string }>>([]);
  const [groupPreviewLoading, setGroupPreviewLoading] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editId, setEditId] = useState<string | null>(null);
  const isLoading = listQ.isLoading;

  const mCreate = useMutation({
    mutationFn: (payload: any) => createAssessment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
  const mUpdate = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: any }) => updateAssessment(id, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => deleteAssessment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
  const mStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "draft" | "published" | "archived" }) =>
      setAssessmentStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });

  useEffect(() => {
    setDraft((d) => ({
      ...d,
      scope: orgFilter === "global" ? "global" : "org",
      orgId: orgFilter && orgFilter !== "global" ? (orgFilter as string) : null,
    }));
  }, [orgFilter]);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      const list: any[] = [];
      const globals = await listAssessmentGroups({ scope: "global", includeInactive: true });
      list.push(...globals);
      if (draft.scope === "org") {
        const oid = draft.orgId || undefined;
        if (oid) {
          const orgGroups = await listAssessmentGroups({ scope: "org", orgId: oid, includeInactive: true });
          list.push(...orgGroups);
        }
      }
      const seen = new Set<string>();
      setAgroups(list.filter((g) => g && !seen.has(g._id) && seen.add(g._id)));
    })();
  }, [isReady, draft.scope, draft.orgId]);

  useEffect(() => {
    (async () => {
      setGroupPreview([]);
      if (!draft.groupId) return;
      setGroupPreviewLoading(true);
      try {
        const resp = await fetch(`/api/assessments/by-group/${draft.groupId}`, {
          credentials: "include",
        });
        const data = await resp.json();
        setGroupPreview(data?.items || []);
      } finally {
        setGroupPreviewLoading(false);
      }
    })();
  }, [draft.groupId]);

  function findExistingGroupByName(name: string, scope: "global" | "org", orgId?: string | null) {
    const n = name.trim().toLowerCase();
    return (
      agroups.find(
        (g) => g.name?.trim().toLowerCase() === n && g.scope === scope && (scope === "global" || String(g.orgId || "") === String(orgId || ""))
      ) || null
    );
  }

  function addQuestion(type: QuestionType) {
    setDraft((d) => {
      if ((d.questions?.length || 0) >= 20) return d;
      const q: AssessmentQuestion = {
        type,
        text: "",
        options: [],
        answer: type === "truefalse" ? false : type === "mcq" ? 0 : "",
        points: 1,
        explanation: "",
      };
      return { ...d, questions: [...(d.questions || []), q] };
    });
  }
  function removeQuestion(idx: number) {
    setDraft((d) => ({ ...d, questions: (d.questions || []).filter((_, i) => i !== idx) }));
  }

  const groupedList = useMemo(() => {
    // Helper: best label for a row’s group (prefer loaded group meta if available)
    const labelFor = (a: any) => {
      const gid = a.groupId ? String(a.groupId) : "";
      const fallback = (a.group || "Ungrouped").trim() || "Ungrouped";
      if (gid) {
        const meta = agroups.find((g) => String(g._id) === gid);
        if (meta) return `${meta.name}${meta.scope === "global" ? " (Global)" : ""}`;
      }
      return fallback;
    };

    // Bucket by groupId when possible (so same-named groups don’t collide); else by label
    const map = new Map<string, { label: string; items: Assessment[] }>();
    for (const a of rows) {
      const gid = (a as any).groupId ? String((a as any).groupId) : "";
      const label = labelFor(a);
      const key = gid || `__ungrouped__:${label.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(a);
    }

    const buckets = Array.from(map.entries()).map(([key, v]) => {
      // Sort inside a bucket: groupOrder ASC (nulls last), then createdAt ASC
      v.items.sort((a: any, b: any) => {
        const ao = a.groupOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.groupOrder ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ac - bc;
      });
      return { key, label: v.label, items: v.items };
    });

    // Sort buckets by label; put "Ungrouped" last
    buckets.sort((a, b) => {
      const au = a.label.toLowerCase() === "ungrouped";
      const bu = b.label.toLowerCase() === "ungrouped";
      if (au && !bu) return 1;
      if (!au && bu) return -1;
      return a.label.localeCompare(b.label);
    });

    return buckets;
  }, [rows, agroups]);

  async function handleDelete(id: string) {
    if (!confirm("Delete assessment?")) return;
    mDelete.mutate(id);
  }

  async function handleSave() {
    const payload: any = {
      title: draft.title,
      description: draft.description || "",
      status: draft.status,
      isActive: draft.isActive,
      orgId: draft.scope === "org" ? draft.orgId : null,
      groupId: draft.groupId || null,
      group: draft.group || undefined,
      groupOrder: draft.groupOrder ?? undefined,
      openAt: draft.openAt || null,
      closeAt: draft.closeAt || null,
      timeLimitSeconds: draft.timeLimitSeconds || null,
      maxAttempts: draft.maxAttempts || 1,
      questions: draft.questions || [],
      totalQuestions: (draft.questions || []).length,
    };

    if (groupMode === "new" && !payload.groupId) {
      const typed = (newGroupName || draft.group || "").trim();
      if (typed) {
        const scope = draft.scope;
        const effOrgId = scope === "org" ? payload.orgId : null;

        // 🔒 guard: backend requires orgId for org-scoped groups
        if (scope === "org" && !effOrgId) {
          alert("Select an Organization before creating an org-scoped group.");
          return;
        }

        let chosen = findExistingGroupByName(typed, scope, effOrgId);
        if (!chosen) {
          try {
            const gp: any = { name: typed, scope };
            if (scope === "org") gp.orgId = effOrgId;
            const g = await createAssessmentGroup(gp);
            setAgroups((prev) => [g, ...prev]);
            chosen = g;
          } catch (e) {
            const existing = findExistingGroupByName(typed, scope, effOrgId);
            if (existing) chosen = existing;
          }
        }
        if (chosen) {
          payload.groupId = chosen._id;
          payload.group = chosen.name;
        }
      }
    }

    if (editId) {
      mUpdate.mutate({ id: editId, changes: payload });
    } else {
      mCreate.mutate(payload);
    }

    setDraft(EMPTY_DRAFT);
    setEditId(null);
    setGroupMode("existing");
    setNewGroupName("");
  }

  function startEdit(a: any) {
    setEditId(a.id || a._id);
    setDraft({
      title: a.title,
      description: a.description || "",
      status: (a.status as any) || "draft",
      isActive: (a as any).isActive ?? true,
      scope: (a as any).orgId ? "org" : "global",
      orgId: (a as any).orgId || null,
      groupId: (a as any).groupId?._id || (a as any).groupId || null,
      group: (a as any).groupName || (a as any).group || "",
      groupOrder: (a as any).groupOrder ?? null,
      openAt: (a as any).openAt || null,
      closeAt: (a as any).closeAt || null,
      timeLimitSeconds: (a as any).timeLimitSeconds || null,
      maxAttempts: (a as any).maxAttempts || 1,
      questions: (a as any).questions || [],
    });
  }

  if (authStatus !== "ready") {
    return <div className="p-6 text-sm text-slate-500">Checking permissions…</div>;
  }
  if (user?.role !== "superadmin") {
    return <div className="p-6 text-sm text-red-600">Forbidden: superadmin only.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search assessments…"
          className="px-3 py-2 border rounded-md w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">All orgs + Global</option>
          <option value="global">Global</option>
          {orgs.map((o: any) => (
            <option key={o.id || o._id} value={o.id || o._id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            className={`px-3 py-2 border rounded-md text-sm ${viewMode === "grouped" ? "bg-slate-900 text-white" : "bg-white"}`}
            onClick={() => setViewMode("grouped")}
            type="button"
            title="Show assessments grouped by Assessment Group"
          >
            Grouped
          </button>
          <button
            className={`px-3 py-2 border rounded-md text-sm ${viewMode === "flat" ? "bg-slate-900 text-white" : "bg-white"}`}
            onClick={() => setViewMode("flat")}
            type="button"
            title="Show a simple flat list"
          >
            Flat
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Title</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">Assessment Group</label>
            <div className="flex gap-4 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="radio" name="groupMode" checked={groupMode === "existing"} onChange={() => setGroupMode("existing")} />
                Use existing
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="groupMode" checked={groupMode === "new"} onChange={() => setGroupMode("new")} />
                Create new
              </label>
            </div>

            {groupMode === "existing" && (
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={draft.groupId || ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  const g = agroups.find((x) => x._id === v);
                  setDraft((d) => ({ ...d, groupId: v, group: g?.name || d.group, groupOrder: null }));
                }}
              >
                <option value="">(none)</option>
                {agroups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name} {g.scope === "global" ? "(Global)" : ""}
                  </option>
                ))}
              </select>
            )}

            {groupMode === "new" && (
              <>
                <input
                  className="mt-2 w-full border rounded-lg px-3 py-2"
                  placeholder="Legacy group text (optional)"
                  value={draft.group || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, group: e.target.value }))}
                />
                <div className="flex gap-2 mt-2">
                  <input
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="New assessment group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                  <button
                    className="px-3 py-2 rounded-lg border"
                    onClick={async () => {
                      const typed = (newGroupName || "").trim();
                      if (!typed) return;
                      const scope = draft.scope;
                      const effOrgId = scope === "org" ? draft.orgId : null;

                      // 🔒 guard: org groups require orgId
                      if (scope === "org" && !effOrgId) {
                        alert("Select an Organization before creating an org-scoped group.");
                        return;
                      }

                      let chosen = findExistingGroupByName(typed, scope, effOrgId);
                      if (!chosen) {
                        const gp: any = { name: typed, scope };
                        if (scope === "org") gp.orgId = effOrgId;
                        const g = await createAssessmentGroup(gp);
                        setAgroups((prev) => [g, ...prev]);
                        chosen = g;
                      }
                      setDraft((d) => ({ ...d, groupId: chosen!._id, group: chosen!.name, groupOrder: null }));
                      setNewGroupName("");
                    }}
                  >
                    Create
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <label className="text-sm text-gray-600">Position in group (optional)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Leave empty to append"
                    value={draft.groupOrder ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, groupOrder: e.target.value ? Number(e.target.value) : null }))}
                    disabled={!draft.groupId}
                  />
                </div>
              </>
            )}

            {!!draft.groupId && (
              <div className="mt-3 border rounded-lg p-2">
                <div className="text-sm font-medium mb-1">Current sequence</div>
                {groupPreviewLoading ? (
                  <div className="text-xs text-gray-500 p-2">Loading…</div>
                ) : groupPreview.length === 0 ? (
                  <div className="text-xs text-gray-500 p-2">No assessments in this group yet.</div>
                ) : (
                  <ol className="list-decimal ml-5 text-sm space-y-1">
                    {groupPreview.map((it, idx) => (
                      <li key={it._id}>
                        {it.title} <span className="text-xs text-gray-400">({(it.groupOrder ?? idx + 1)})</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="text-[11px] text-gray-400 mt-1">
                  Order uses <code>groupOrder</code> first, then creation time.
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">Status</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as "draft" | "published" }))}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">Scope</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={draft.scope}
 onChange={(e) => {
   const scope = e.target.value as "global" | "org";
   setDraft((d) => ({
     ...d,
     scope,
     orgId: scope === "global" ? null : d.orgId,
     // avoid keeping an org-scoped group on a global assessment (and vice versa)
     groupId: null,
     groupOrder: null,
   }));
 }}
            >
              <option value="global">Global (all orgs)</option>
              <option value="org">Specific Org</option>
            </select>
          </div>
          {draft.scope === "org" && (
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Organization</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={draft.orgId || ""}
                onChange={(e) => setDraft((d) => ({ ...d, orgId: e.target.value || null }))}
              >
                <option value="">Select organization…</option>
                {orgs.map((o: any) => (
                  <option key={o.id || o._id} value={o.id || o._id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-gray-600">Opens At</label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={draft.openAt ? draft.openAt.slice(0, 16) : ""}
              onChange={(e) => setDraft((d) => ({ ...d, openAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Closes At</label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={draft.closeAt ? draft.closeAt.slice(0, 16) : ""}
              onChange={(e) => setDraft((d) => ({ ...d, closeAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Time Limit (seconds)</label>
            <input
              type="number"
              min={30}
              className="w-full border rounded-lg px-3 py-2"
              value={draft.timeLimitSeconds || ""}
              onChange={(e) => setDraft((d) => ({ ...d, timeLimitSeconds: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Max Attempts</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-lg px-3 py-2"
              value={draft.maxAttempts || 1}
              onChange={(e) => setDraft((d) => ({ ...d, maxAttempts: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <label className="text-sm text-gray-600">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={() => addQuestion("mcq")}>
            + MCQ
          </button>
          <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={() => addQuestion("truefalse")}>
            + True/False
          </button>
          <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={() => addQuestion("puzzle")}>
            + Puzzle
          </button>
          <span className="text-sm text-gray-500 ml-2">Max 20 questions</span>
        </div>

        <div className="space-y-4">
          {draft.questions.map((q, idx) => (
            <QuestionRow
              key={idx}
              q={q}
              index={idx}
              onChange={(qq: any) =>
                setDraft((d) => {
                  const arr = [...(d.questions || [])];
                  arr[idx] = qq;
                  return { ...d, questions: arr };
                })
              }
              onRemove={() => removeQuestion(idx)}
            />
          ))}
          {draft.questions.length === 0 && (
            <div className="text-sm text-gray-500">No questions added yet.</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={!draft.title || (draft.scope === "org" && !draft.orgId)}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
          >
            {editId ? "Update" : "Create"} Assessment
          </button>
          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setDraft(EMPTY_DRAFT);
              }}
              className="px-3 py-2 rounded-lg border"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Org</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Questions</th>
              <th className="px-4 py-2 text-left">Updated</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-4" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4" colSpan={6}>
                  No assessments
                </td>
              </tr>
            ) : viewMode === "flat" ? (
              rows.map((a: any) => (
                <tr key={a.id || a._id}>
                  <td className="px-4 py-2">{a.title}</td>
                  <td className="px-4 py-2">{a.orgName || (a.orgId ? a.orgId : "Global")}</td>
                  <td className="px-4 py-2 capitalize">{a.status}</td>
                  <td className="px-4 py-2">{(a.questions?.length ?? a.totalQuestions ?? 0) as number}</td>
                  <td className="px-4 py-2">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => startEdit(a)}>Edit</button>
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => {
                        const next = a.status === "draft" ? "published" : "draft";
                        mStatus.mutate({ id: a.id || a._id, status: next });
                      }}
                    >
                      {a.status === "draft" ? "Publish" : "Unpublish"}
                    </button>
                    <button className="px-2 py-1 border rounded text-rose-600" onClick={() => handleDelete(a.id || a._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              groupedList.map((bucket) => (
                <Fragment key={bucket.key}>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 font-medium" colSpan={6}>
                      <div className="flex items-center justify-between">
                        <span>{bucket.label}</span>
                        <span className="text-xs text-slate-500">
                          {bucket.items.length} {bucket.items.length === 1 ? "assessment" : "assessments"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {bucket.items.map((a: any) => (
                    <tr key={a.id || a._id}>
                      <td className="px-4 py-2">{a.title}</td>
                      <td className="px-4 py-2">{a.orgName || (a.orgId ? a.orgId : "Global")}</td>
                      <td className="px-4 py-2 capitalize">{a.status}</td>
                      <td className="px-4 py-2">{(a.questions?.length ?? a.totalQuestions ?? 0) as number}</td>
                      <td className="px-4 py-2">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button className="px-2 py-1 border rounded" onClick={() => startEdit(a)}>Edit</button>
                        <button
                          className="px-2 py-1 border rounded"
                          onClick={() => {
                            const next = a.status === "draft" ? "published" : "draft";
                            mStatus.mutate({ id: a.id || a._id, status: next });
                          }}
                        >
                          {a.status === "draft" ? "Publish" : "Unpublish"}
                        </button>
                        <button className="px-2 py-1 border rounded text-rose-600" onClick={() => handleDelete(a.id || a._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  index,
  onChange,
  onRemove,
}: {
  q: AssessmentQuestion;
  index: number;
  onChange: (q: AssessmentQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Q{index + 1} · {String(q.type || "").toUpperCase()}</div>
        <button onClick={onRemove} className="text-red-600 text-sm">
          Remove
        </button>
      </div>

      <div className="mt-2 space-y-2">
        <input
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Question text"
        />

        {q.type === "mcq" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Options</div>
              <button
                className="text-sm"
                onClick={() => onChange({ ...q, options: [...(q.options || []), "Option"] })}
              >
                + Add Option
              </button>
            </div>
            {(q.options || []).map((opt: string, i: number) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => {
                    const arr = [...(q.options || [])];
                    arr[i] = e.target.value;
                    onChange({ ...q, options: arr });
                  }}
                  className="flex-1 border rounded-lg px-3 py-2"
                />
                <label className="flex items-center gap-2 text-sm px-2">
                  <input
                    type="radio"
                    name={`ans-${index}`}
                    checked={q.answer === i}
                    onChange={() => onChange({ ...q, answer: i })}
                  />
                  Correct
                </label>
                <button
                  className="px-2 text-red-600"
                  onClick={() => {
                    const arr = [...(q.options || [])];
                    arr.splice(i, 1);
                    let ans: any = q.answer;
                    if (typeof ans === "number") {
                      if (i === ans) ans = 0;
                      else if (i < ans) ans = ans - 1;
                    }
                    onChange({ ...q, options: arr, answer: ans });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {q.type === "truefalse" && (
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={q.answer === true}
                onChange={() => onChange({ ...q, answer: true })}
              />
              True
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={q.answer === false}
                onChange={() => onChange({ ...q, answer: false })}
              />
              False
            </label>
          </div>
        )}

        {q.type === "puzzle" && (
          <input
            value={(q.answer as string) || ""}
            onChange={(e) => onChange({ ...q, answer: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Expected answer (string)"
          />
        )}

        <div className="grid sm:grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={q.points || 1}
            onChange={(e) => onChange({ ...q, points: Number(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Points"
          />
          <input
            value={q.explanation || ""}
            onChange={(e) => onChange({ ...q, explanation: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Explanation (optional)"
          />
        </div>
      </div>
    </div>
  );
}
