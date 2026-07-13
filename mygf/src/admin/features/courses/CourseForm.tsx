// mygf/src/admin/features/courses/CourseForm.tsx
import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import { Input, Select } from "../../components/Input";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";
import type {
  Course,
  CourseStatus,
  CourseVisibility,
  Chapter,
  CourseLevel,
  CourseType,
  CenterTeacherAssignment,
} from "../../types/course";
import { SectionCard, Field } from "./ui";
import { ensureCsrfToken, getCsrfToken } from "../../../config/csrf";
import { API_ROOT } from "../../../config/env";
import { listAdUsers } from "../../api/adUsers";
import { listSaUsers } from "../../api/saUsers";
import { listOrganizations } from "../../api/organizations";
import { useAuth } from "../../auth/store";

// ★ small helpers
const asStr = (v: any, fallback = "") => (v == null ? fallback : String(v));
const dedupeByValue = (arr: Array<{ value: string; label: string }>) => {
  const m = new Map<string, { value: string; label: string }>();
  for (const o of arr) m.set(String(o.value), o);
  return Array.from(m.values());
};

function parseTags(input: string): string[] {
  const parts = String(input || "")
    .split(/[|,;]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      out.push(t);
      seen.add(key);
    }
    if (out.length >= 5) break;
  }
  return out;
}

export default function CourseFormModal({
  open,
  mode,
  initial,
  orgs,
  admins,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: Course;
  role: string;
  orgs: Array<{ label: string; value: string }>;
  admins: Array<{ label: string; value: string }>;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<any>;
}) {
  const { user } = useAuth();
  const role = user?.role || "student";
  const isSA = role === "superadmin";
  const isTeacher = role === "teacher";

  const [courseType, setCourseType] = useState<CourseType>((initial?.courseType as CourseType) || "paid");
  const [durationText, setDurationText] = useState<string>(initial?.durationText || "");

  const [teachersByCenter, setTeachersByCenter] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});
  const [centerTeacherAssignments, setCenterTeacherAssignments] = useState<CenterTeacherAssignment[]>(
    initial?.centerTeacherAssignments || []
  );

  // NEW: dynamic owners list (for SA) with fallback to provided admins
  const [ownerOptions, setOwnerOptions] = useState<Array<{ value: string; label: string }>>(admins || []);

  // ── core fields ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [programType, setProgramType] = useState(initial?.programType || "");

  const [description, setDescription] = useState<string>(initial?.description || "");
  const [tagsInput, setTagsInput] = useState<string>((initial?.tags || []).join(", "));

  // keep rupees in UI; convert to paise on submit
  const [priceRs, setPriceRs] = useState<number>(initial ? (initial.price ?? 0) / 100 : 0);

  const [visibility, setVisibility] = useState<CourseVisibility>(initial?.visibility || "unlisted");
  const [status, setStatus] = useState<CourseStatus>(initial?.status || "draft");

  // ★ normalize orgId upfront to a plain string ("global" when null/empty)
  const [orgId, setOrgId] = useState<string>(initial?.orgId ? asStr(initial.orgId) : "global"); // ★
  const [ownerEmail, setOwnerEmail] = useState<string>(initial?.ownerEmail || "");

  const [isBundled, setIsBundled] = useState<boolean>(!!initial?.isBundled || (initial?.chapters?.length ?? 0) > 0);
  const [chapters, setChapters] = useState<Chapter[]>(initial?.chapters?.length ? initial.chapters : []);

  const [demoVideoUrl, setDemoVideoUrl] = useState<string>(initial?.demoVideoUrl || "");

  // progress UI
  const [demoUploading, setDemoUploading] = useState(false);
  const [bundleUploading, setBundleUploading] = useState(false);

  // ★ NEW: per-chapter cover image uploading tracker (avoid duplicate clicks)
  const [coverUploading, setCoverUploading] = useState<Set<number>>(new Set());
  const markCoverUploading = (idx: number, on: boolean) =>
    setCoverUploading((prev) => {
      const n = new Set(prev);
      if (on) n.add(idx);
      else n.delete(idx);
      return n;
    });

  const [isSaving, setIsSaving] = useState(false);

  // ── centers ──────────────────────────────────────────────────────────────────
  const [centers, setCenters] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>(initial?.centerIds || []);

  // ── new bundle-level fields ───────────────────────────────────────────────────
  const [discountPercent, setDiscountPercent] = useState<number>(
    Number.isFinite(initial?.discountPercent) ? (initial!.discountPercent as number) : 0
  );
  const [level, setLevel] = useState<CourseLevel>(initial?.level || "all");
  const [bundleCoverUrl, setBundleCoverUrl] = useState<string>(initial?.bundleCoverUrl || "");

  // platform fee in ₹ (UI); convert to paise on submit
  const [platformFeeRs, setPlatformFeeRs] = useState<number>(
    initial?.platformFee ? (initial!.platformFee as number) / 100 : 49
  );

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-teacher-dropdown]")) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openDropdown]);

  function getTeachersForCenter(centerId: string): string[] {
    const a = centerTeacherAssignments.find((x) => x.centerId === centerId);
    if (a?.teacherIds?.length) return a.teacherIds;
    if (a?.teacherId) return [a.teacherId]; // backward compat
    return [];
  }

  function updateCenterTeachers(centerId: string, teacherIds: string[]) {
    setCenterTeacherAssignments((prev) => {
      const existing = prev.find((x) => x.centerId === centerId);
      if (existing) {
        return prev.map((x) =>
          x.centerId === centerId ? { ...x, teacherIds, teacherId: teacherIds[0] ?? "" } : x
        );
      }
      return [...prev, { centerId, teacherIds, teacherId: teacherIds[0] ?? "" }];
    });
  }

  const ownCenterIdSet = useMemo(
    () => new Set(centers.map((c) => c.value)),
    [centers]
  );

  const centerLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    centers.forEach((c) => { map[c.value] = c.label; });
    if (!isSA && initial?.centerIds) {
      initial.centerIds.forEach((id, i) => {
        if (!map[id]) map[id] = initial.centerNames?.[i] || id;
      });
    }
    return map;
  }, [centers, isSA, initial?.centerIds, initial?.centerNames]);

  // ── Fetch owners (admins) for SA, filtered by org ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isSA) return;
      try {
        const all = await listSaUsers({
          role: "admin",
          status: "all",
        } as any);
        let opts = (all || []).map((u: any) => ({
          value: u.email, // ownerEmail is email-based
          label: u.name || u.email,
        }));

        // Seed currently selected owner (from initial) if it isn't in options yet
        const addCurrent = !!initial?.ownerEmail && !opts.some((o) => o.value === initial!.ownerEmail);
        if (addCurrent) {
          opts.unshift({
            value: initial!.ownerEmail!,
            label: (initial as any)?.ownerName || initial!.ownerEmail!,
          });
        }

        // ★ de-dupe by value (prevents duplicates during slow refetches)
        opts = dedupeByValue(opts); // ★

        if (!cancelled) setOwnerOptions(opts);
      } catch {
        if (!cancelled) setOwnerOptions(dedupeByValue(admins || [])); // ★
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // ★ keep deps minimal & stable; avoid re-running due to label changes
  }, [isSA, initial?.ownerEmail]); // ★

  // ── Fetch teachers per center ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (selectedCenterIds.length === 0) {
          if (!cancelled) {
            setTeachersByCenter({});
          }
          return;
        }



        const results = await Promise.all(
          selectedCenterIds.map(async (centerId) => {
            let users: any[] = [];

            if (isSA) {
              users = await listSaUsers({
                role: "teacher",
                status: "all",
                orgId: centerId,
              } as any);
            } else {
              users = await listAdUsers({
                role: "teacher",
                status: "all",
                orgId: centerId,
              } as any);
            }

            let opts = (users || []).map((u: any) => ({
              value: String(u.id || u._id),
              label: `${u.name || u.email} (${u.email})`,
            }));

            opts = dedupeByValue(opts);

            return [centerId, opts];
          })
        );

        const nextMap = Object.fromEntries(results);

        if (!cancelled) {
          setTeachersByCenter(nextMap);
        }
      } catch (err) {
        console.error("[teachersByCenter fetch error]", err);

        if (!cancelled) {
          setTeachersByCenter({});
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [isSA, selectedCenterIds]);

  useEffect(() => {
    setCenterTeacherAssignments((prev) =>
      prev.filter((x) => selectedCenterIds.includes(x.centerId))
    );
  }, [selectedCenterIds]);

  // fetch platform default only if not present on the course
  useEffect(() => {
    const controller = new AbortController();
    if (!initial?.platformFee) {
      fetch("/api/config/platform", {
        credentials: "include",
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
        .then((d) => {
          if (typeof d?.platformFee === "number") setPlatformFeeRs(d.platformFee / 100);
        })
        .catch(() => { });
    }
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // recompute if editing switches the course (do NOT override user changes otherwise)
  useEffect(() => {
    setTitle(initial?.title || "");
    setSlug(initial?.slug || "");
    setCategory(initial?.category || "");
    setProgramType(initial?.programType || "");
    setDescription(initial?.description || "");
    setTagsInput((initial?.tags || []).join(", "));
    setPriceRs(initial ? (initial.price ?? 0) / 100 : 0);
    setVisibility(initial?.visibility || "unlisted");
    setStatus(initial?.status || "draft");
    setOrgId(initial?.orgId ? asStr(initial.orgId) : "global"); // ★ normalize
    setOwnerEmail(initial?.ownerEmail || "");
    setCourseType((initial?.courseType as CourseType) || "paid");
    setDurationText(initial?.durationText || "");
    setCenterTeacherAssignments(
      (Array.isArray(initial?.centerTeacherAssignments)
        ? initial.centerTeacherAssignments
        : []
      ).map((a) => ({
        ...a,
        teacherIds: a.teacherIds?.length
          ? a.teacherIds.map(String)
          : (a.teacherId ? [String(a.teacherId)] : []),
      }))
    );
    setIsBundled(!!initial?.isBundled || (initial?.chapters?.length ?? 0) > 0);
    setChapters(initial?.chapters?.length ? initial.chapters : []);
    setDemoVideoUrl(initial?.demoVideoUrl || "");
    setDiscountPercent(Number.isFinite(initial?.discountPercent) ? (initial!.discountPercent as number) : 0);
    setLevel(initial?.level || "all");
    setBundleCoverUrl(initial?.bundleCoverUrl || "");
    setPlatformFeeRs(initial?.platformFee ? (initial!.platformFee as number) / 100 : platformFeeRs);
    // Sync center selections when switching between courses in edit mode
    setSelectedCenterIds(initial?.centerIds || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Fetch centers for the selected org (admin/teacher always use their own org)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setCenters([]);

        // SUPERADMIN → all centers
        if (isSA) {
          const all = await listOrganizations({
            status: "active",
          });

          const opts = (all.items || []).map((o) => ({
            value: String(o._id),
            label: o.name,
          }));

          if (!cancelled) {
            setCenters(opts);
          }

          return;
        }

        // ADMIN / TEACHER → only own org
        if (user?.orgId) {
          const ownOrg = orgs.find(
            (o) => String(o.value) === String(user.orgId)
          );

          if (!cancelled) {
            setCenters(
              ownOrg
                ? [{
                  value: String(ownOrg.value),
                  label: ownOrg.label,
                }]
                : []
            );
          }
        }
      } catch {
        if (!cancelled) {
          setCenters([]);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [isSA, user?.orgId, orgs]);

  // derived UI math (₹)
  const priceAfterDiscountRs = Math.max(
    0,
    (Number.isFinite(priceRs) ? priceRs : 0) * (1 - ((Number.isFinite(discountPercent) ? discountPercent : 0) / 100))
  );
  const totalWithFeesRs = priceAfterDiscountRs + (Number.isFinite(platformFeeRs) ? platformFeeRs : 0);

  // ── helpers (uploads/chapters) — unchanged ────────────────────────────────────
  const openPicker = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.click();
  };

  async function uploadTo(
    path: "/api/uploads/image" | "/api/uploads/video" | "/api/uploads/demo-video",
    file: File
  ) {
    const fd = new FormData();
    fd.append("file", file);
    await ensureCsrfToken();
    const tok = getCsrfToken();
    const url = API_ROOT ? `${API_ROOT}${path}` : path;
    const r = await fetch(url, {
      method: "POST",
      body: fd,
      credentials: "include",
      headers: tok ? { "X-CSRF-Token": tok } : undefined,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("[upload error]", r.status, txt);
      throw new Error("Upload failed");
    }
    return (await r.json()) as { ok: boolean; url: string };
  }

  async function pickLocalAndSet(file: File, kind: "image" | "video", idx: number) {
    if (kind === "image") {
      // ★ Avoid duplicate clicks for this chapter’s cover button
      if (coverUploading.has(idx)) return;
      markCoverUploading(idx, true);
      try {
        const { url } = await uploadTo("/api/uploads/image", file);
        updateChapter(idx, "coverUrl", url as any);
      } finally {
        markCoverUploading(idx, false);
      }
    } else {
      const { url } = await uploadTo("/api/uploads/video", file);
      updateChapter(idx, "videoUrl", url as any);
    }
  }

  async function uploadBundleCover(file: File) {
    if (bundleUploading) return; // ★ guard
    setBundleUploading(true);
    try {
      const { url } = await uploadTo("/api/uploads/image", file);
      setBundleCoverUrl(url);
    } finally {
      setBundleUploading(false);
    }
  }
  function addChapter() {
    setChapters((arr) => [
      ...arr,
      { title: "", subtitle: "", description: "", youtubeUrl: "", videoUrl: "", coverUrl: "", avgRating: 0, reviewsCount: 0, assignments: [] },
    ]);
  }
  function removeChapter(idx: number) { setChapters((arr) => arr.filter((_, i) => i !== idx)); }
  function moveChapter(idx: number, dir: -1 | 1) {
    setChapters((arr) => {
      const n = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return n;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  }
  function updateChapter<K extends keyof Chapter>(idx: number, key: K, value: Chapter[K]) {
    setChapters((arr) => {
      const n = [...arr];
      const ch = { ...n[idx] };
      if (key === "youtubeUrl" && value) {
        ch.youtubeUrl = String(value);
        ch.videoUrl = "";
      } else if (key === "videoUrl" && value) {
        ch.videoUrl = String(value);
        ch.youtubeUrl = "";
      } else {
        (ch as any)[key] = value;
      }
      n[idx] = ch;
      return n;
    });
  }

  const hasTeacherAssignments =
    selectedCenterIds.length === 0
      ? true
      : selectedCenterIds.every((centerId) => {
        const assignment = centerTeacherAssignments.find(
          (x) => x.centerId === centerId
        );

        return (assignment?.teacherIds?.length ?? 0) > 0 || !!assignment?.teacherId;
      });

  const canSubmit =
    title.trim().length > 0 &&
    programType.trim().length > 0 &&
    hasTeacherAssignments &&
    (!isBundled || chapters.every((ch) => (ch.title || "").trim().length > 0));

  const tagChips = useMemo(() => {
    const arr = parseTags(tagsInput);
    return arr;
  }, [tagsInput]);

  return (
    <Modal
      open={open}
      title={mode === "create" ? "Add Course" : "Edit Course"}
      onClose={onClose}
      size="xl"
      dialogClassName="w-[95vw] max-w-6xl"
      bodyClassName="p-0 overflow-x-hidden"
    >
      <div className="w-full max-w-6xl mx-auto">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            try {
              await onSubmit({
                title,
                slug,
                category,
                programType,
                price: Math.round((Number.isFinite(priceRs) ? priceRs : 0) * 100), // paise
                visibility,
                status,
                isBundled,
                discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
                level,
                bundleCoverUrl: bundleCoverUrl || null,
                platformFee: Math.round((Number.isFinite(platformFeeRs) ? platformFeeRs : 0) * 100), // paise
                chapters: isBundled ? chapters : [],
                demoVideoUrl,
                courseType,
                durationText,
                teacherId:
                  centerTeacherAssignments[0]?.teacherIds?.[0]
                  ?? centerTeacherAssignments[0]?.teacherId
                  ?? undefined,

                centerTeacherAssignments: centerTeacherAssignments.map((a) => ({
                  centerId: a.centerId,
                  teacherIds: a.teacherIds ?? (a.teacherId ? [a.teacherId] : []),
                })),
                tags: tagChips,
                centerIds: selectedCenterIds,
                ...(isSA
                  ? {
                    orgId: orgId === "global" ? null : asStr(orgId), // ★ ensure string/null
                    ownerEmail: ownerEmail || undefined,
                  }
                  : {}),
              });
              onClose();
            } catch (err) {
              console.error("[course save error]", err);
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {/* scroll container */}
          <div
            className="max-h-[70vh] overflow-y-auto px-4 pt-4 pb-2 space-y-4 scroll-smooth overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {/* Top split */}
            <div className="grid gap-4 lg:grid-cols-12">
              <SectionCard className="lg:col-span-9" title="Course Details">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                  <Field label="Slug">
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="optional-url-slug" />
                  </Field>
                  <Field label="Category">
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Frontend" />
                  </Field>

                  {/* NEW: Description (max 250) */}
                  <div className="md:col-span-3">
                    <Field label="Description" help="Max 250 characters">
                      <Input
                        value={description}
                        maxLength={250}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short summary shown in listings"
                      />
                    </Field>
                  </div>

                  {/* NEW: Tags (max 5) */}
                  <div className="md:col-span-3">
                    <Field
                      label="Tags"
                      help="Separate with comma, | or ;  •  Max 5 tags"
                    >
                      <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="react, frontend, hooks"
                      />
                      {/* tiny inline preview */}
                      {tagChips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                          {tagChips.map((t) => (
                            <span key={t} className="rounded px-1.5 py-0.5 bg-slate-100 text-slate-700">{t}</span>
                          ))}
                          <span className="text-slate-500 ml-1">{tagChips.length}/5</span>
                        </div>
                      )}
                    </Field>
                  </div>

                  {/* NEW: Course type (required) */}
                  <Field label="Course type" required>
                    <Select value={courseType} onChange={(e) => setCourseType(e.target.value as CourseType)}>
                      <option value="paid">Paid</option>
                      <option value="free">Free</option>
                    </Select>
                  </Field>

                  {/* NEW: Duration */}
                  <Field label="Duration" help="e.g., 6hr 30min">
                    <Input
                      value={durationText}
                      onChange={(e) => setDurationText(e.target.value)}
                      placeholder="6hr 30min"
                    />
                  </Field>

                  <Field label="Price (₹) — per course bundle">
                    <Input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(priceRs) ? priceRs : 0}
                      readOnly={courseType === "free"}
                      disabled={courseType === "free"}
                      onChange={(e) => {
                        if (courseType === "free") return;
                        const n = (e.target as HTMLInputElement).valueAsNumber;
                        setPriceRs(Number.isFinite(n) ? n : 0);
                      }}
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Visibility">
                    <Select value={visibility} onChange={(e) => setVisibility(e.target.value as CourseVisibility)}>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </Select>
                  </Field>

                  <Field label="Status">
                    <Select value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </Select>
                  </Field>

                  {/* NEW: Program Type (required) */}
                  <Field label="Program Type" required>
                    <Input
                      value={programType}
                      onChange={(e) => setProgramType(e.target.value)}
                      placeholder="e.g., Reiki, Dowsing, Yoga, Meditation, etc."
                    />
                  </Field>

                  {/* Demo video (10s) */}
                  <div className="md:col-span-3">
                    <Field label="Demo video (10s)" help="Upload any video; only the first 10 seconds will be delivered.">
                      <div className="flex items-center gap-2">
                        <input
                          id="demo-file"
                          type="file"
                          accept="video/*"
                          className="sr-only"
                          onChange={async (e) => {
                            const inputEl = e.currentTarget as HTMLInputElement;
                            const f = inputEl.files?.[0];
                            if (!f) return;
                            setDemoUploading(true);
                            try {
                              const { url } = await uploadTo("/api/uploads/demo-video", f);
                              setDemoVideoUrl(url);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setDemoUploading(false);
                              if (inputEl) inputEl.value = "";
                            }
                          }}
                        />
                        <Button type="button" variant="secondary" onClick={() => openPicker("demo-file")} disabled={demoUploading} aria-busy={demoUploading}>
                          {demoUploading ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
                          ) : ("Upload demo")}
                        </Button>

                        {demoVideoUrl ? (
                          <>
                            <video
                              src={demoVideoUrl}
                              className="h-16 w-28 rounded border object-cover"
                              controls muted playsInline preload="metadata" title="Demo preview"
                            />
                            <a href={demoVideoUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline" title="Open demo video">Open</a>
                          </>
                        ) : null}
                      </div>
                    </Field>
                  </div>
                </div>

                {role === "superadmin" && (
                  <div className="grid gap-3 md:grid-cols-2 mt-3">
                    <Field label="Owner (Admin)">
                      <Select
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                      >
                        <option value="">None</option>
                        {/* show current owner if not in fetched list yet */}
                        {!!ownerEmail && !ownerOptions.some((o) => o.value === ownerEmail) && (
                          <option value={ownerEmail}>
                            {(initial as any)?.ownerName || ownerEmail} (current)
                          </option>
                        )}
                        {ownerOptions.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}



                {/* NEW: Centers Selection */}
                {(centers.length > 0 || (!isSA && selectedCenterIds.some((id) => !ownCenterIdSet.has(id)))) && (
                  <div className="mt-3">
                    <Field
                      label="Assign to Centers"
                      help="If none selected, this course will be available globally"
                    >
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border rounded p-2">
                        {centers.map((c) => {
                          const isChecked = selectedCenterIds.includes(c.value);
                          const isLocked = !isSA && isChecked;
                          return (
                            <label
                              key={c.value}
                              className={`flex items-center gap-2 text-sm ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isLocked}
                                onChange={(e) => {
                                  if (isLocked) return;
                                  const checked = e.target.checked;
                                  setSelectedCenterIds((prev) => {
                                    if (checked) return prev.includes(c.value) ? prev : [...prev, c.value];
                                    setCenterTeacherAssignments((a) => a.filter((x) => x.centerId !== c.value));
                                    return prev.filter((id) => id !== c.value);
                                  });
                                }}
                              />
                              {c.label}
                            </label>
                          );
                        })}
                        {!isSA && selectedCenterIds
                          .filter((id) => !ownCenterIdSet.has(id))
                          .map((id) => (
                            <label key={id} className="flex items-center gap-2 text-sm text-slate-400 cursor-not-allowed">
                              <input type="checkbox" checked disabled readOnly />
                              {centerLabelMap[id] || id}
                              <span className="text-xs ml-1">(assigned externally)</span>
                            </label>
                          ))}
                      </div>
                      {selectedCenterIds.length === 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          This course will be GLOBAL (available to all centers)
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                {selectedCenterIds.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <Field
                      label="Assign Teachers Per Center"
                      help="Select one or more teachers for each center"
                    >
                      <div className="space-y-3">
                        {selectedCenterIds.map((centerId) => {
                          const isExternal = !isSA && !ownCenterIdSet.has(centerId);
                          const label = centerLabelMap[centerId] || "Center";
                          const selected = getTeachersForCenter(centerId);
                          const options = teachersByCenter[centerId] || [];
                          const isOpen = openDropdown === centerId;

                          return (
                            <div
                              key={centerId}
                              className={`grid md:grid-cols-2 gap-3 border rounded-lg p-3${isExternal ? " opacity-60 bg-slate-50" : ""}`}
                            >
                              <div className="flex items-center">
                                <div className="text-sm font-medium text-slate-700">
                                  {label}
                                  {isExternal && (
                                    <span className="ml-2 text-xs font-normal text-slate-400">(read-only)</span>
                                  )}
                                </div>
                              </div>

                              <div className="relative" data-teacher-dropdown>
                                <button
                                  type="button"
                                  disabled={isExternal}
                                  onClick={() => setOpenDropdown(isOpen ? null : centerId)}
                                  className="w-full text-left border rounded px-3 py-2 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  {selected.length === 0
                                    ? <span className="text-slate-400">Select Teachers…</span>
                                    : <span>{selected.length} teacher{selected.length > 1 ? "s" : ""} selected</span>
                                  }
                                </button>
                                {isOpen && !isExternal && (
                                  <div className="absolute z-20 mt-1 w-full border rounded bg-white shadow-lg max-h-48 overflow-y-auto">
                                    {options.length === 0 ? (
                                      <div className="px-3 py-2 text-sm text-slate-400">No teachers available</div>
                                    ) : (
                                      options.map((t) => (
                                        <label
                                          key={t.value}
                                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={selected.includes(t.value)}
                                            onChange={(e) => {
                                              const next = e.target.checked
                                                ? [...selected, t.value]
                                                : selected.filter((id) => id !== t.value);
                                              updateCenterTeachers(centerId, next);
                                            }}
                                          />
                                          {t.label}
                                        </label>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Field>
                  </div>
                )}
              </SectionCard>

              {/* Bundle card */}
              <SectionCard
                className="lg:col-span-3 lg:max-w-[340px] justify-self-end"
                title="Bundle with Chapters"
                subtitle="Enable to add multiple chapters under one course. Price applies to the whole course."
              >
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    When enabled, the course becomes a bundle with an ordered list of chapters.
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={isBundled}
                      onChange={(e) => setIsBundled(e.target.checked)}
                    />
                    Enable
                  </label>
                </div>

                {/* NEW bundle fields */}
                <div className="space-y-3 mt-3">
                  <Field label="Bundle Cover">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="bundle-cover-input"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadBundleCover(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          document
                            .getElementById("bundle-cover-input")
                            ?.click()
                        }
                      >
                        {bundleUploading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                          </span>
                        ) : (
                          "Pick Image"
                        )}
                      </Button>
                      {bundleCoverUrl ? (
                        <img
                          src={bundleCoverUrl}
                          alt="Bundle cover"
                          className="h-12 w-12 rounded object-cover border"
                        />
                      ) : null}
                    </div>
                  </Field>

                  <Field label="Level">
                    <Select
                      value={level}
                      onChange={(e) => setLevel(e.target.value as CourseLevel)}
                    >
                      <option value="all">All levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </Select>
                  </Field>

                  <Field label="Discount (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={Number.isFinite(discountPercent) ? discountPercent : 0}
                      onChange={(e) => {
                        const n = (e.target as HTMLInputElement).valueAsNumber;
                        setDiscountPercent(
                          Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0
                        );
                      }}
                    />
                  </Field>

                  <Field label="Platform Fee (₹)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={platformFeeRs}
                      onChange={(e) => {
                        const n = (e.target as HTMLInputElement).valueAsNumber;
                        setPlatformFeeRs(Number.isFinite(n) ? Math.max(0, n) : 0);
                      }}
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      This fee is added to the course total. Default comes from SuperAdmin settings.
                    </div>
                  </Field>

                  <div className="rounded-md border bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Base price</span>
                      <span>₹{(Number.isFinite(priceRs) ? priceRs : 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>{(Number.isFinite(discountPercent) ? discountPercent : 0).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>After discount</span>
                      <span>₹{priceAfterDiscountRs.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform fee</span>
                      <span>₹{(Number.isFinite(platformFeeRs) ? platformFeeRs : 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total payable</span>
                      <span>₹{totalWithFeesRs.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Chapters */}
            {isBundled && (
              <SectionCard
                title={
                  <div className="flex items-center gap-2">
                    Chapters <span className="text-slate-500">({chapters.length})</span>
                  </div>
                }
                right={
                  <Button onClick={addChapter}>
                    <Plus size={16} /> Add Chapter
                  </Button>
                }
              >
                {chapters.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-slate-800 bg-slate-50">
                    No chapters yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chapters.map((ch, idx) => {
                      const coverInputId = `cover-file-${idx}`;
                      const videoInputId = `video-file-${idx}`;
                      return (
                        <div key={idx} className="rounded-lg border">
                          <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
                            <div className="text-sm font-medium">Chapter {idx + 1}</div>
                            <div className="flex gap-1">
                              <Button
                                variant="secondary"
                                className="h-8"
                                onClick={() => moveChapter(idx, -1)}
                                disabled={idx === 0}
                                title="Move left"
                              >
                                <ChevronLeft size={14} />
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8"
                                onClick={() => moveChapter(idx, +1)}
                                disabled={idx === chapters.length - 1}
                                title="Move right"
                              >
                                <ChevronRight size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8"
                                onClick={() => removeChapter(idx)}
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>

                          <div className="p-3">
                            <div className="grid gap-3 md:grid-cols-12">
                              <div className="md:col-span-12">
                                <Field label="Title">
                                  <Input
                                    value={ch.title || ""}
                                    onChange={(e) =>
                                      updateChapter(idx, "title", e.target.value)
                                    }
                                  />
                                </Field>
                              </div>

                              <div className="md:col-span-6">
                                <Field label="Subtitle">
                                  <Input
                                    value={ch.subtitle || ""}
                                    onChange={(e) =>
                                      updateChapter(idx, "subtitle", e.target.value)
                                    }
                                  />
                                </Field>
                              </div>

                              <div className="md:col-span-6">
                                <Field label="Cover Photo (6:19)">
                                  <div className="flex gap-2">
                                    <Input
                                      className="flex-1"
                                      placeholder="https://..."
                                      value={ch.coverUrl || ""}
                                      onChange={(e) =>
                                        updateChapter(idx, "coverUrl", e.target.value)
                                      }
                                    />
                                    <input
                                      id={coverInputId}
                                      type="file"
                                      accept="image/*"
                                      className="sr-only"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) pickLocalAndSet(f, "image", idx);
                                        e.currentTarget.value = "";
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="shrink-0"
                                      onClick={() => openPicker(coverInputId)}
                                    >
                                      Pick Image
                                    </Button>
                                  </div>
                                  {ch.coverUrl ? (
                                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                                      {ch.coverUrl}
                                    </div>
                                  ) : null}
                                </Field>
                              </div>

                              <div className="md:col-span-12">
                                <Field label="Description">
                                  <Input
                                    value={ch.description || ""}
                                    onChange={(e) =>
                                      updateChapter(idx, "description", e.target.value)
                                    }
                                  />
                                </Field>
                              </div>

                              <div className="md:col-span-6">
                                <Field
                                  label="Youtube URL (if any)"
                                  help="If you fill this, uploaded video URL will be cleared."
                                >
                                  <Input
                                    placeholder="https://youtu.be/..."
                                    value={ch.youtubeUrl || ""}
                                    onChange={(e) =>
                                      updateChapter(idx, "youtubeUrl", e.target.value)
                                    }
                                  />
                                </Field>
                              </div>

                              <div className="md:col-span-6">
                                <Field
                                  label="Uploaded Video (if any)"
                                  help="If you choose a file or fill this, YouTube URL will be cleared."
                                >
                                  <div className="flex gap-2">
                                    <Input
                                      className="flex-1"
                                      placeholder="https://cdn.example.com/video.mp4"
                                      value={ch.videoUrl || ""}
                                      onChange={(e) =>
                                        updateChapter(idx, "videoUrl", e.target.value)
                                      }
                                    />
                                    <input
                                      id={videoInputId}
                                      type="file"
                                      accept="video/*"
                                      className="sr-only"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) pickLocalAndSet(f, "video", idx);
                                        e.currentTarget.value = "";
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="shrink-0"
                                      onClick={() => openPicker(videoInputId)}
                                    >
                                      Pick Video
                                    </Button>
                                  </div>
                                  {ch.videoUrl ? (
                                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                                      {ch.videoUrl}
                                    </div>
                                  ) : null}
                                </Field>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}
          </div>

          {/* sticky actions */}
          <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur px-4 py-3 flex justify-end gap-2 shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <Button type="submit" disabled={!canSubmit || isSaving} aria-busy={isSaving}>
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "create" ? "Creating…" : "Saving…"}
                </span>
              ) : mode === "create" ? (
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
