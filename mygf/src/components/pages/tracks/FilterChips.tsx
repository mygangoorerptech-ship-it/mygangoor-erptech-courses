// mygf/src/components/pages/tracks/FilterChips.tsx
import React from "react";
import { CHIP_OPTIONS, type Chip } from "./types";

export default function FilterChips({
  activeChip,
  setActiveChip,
  over12h,
  toggleOver12h,
}: {
  activeChip: Chip;
  setActiveChip: (c: Chip) => void;
  over12h: boolean;
  toggleOver12h: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {CHIP_OPTIONS.map((chip) => (
        <button
          key={chip}
          onClick={() => setActiveChip(chip)}
          className={[
            "rounded-full px-4 py-2 text-sm font-medium transition",
            activeChip === chip
              ? "bg-slate-900 text-white shadow"
              : "bg-white/80 text-slate-700 hover:bg-white",
          ].join(" ")}
        >
          {chip}
        </button>
      ))}

      <button
        onClick={toggleOver12h}
        aria-pressed={over12h}
        className={[
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
          over12h
            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
            : "bg-white/80 text-slate-700 hover:bg-white",
        ].join(" ")}
      >
        <span
          className={[
            "grid h-5 w-5 place-content-center rounded-full border",
            over12h ? "border-emerald-600 bg-emerald-500 text-white" : "border-slate-300 text-transparent",
          ].join(" ")}
        >
          ✓
        </span>
        <span>More than 12h</span>
      </button>
    </div>
  );
}
