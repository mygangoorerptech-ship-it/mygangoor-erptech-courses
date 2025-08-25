// mygf/src/components/pages/tracks/CourseCardSkeleton.tsx
import React from "react";

export default function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-sm backdrop-blur">
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-300" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-5 w-3/4 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-8 w-20 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-4 w-10 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
