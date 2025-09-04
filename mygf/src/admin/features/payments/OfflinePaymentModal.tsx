// mygf/src/admin/features/payments/OfflinePaymentModal.tsx
import React from "react";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import { Label, Input, Select } from "../../components/Input";
import { IndianRupee, FileText, BadgeCheck, User, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listStudents } from "../../../api/students";
import { listCourses as listOrgCourses } from "../../api/courses";
import type { Course } from "../../types/course";

export default function OfflinePaymentModal({
  open, onClose, defaultCourseId, defaultStudentId, onSubmit
}: {
  open: boolean;
  onClose: () => void;
  defaultCourseId?: string;
  defaultStudentId?: string;
  onSubmit: (p: {
    studentId: string;
    courseId: string;
    amount: number;
    receiptNo?: string;
    referenceId?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [studentId, setStudentId] = React.useState(defaultStudentId || "");
  const [courseId, setCourseId]   = React.useState(defaultCourseId || "");
  const [amount, setAmount]       = React.useState("0.00");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [referenceId, setReferenceId] = React.useState("");
  const [notes, setNotes]         = React.useState("");
  const [saving, setSaving]       = React.useState(false);

  React.useEffect(() => {
    setStudentId(defaultStudentId || "");
    setCourseId(defaultCourseId || "");
  }, [defaultStudentId, defaultCourseId]);

  const studentsQ = useQuery({
    queryKey: ["students:lite", { limit: 200 }],
    queryFn: () => listStudents({ limit: 200, lite: 1 }),
  });

  const coursesQ = useQuery<Course[]>({
    queryKey: ["courses:org-lite"],
    queryFn: () => listOrgCourses({ status: "all" }),
  });

  const students = Array.isArray(studentsQ.data) ? studentsQ.data : [];
  const courses  = Array.isArray(coursesQ.data) ? coursesQ.data : [];

  const canSave = studentId && courseId && Number(amount) > 0;

  return (
    <Modal open={open} title="Record Offline Payment" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label>
            <span className="inline-flex items-center gap-2">
              <User size={14}/> Student (email)
            </span>
          </Label>
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email}{s.name ? ` — ${s.name}` : ""}
              </option>
            ))}
          </Select>
          {studentsQ.isLoading && <div className="text-xs text-slate-500 mt-1">Loading students…</div>}
        </div>

        <div className="sm:col-span-1">
          <Label>
            <span className="inline-flex items-center gap-2">
              <BookOpen size={14}/> Course
            </span>
          </Label>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.category ? ` — ${c.category}` : ""}
              </option>
            ))}
          </Select>
          {coursesQ.isLoading && <div className="text-xs text-slate-500 mt-1">Loading courses…</div>}
        </div>

        <div>
          <Label>
            <span className="inline-flex items-center gap-2">
              <IndianRupee size={14}/> Amount (₹)
            </span>
          </Label>
          <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        <div>
          <Label>
            <span className="inline-flex items-center gap-2">
              <FileText size={14}/> Receipt No (optional)
            </span>
          </Label>
          <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="UPI receipt #" />
        </div>

        <div className="sm:col-span-2">
          <Label>Reference / UTR (optional)</Label>
          <Input value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder="UPI transaction id / UTR" />
        </div>

        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="memo" />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  studentId,
                  courseId,
                  amount: Math.round(Number(amount) * 100),
                  receiptNo: receiptNo || undefined,
                  referenceId: referenceId || undefined,
                  notes: notes || undefined
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            disabled={!canSave || saving}
          >
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={16}/>{saving ? "Saving…" : "Save"}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
