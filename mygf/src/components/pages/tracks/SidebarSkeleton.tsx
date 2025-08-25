// mygf/src/components/pages/tracks/SidebarSkeleton.tsx
import React from "react";

export default function SidebarSkeleton() {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur">
      <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
      <div className="mt-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
      <hr className="my-5 border-slate-200" />
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
        <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-40 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
