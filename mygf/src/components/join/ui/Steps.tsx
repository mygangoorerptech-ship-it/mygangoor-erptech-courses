// mygf/src/components/join/ui/Steps.tsx
import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { Step } from "../types";
import { classNames } from "../utils";

export default function Steps({ step }: { step: Step }) {
  const items = ["Course", "Details", "Payment", "Done"];
  return (
    <div className="px-5 py-3 bg-slate-50 border-b">
      <ol className="flex items-center gap-3 text-sm">
        {items.map((label, i) => {
          const idx = (i + 1) as Step;
          const active = step === idx;
          const done = step > idx;
          return (
            <li key={label} className="flex items-center gap-2">
              <div
                className={classNames(
                  "w-7 h-7 rounded-full grid place-content-center text-xs font-semibold",
                  done ? "bg-emerald-600 text-white" :
                  active ? "bg-indigo-600 text-white" :
                  "bg-white border"
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={classNames(
                  "hidden sm:block",
                  active ? "text-indigo-700 font-medium" : "text-slate-600"
                )}
              >
                {label}
              </span>
              {i < items.length - 1 && <div className="w-8 h-px bg-slate-200 mx-1" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
