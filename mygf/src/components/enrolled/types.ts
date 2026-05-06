// src/components/enrolled/types.ts

/**
 * Final UI model used by Enrolled Courses page.
 * This model is intentionally isolated from backend APIs.
 * Any API response should first be transformed into this shape.
 */

export interface EnrolledCourse {
  id: string;

  // Core
  title: string;
  category: string;
  image: string;

  // Meta
  level: string;
  duration: string;

  // Learning state
  progress: number;
  completed: boolean;

  // Access state
  premium: boolean;
  locked: boolean;

  // Optional extras
  slug?: string | null;
  tags?: string[];

  // Existing backend compatibility
  chaptersCount?: number;
  totalChapters?: number;
  completedChapters?: number;

  // Optional raw source
  raw?: any;
}

/**
 * Progress API response
 * GET /student/progress/:courseId
 */

export interface CourseProgressResponse {
  statuses: Array<{
    chapterIndex: number;
    status: string;
  }>;

  overallStatus?: string;

  certificateUrl?: string | null;
}

/**
 * Existing course detail response
 * GET /student-catalog/courses/:courseId
 */

export interface CourseDetailResponse {
  id: string;

  title: string;

  slug?: string | null;

  category?: string | null;

  description?: string | null;

  duration?: string;

  level?: string | null;

  cover?: string | null;

  tags?: string[];

  visibility?: "public" | "private" | "unlisted";

  chapters?: Array<{
    title: string;

    description?: string | null;

    coverUrl?: string | null;

    videoUrl?: string | null;

    youtubeUrl?: string | null;

    durationSeconds?: number;
  }>;
}