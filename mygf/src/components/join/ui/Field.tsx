// mygf/src/components/join/ui/Field.tsx
import React from "react";
import InlineError from "./InlineError";
import { classNames } from "../utils";

export default function Field({
  label, icon, children, error
}: { label: string; icon?: React.ReactNode; children: React.ReactNode; error?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div
        className={classNames(
          "flex items-center gap-2 rounded-lg border bg-white px-3",
          error ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300 focus-within:ring-2 focus-within:ring-indigo-200"
        )}
      >
        {icon && <span className="text-slate-500">{icon}</span>}
        {children}
      </div>
      {error && <InlineError msg={error} />}
    </label>
  );
}
