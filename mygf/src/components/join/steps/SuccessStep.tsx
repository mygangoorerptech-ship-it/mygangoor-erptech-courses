// mygf/src/components/join/steps/SuccessStep.tsx
import React from "react";
import { CheckCircle2, Download, Share2, BadgeCheck, Clock } from "lucide-react";

type Receipt = {
  orderId: string;
  paymentId: string | null;
  status: string;              // "captured", "pending", ...
  verified: boolean;
  method: string;              // upi/card/paylater etc
  currency: string;
  amount: number;              // paise
  dateISO: string;
  student?: { name?: string };
  course?: { title?: string };
  enrollment?: { present: boolean; status: string | null };
};

export default function SuccessStep({
  receipt,
  onDownload,
  onShare,
  innerRef,
}: {
  receipt: Receipt | null;
  onDownload: (fmt?: "pdf" | "png") => void;
  onShare: () => void;
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const enrolled = !!receipt?.enrollment?.present;
  const title = enrolled ? "Payment complete" : "Payment received";
  const subtitle = enrolled
    ? `You’re enrolled in ${receipt?.course?.title || "the course"}.`
    : `Enrollment pending admin/provider confirmation for ${receipt?.course?.title || "the course"}.`;

  const amount = receipt ? (receipt.amount / 100).toLocaleString("en-IN", { style: "currency", currency: receipt.currency || "INR" }) : "-";
  const dt = receipt?.dateISO ? new Date(receipt.dateISO).toLocaleString() : "-";

  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 grid place-content-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h4 className="text-xl font-semibold">{title}</h4>
        <p className="text-slate-700">
          Hello <span className="font-medium">{receipt?.student?.name || "Student"}</span>. {subtitle}
        </p>
        <div className="text-xs text-slate-500">
          {receipt?.verified ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <BadgeCheck className="w-4 h-4" /> Verified by payment provider
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Clock className="w-4 h-4" /> Awaiting provider/webhook verification
            </span>
          )}
        </div>
      </div>

      {/* Receipt card — this is what we rasterize for PDF/PNG */}
       <div 
   ref={innerRef} 
   data-receipt-root 
   className="mx-auto max-w-xl rounded-2xl border bg-white shadow-sm p-5 print:p-0" 
 >
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <div>
            <div className="text-xs text-slate-500">Payment Receipt</div>
            <div className="text-base font-semibold">MYGF</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Date</div>
            <div className="text-sm font-medium">{dt}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Student</div>
            <div className="font-medium">{receipt?.student?.name || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Course</div>
            <div className="font-medium">{receipt?.course?.title || "-"}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Order ID</div>
            <div className="font-mono text-[13px]">{receipt?.orderId || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Payment ID</div>
            <div className="font-mono text-[13px]">{receipt?.paymentId || "-"}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Method</div>
            <div className="font-medium capitalize">{receipt?.method || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-medium">{receipt?.status || "-"}</div>
          </div>

          <div className="col-span-2 mt-1 rounded-lg bg-slate-50 border px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">Amount paid</span>
            <span className="text-lg font-semibold">{amount}</span>
          </div>

          <div className="col-span-2 text-xs text-slate-500 mt-1">
            {enrolled ? "Enrollment: active" : `Enrollment: ${receipt?.enrollment?.status || "pending"}`}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="pt-2 flex items-center justify-center gap-3">
        <button
          onClick={() => onDownload("pdf")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-white"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
        <button
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}
