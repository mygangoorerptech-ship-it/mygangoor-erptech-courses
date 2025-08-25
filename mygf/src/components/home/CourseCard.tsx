// mygf/src/components/home/CourseCard.tsx
import React from "react";

type Props = { id: number; title: string; level: string; cover: string };

export default function CourseCard({ title, level, cover }: Props) {
  return (
    <article className="group rounded-xl overflow-hidden bg-slate-900 text-white shadow-md shadow-slate-900/25 border border-white/10">
      <div className="relative aspect-[16/9]">
        <img src={cover} alt={title} className="h-full w-full object-cover" loading="lazy" />
        <button className="absolute left-3 bottom-3 rounded-md bg-white/10 border border-white/30 px-2.5 py-1.5 text-xs backdrop-blur hover:scale-105 transition">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7L8 5z" fill="white" />
            </svg>
            Preview
          </div>
        </button>
      </div>
      <div className="p-3">
        <h3 className="font-semibold tracking-tight text-sm sm:text-base">{title}</h3>
        <p className="text-xs sm:text-sm text-white/70 mt-1">{level}</p>
      </div>
    </article>
  );
}
