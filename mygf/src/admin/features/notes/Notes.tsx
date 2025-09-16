// src/admin/features/notes/Notes.tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCourses } from "../../api/courses";
import type { Course } from "../../types/course";
import {
  createNote,
  listNotes,
  setNoteStatus,
  deleteNote,
  uploadPdf,
  updateNote,
  type Note,
} from "../../api/notes";
import Button from "../../components/Button";
import { Input, Label, Select } from "../../components/Input";
import { toast } from "react-hot-toast";
import {
  Send,
  Trash2,
  Check,
  Pencil,
  FileText,
  File,
  BadgeCheck,
  Clock,
  X,
  Loader2,
} from "lucide-react";

// --- helpers ---
function dedupeByTitle(items: Course[]) {
  const m = new Map<string, Course>();
  for (const c of items) {
    const key = (c.title || "").trim().toLowerCase();
    if (!m.has(key)) m.set(key, c);
  }
  return Array.from(m.values());
}

// prefer id, else slug, else exact title (backend supports any)
function courseIdForServer(c?: Course | null) {
  if (!c) return "";
  return (c as any).id ?? (c as any)._id ?? (c as any).slug ?? c!.title ?? "";
}

type Tab = "rich" | "pdf";

export default function NotesFeature() {
  const qc = useQueryClient();

  // UI state
  const [q, setQ] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const [activeTab, setActiveTab] = useState<Tab>("rich");

  // Rich text note form
  const [rtTitle, setRtTitle] = useState("");
  const [rtHtml, setRtHtml] = useState("");

  // PDF note form
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfMeta, setPdfMeta] = useState<{ url: string; publicId: string } | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<Note | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eHtml, setEHtml] = useState(""); // only for rich notes

  // --- data ---
  const { data: coursesResp } = useQuery({
    queryKey: ["courses:list", q],
    queryFn: () => listCourses({ q, status: "published", limit: 200 }),
  });

  const courses: Course[] = useMemo(
    () => dedupeByTitle(coursesResp?.items || []),
    [coursesResp]
  );

  const { data: notes = [], isFetching: notesLoading } = useQuery({
    enabled: !!selectedCourseId,
    queryKey: ["notes:list", selectedCourseId],
    queryFn: () => listNotes({ courseId: selectedCourseId, status: "all" }),
  });

  // --- mutations ---
  const mCreate = useMutation({
    mutationFn: (payload: Parameters<typeof createNote>[0]) => createNote(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes:list", selectedCourseId] });
    },
  });

  const mSetStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Note["status"] }) =>
      setNoteStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes:list", selectedCourseId] });
    },
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["notes:list", selectedCourseId] });
    },
  });

  const mUpdateRt = useMutation({
    mutationFn: ({ id, title, html }: { id: string; title?: string; html?: string }) =>
      updateNote(id, { title, html }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["notes:list", selectedCourseId] });
    },
  });

  // --- handlers ---
  const onPickCourse = (val: string) => {
    setSelectedCourseId(val);
    // reset forms when course changes
    setRtTitle("");
    setRtHtml("");
    setPdfTitle("");
    setPdfFile(null);
    setPdfMeta(null);
  };

  const ensurePdfUploaded = async () => {
    if (!pdfFile) return null;
    if (pdfMeta?.url) return pdfMeta; // already uploaded
    try {
      setPdfUploading(true);
      const res = await uploadPdf(pdfFile);
      if (!res?.ok || !res.url) throw new Error("Upload failed");
      const meta = { url: res.url, publicId: res.publicId };
      setPdfMeta(meta);
      return meta;
    } finally {
      setPdfUploading(false);
    }
  };

  const addRichNote = async () => {
    const cid = selectedCourseId;
    if (!cid) return toast.error("Pick a course first.");
    if (!rtTitle.trim()) return toast.error("Title is required.");
    if (!rtHtml.trim()) return toast.error("Please add some content.");

    await mCreate.mutateAsync({
      courseId: cid,
      title: rtTitle.trim(),
      kind: "rich",
      html: rtHtml,
      status: "published",
    });
    toast.success("Note added");
    setRtTitle("");
    setRtHtml("");
  };

  const addPdfNote = async () => {
    const cid = selectedCourseId;
    if (!cid) return toast.error("Pick a course first.");
    if (!pdfTitle.trim()) return toast.error("Title is required.");
    if (!pdfFile) return toast.error("Choose a PDF file.");

    // 1) upload PDF (if not yet)
    const meta = await ensurePdfUploaded();
    if (!meta?.url) return; // ensurePdfUploaded handles toasts

    // 2) create note
    await mCreate.mutateAsync({
      courseId: cid,
      title: pdfTitle.trim(),
      kind: "pdf",
      pdfUrl: meta.url,
      pdfPublicId: meta.publicId,
      status: "published",
    });
    toast.success("PDF note added");

    // reset only the PDF form
    setPdfTitle("");
    setPdfFile(null);
    setPdfMeta(null);
  };

  const onPdfFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setPdfFile(null);
      setPdfMeta(null);
      return;
    }
    if (!/pdf$/i.test(f.type)) {
      toast.error("Only PDF files are allowed.");
      e.currentTarget.value = "";
      return;
    }
    setPdfFile(f);
    setPdfMeta(null); // force re-upload on next add
  };

  // --- edit flow ---
  const openEdit = (n: Note) => {
    setEditing(n);
    setETitle(n.title);
    setEHtml(n.html || "");
  };
  const closeEdit = () => setEditing(null);
  const saveEdit = async () => {
    if (!editing) return;
    const id = editing.id;
    const title = eTitle.trim();
    if (!title) return toast.error("Title is required.");

    // For rich notes we can update html; for pdf we only update title
    const payload =
      editing.kind === "rich"
        ? { id, title, html: eHtml }
        : { id, title };

    await mUpdateRt.mutateAsync(payload as any);
    setEditing(null);
  };

  // --- render ---
  return (
    <div className="space-y-8">
      {/* Course picker + search */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <Label>Search courses</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type course name…" />
          </div>
          <div className="flex-1">
            <Label>Pick course</Label>
            <Select
              value={selectedCourseId}
              onChange={(e) => onPickCourse(e.target.value)}
            >
              <option value="">— Select —</option>
              {courses.map((c) => {
                const cid = courseIdForServer(c);
                return (
                  <option key={cid} value={cid}>
                    {c.title}
                  </option>
                );
              })}
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow">
        <div className="border-b flex">
          <button
            type="button"
            onClick={() => setActiveTab("rich")}
            className={`px-4 py-2 text-sm ${
              activeTab === "rich" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-600"
            }`}
          >
            Rich Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            className={`px-4 py-2 text-sm ${
              activeTab === "pdf" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-600"
            }`}
          >
            PDF
          </button>
        </div>

        {/* Rich Text form */}
        {activeTab === "rich" && (
          <div className="p-4 md:p-6 space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={rtTitle} onChange={(e) => setRtTitle(e.target.value)} placeholder="Enter note title" />
            </div>
            <div>
              <Label>Content (HTML)</Label>
              <textarea
                value={rtHtml}
                onChange={(e) => setRtHtml(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm min-h-[160px]"
                placeholder="Paste or write HTML (sanitized on save)"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={addRichNote}
                disabled={!selectedCourseId || !rtTitle.trim() || !rtHtml.trim() || mCreate.isPending}
              >
                {mCreate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {mCreate.isPending ? "Adding…" : "Add Note"}
              </Button>
            </div>
          </div>
        )}

        {/* PDF form */}
        {activeTab === "pdf" && (
          <div className="p-4 md:p-6 space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="Enter note title"
              />
            </div>
            <div>
              <Label>PDF file</Label>
              <input
                type="file"
                accept="application/pdf"
                onChange={onPdfFileChange}
                className="block w-full text-sm"
              />
              {pdfFile && (
                <div className="text-xs text-slate-600 mt-1">
                  Selected: <b>{pdfFile.name}</b> {Math.round(pdfFile.size / 1024)} KB
                </div>
              )}
              {pdfUploading && <div className="text-xs text-indigo-600 mt-1">Uploading…</div>}
              {pdfMeta?.url && (
                <div className="text-xs text-green-700 mt-1">Uploaded ✓</div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!pdfFile) return toast.error("Choose a PDF file first.");
                  await ensurePdfUploaded();
                  if (pdfMeta?.url) toast.success("PDF uploaded");
                }}
                disabled={!pdfFile || pdfUploading}
              >
                {pdfUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <File className="w-4 h-4" />}
                {pdfUploading ? "Uploading…" : "Upload PDF"}
              </Button>

              <Button
                onClick={addPdfNote}
                disabled={
                  !selectedCourseId ||
                  !pdfTitle.trim() ||
                  !pdfFile ||
                  pdfUploading ||
                  mCreate.isPending
                }
              >
                {mCreate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {mCreate.isPending ? "Adding…" : "Add Note"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Notes list */}
      {selectedCourseId && (
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded-lg">
              <thead>
                <tr className="text-left text-slate-700 bg-slate-50">
                  <th className="py-2 px-3 font-medium">Title</th>
                  <th className="py-2 px-3 font-medium">Kind</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notesLoading && (
                  <tr>
                    <td className="py-4 px-3 text-slate-500" colSpan={4}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!notesLoading &&
                  notes.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{n.title}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1">
                          {n.kind === "rich" ? (
                            <FileText className="w-4 h-4 text-slate-600" />
                          ) : (
                            <File className="w-4 h-4 text-slate-600" />
                          )}
                          <span className="uppercase text-slate-700">{n.kind}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {n.status === "published" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-2 py-0.5">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            Published
                          </span>
                        ) : n.status === "draft" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                            {n.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => openEdit(n)}
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </Button>

                          {n.status !== "published" && (
                            <Button
                              variant="secondary"
                              onClick={() => mSetStatus.mutate({ id: n.id, status: "published" })}
                            >
                              <Check className="w-4 h-4" /> Publish
                            </Button>
                          )}
                          {n.status === "published" && (
                            <Button
                              variant="secondary"
                              onClick={() => mSetStatus.mutate({ id: n.id, status: "draft" })}
                            >
                              <Clock className="w-4 h-4" /> Draft
                            </Button>
                          )}
                          <Button variant="danger" onClick={() => mDelete.mutate(n.id)}>
                            <Trash2 className="w-4 h-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!notesLoading && notes.length === 0 && (
                  <tr>
                    <td className="py-4 px-3 text-gray-500" colSpan={4}>
                      No notes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal (simple Tailwind modal; no logic change to APIs) */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeEdit} />
          <div className="relative z-50 w-full max-w-xl bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Edit {editing.kind === "pdf" ? "PDF Note (title only)" : "Rich Note"}
              </h3>
              <button onClick={closeEdit} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              </div>

              {editing.kind === "rich" && (
                <div>
                  <Label>Content (HTML)</Label>
                  <textarea
                    value={eHtml}
                    onChange={(e) => setEHtml(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-[160px]"
                    placeholder="HTML"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={closeEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={mUpdateRt.isPending || !eTitle.trim()}>
                {mUpdateRt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
