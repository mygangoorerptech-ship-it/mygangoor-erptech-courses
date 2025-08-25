// mygf/src/components/join/steps/CourseStep.tsx
import React from "react";
import { Calendar, IndianRupee, Timer } from "lucide-react";
import { COURSES } from "../constants";
import InlineError from "../ui/InlineError";
import { classNames } from "../utils";

export default function CourseStep({
  selected, onSelect, error
}: { selected: string; onSelect: (id: string) => void; error?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <Timer className="w-4 h-4 text-indigo-600" />
        <p className="text-sm">Select a course to see its duration and fee.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {COURSES.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={classNames(
              "text-left p-4 rounded-xl border transition group",
              selected === c.id ? "border-indigo-600 ring-2 ring-indigo-200" : "hover:border-slate-300"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{c.title}</div>
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-1 text-sm text-slate-600 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              <span>{c.duration}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-slate-800">
              <IndianRupee className="w-4 h-4" />
              <span className="font-medium">{c.price === 0 ? "TBA" : `₹${c.price}`}</span>
            </div>
          </button>
        ))}
      </div>

      {error && <InlineError msg={error} />}
    </div>
  );
}
