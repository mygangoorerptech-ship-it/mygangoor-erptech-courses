// mygf/src/admin/components/Modal.tsx
import React from "react";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const sizeMap: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  full: "max-w-[95vw]",
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  size = "md",
  dialogClassName = "",
  bodyClassName = "",
}: {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** width of the dialog */
  size?: Size;
  /** extra classes on dialog wrapper (where max-width lives) */
  dialogClassName?: string;
  /** extra classes on body (where the scroll lives) */
  bodyClassName?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* scroll container; keeps dialog fully visible and allows vertical scroll */}
      <div className="relative h-full overflow-y-auto">
        {/* keep your same vertical spacing via padding instead of margins */}
        <div className={`mx-auto w-full ${sizeMap[size]} py-8 ${dialogClassName}`}>
          {/* cap dialog height; body will scroll */}
          <div className="rounded-xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h2 className="text-base font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* BODY (scroll area) */}
            <div className={`p-4 overflow-y-auto flex-1 min-h-0 ${bodyClassName}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
