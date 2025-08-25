// mygf/src/components/pages/tracks/SearchBar.tsx
import React from "react";

export default function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="group relative">
      <label className="sr-only" htmlFor="search">Live search</label>
      <input
        id="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Live search..."
        className="w-full rounded-full border border-white/70 bg-white/80 backdrop-blur px-5 py-4 pl-14 text-slate-800 shadow-sm outline-none transition focus:bg-white focus:shadow-lg"
      />
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
    </div>
  );
}
