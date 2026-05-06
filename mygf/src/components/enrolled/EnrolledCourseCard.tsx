// src/components/enrolled/EnrolledCourseCard.tsx

import {
  Heart,
  Lock,
  MoreVertical,
} from "lucide-react";

import type { EnrolledCourse } from "./types";

export default function EnrolledCourseCard({
  course,
}: {
  course: EnrolledCourse;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />

        {/* Level */}
        <div className="absolute left-4 top-4 rounded-lg bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {course.level}
        </div>

        {/* Wishlist */}
        <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white/30">
          <Heart className="h-5 w-5" />
        </button>

        {/* Lock */}
        {course.locked && (
          <div className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md">
            <Lock className="h-5 w-5" />
          </div>
        )}

        {/* Premium */}
        {course.premium && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            Premium
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {course.category}
            </p>

            <h3 className="mt-2 line-clamp-2 text-xl font-bold leading-snug text-slate-900">
              {course.title}
            </h3>
          </div>

          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-500">
              Progress
            </span>

            <span className="font-semibold text-slate-700">
              {course.progress}% Complete
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              style={{ width: `${course.progress}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                course.completed
                  ? "bg-green-500"
                  : "bg-indigo-500"
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]">
              Continue Learning
            </button>

            <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]">
              View Details
            </button>
          </div>

          {/* Duration */}
          <span className="text-sm font-semibold text-slate-500">
            {course.duration}
          </span>
        </div>
      </div>
    </div>
  );
}