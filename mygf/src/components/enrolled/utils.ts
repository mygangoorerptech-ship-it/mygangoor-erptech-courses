// src/components/enrolled/utils.ts

import type {
  CourseDetailResponse,
  CourseProgressResponse,
  EnrolledCourse,
} from "./types";

/**
 * Safely calculate progress percentage
 * from chapter completion statuses.
 */
export function calculateCourseProgress(
  progress?: CourseProgressResponse | null,
  totalChapters?: number
): number {
  if (!progress || !Array.isArray(progress.statuses)) {
    return 0;
  }

  const total =
    typeof totalChapters === "number" && totalChapters > 0
      ? totalChapters
      : progress.statuses.length;

  if (total <= 0) return 0;

  const completed = progress.statuses.filter(
    (s) => s.status === "complete"
  ).length;

  return Math.min(
    100,
    Math.round((completed / total) * 100)
  );
}

/**
 * Determine course completion state.
 */
export function isCourseCompleted(
  progress?: CourseProgressResponse | null
): boolean {
  if (!progress) return false;

  const overall =
    progress.overallStatus?.toLowerCase?.() || "";

  if (
    overall === "complete" ||
    overall === "completed"
  ) {
    return true;
  }

  if (!Array.isArray(progress.statuses)) {
    return false;
  }

  return progress.statuses.every(
    (s) => s.status === "complete"
  );
}

/**
 * Transform existing backend course
 * into enrolled UI model.
 */
export function transformToEnrolledCourse(
  course: CourseDetailResponse,
  progress?: CourseProgressResponse | null
): EnrolledCourse {
  const totalChapters = Array.isArray(course.chapters)
    ? course.chapters.length
    : 0;

  const completedChapters = Array.isArray(progress?.statuses)
    ? progress!.statuses.filter(
        (s) => s.status === "complete"
      ).length
    : 0;

  const progressPercent = calculateCourseProgress(
    progress,
    totalChapters
  );

  const completed = isCourseCompleted(progress);

  return {
    id: course.id,

    title: course.title || "Untitled Course",

    category: course.category || "COURSE",

    image:
      course.cover ||
      "https://placehold.co/1200x800/e2e8f0/64748b?text=Course",

    level:
      course.level?.toUpperCase?.() || "GENERAL",

    duration: course.duration || "—",

    progress: progressPercent,

    completed,

    premium: true,

    locked: false,

    slug: course.slug || null,

    tags: Array.isArray(course.tags)
      ? course.tags
      : [],

    chaptersCount: totalChapters,

    totalChapters,

    completedChapters,

    raw: course,
  };
}