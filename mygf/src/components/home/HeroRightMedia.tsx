// mygf/src/components/home/HeroRightMedia.tsx
import React from "react";
import CheckIcon from "./icons/CheckIcon";

export default function HeroRightMedia() {
  const tasks = ["Task 1", "Task 2", "Task 3"];
  const DUR = 2500; // ms (progress + check stay in sync)

  return (
    <div className="relative">
      {/* Mock video player */}
      <div className="rounded-2xl bg-slate-800/95 shadow-2xl shadow-slate-900/40 p-3 aspect-video w-full border border-white/10">
        <div className="h-full w-full rounded-xl bg-slate-900/60 relative overflow-hidden">
          {/* progress bar (background) */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="h-2 w-full rounded bg-slate-700">
              {/* demo progress to match the “player” */}
              <div
                className="h-2 rounded bg-red-400 animate-barFill"
                style={
                  {
                    // same timeline as checks
                    "--dur": `${DUR}ms`,
                    "--delay": `0ms`,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>

          {/* play button */}
          <button
            aria-label="Play"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-24 rounded-lg bg-white/10 border border-white/30 backdrop-blur hover:scale-105 transition grid place-items-center"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7L8 5z" fill="#ff4d4f" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Assignment card */}
      <div className="absolute -right-3 sm:-right-6 -bottom-6 translate-y-1/2 sm:translate-y-0 sm:-bottom-8">
        <div className="rounded-2xl bg-white shadow-xl shadow-slate-900/10 px-4 py-4 sm:px-5 sm:py-5 w-64 border border-slate-100 hover:-translate-y-0.5 transition">
          <p className="font-semibold text-slate-800 text-lg">Assignment</p>

          <ul className="mt-3 space-y-2">
            {tasks.map((t, index) => {
              const delayMs = index * 500; // stagger per row
              return (
                <li key={t} className="flex items-center gap-2">
                  <CheckIcon
                    animated
                    durationMs={DUR}
                    delayMs={delayMs}
                    className="shrink-0"
                  />
                  <span className="text-slate-600 font-medium w-16">{t}</span>

                  <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                    <div
                      className="h-2 rounded bg-gradient-to-r from-blue-400 to-cyan-500 animate-barFill"
                      style={
                        {
                          "--dur": `${DUR}ms`,
                          "--delay": `${delayMs}ms`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
