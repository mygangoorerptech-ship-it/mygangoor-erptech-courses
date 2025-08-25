// mygf/src/components/join/steps/SuccessStep.tsx
import React from "react";
import { CheckCircle2, Download, Share2 } from "lucide-react";
import type { PayMethod } from "../types";

export default function SuccessStep({
  name, course, method, onDownload, onShare
}: {
  name: string;
  course: string;
  method: PayMethod;
  onDownload: () => void;
  onShare: () => void;
}) {
  return (
    <div className="text-center space-y-4 py-8">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 grid place-content-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>
      <h4 className="text-xl font-semibold">Payment complete</h4>
      <p className="text-slate-700">
        Welcome, <span className="font-medium">{name || "Student"}</span>! You’re enrolled in <span className="font-medium">{course}</span>.
      </p>
      <p className="text-sm text-slate-600">
        Method: {method === "online" ? "Online (demo)" : "Cash (pending admin confirmation)"}.
      </p>
      <div className="text-xs text-slate-500">
        A confirmation email would be sent here in production.
      </div>
            {/* new: actions */}
      <div className="pt-2 flex items-center justify-center gap-3">
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-white"
        >
          <Download className="w-4 h-4" />
          Download receipt
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
