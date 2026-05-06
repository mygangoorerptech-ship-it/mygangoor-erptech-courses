// src/components/enrolled/EnrolledToolbar.tsx

import { Grid2X2, List, Search } from "lucide-react";

export default function EnrolledToolbar() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search for courses..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div className="flex items-center gap-3">
        <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none">
          <option>Recently Accessed</option>
          <option>Latest</option>
          <option>Completed</option>
        </select>

        <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600">
          <Grid2X2 className="h-5 w-5" />
        </button>

        <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
          <List className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}