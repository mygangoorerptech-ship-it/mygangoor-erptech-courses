// mygf/src/admin/features/courses/ui.tsx
import React from "react";
import { Label } from "../../components/Input";

export type LabelCompatProps = React.PropsWithChildren<
  React.LabelHTMLAttributes<HTMLLabelElement>
>;
export const LabelCompat = Label as unknown as React.FC<LabelCompatProps>;

export const SectionCard: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, right, className = "", children }) => (
  <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>
    {(title || right || subtitle) && (
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3 rounded-t-2xl bg-slate-50/60">
        <div>
          {title ? <div className="text-sm font-semibold">{title}</div> : null}
          {subtitle ? (
            <div className="text-xs text-slate-600">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

export const Field: React.FC<{
  label: React.ReactNode;
  help?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Visual indicator only; does not enforce native validation */
  required?: boolean;
}> = ({ label, help, className = "", children, required }) => (
  <div className={className}>
    <div className="text-xs font-medium text-slate-700 mb-1">
      <span className="align-middle">{label}</span>
      {required ? (
        <span className="ml-1 text-rose-600" aria-hidden="true">
          *
        </span>
      ) : null}
    </div>
    {children}
    {help ? (
      <div className="text-[11px] text-slate-500 mt-1">{help}</div>
    ) : null}
  </div>
);
