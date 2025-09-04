// mygf/src/components/screens/ReceiptClaim.tsx
import React from "react";
import Button from "../../admin/components/Button";
import { Input, Label } from "../../admin/components/Input";
import { claimReceipt } from "../../api/payments";
import { useAuth } from "../../auth/store";

export default function ReceiptClaim() {
  const { user } = useAuth();
  const [orgId, setOrgId] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [amount, setAmount] = React.useState("0.00");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [referenceId, setReferenceId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [ok, setOk] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const canSubmit = orgId && courseId && Number(amount) > 0 && (receiptNo || referenceId);

  if (!user) {
    return <div className="max-w-xl mx-auto p-6">Please sign in to claim a payment receipt.</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Claim Offline Payment</h1>
      <p className="text-sm text-slate-600">If you paid at the office via UPI/GPay, submit your receipt/UTR here. Your organization will verify it and unlock your course.</p>

      <div className="grid gap-3">
        <div>
          <Label>Organization ID</Label>
          <Input value={orgId} onChange={e => setOrgId(e.target.value)} placeholder="org _id" />
        </div>
        <div>
          <Label>Course ID</Label>
          <Input value={courseId} onChange={e => setCourseId(e.target.value)} placeholder="course _id" />
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Receipt No (optional)</Label>
          <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
        </div>
        <div>
          <Label>Reference / UTR (optional)</Label>
          <Input value={referenceId} onChange={e => setReferenceId(e.target.value)} />
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="any extra info" />
        </div>

        {err && <div className="text-rose-600 text-sm">{err}</div>}
        {ok && <div className="text-emerald-700 text-sm">{ok}</div>}

        <div className="flex justify-end">
          <Button
            disabled={!canSubmit}
            onClick={async () => {
              setErr(null); setOk(null);
              try {
                await claimReceipt({
                  orgId,
                  courseId,
                  amount: Math.round(Number(amount) * 100),
                  receiptNo: receiptNo || undefined,
                  referenceId: referenceId || undefined,
                  notes: notes || undefined
                });
                setOk("Submitted. Please wait for verification.");
              } catch (e: any) {
                setErr(e?.message || "Failed to submit.");
              }
            }}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
