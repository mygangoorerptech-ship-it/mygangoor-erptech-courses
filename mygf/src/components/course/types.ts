// src/components/course/types.ts
export type RawChapter = {
  id?: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  durationSeconds?: number;
};

export interface CourseLevel {
  title: string;
  description: string;
  duration: string;
  lessons: number;
  assignment?: string; // used for the single-level fallback label
}

export interface CourseData {
  title: string;
  description: string;
  duration: string;
  rating: number;
  reviews: number;
  tags: string[];
  levels: CourseLevel[];

  // extra meta (optional)
  id?: string;
  slug?: string | null;
  category?: string | null;
  level?: string | null; // beginner|intermediate|advanced|all
  cover?: string | null;
  chapters?: RawChapter[];
}

// Review type used in the CourseDetail and ReviewsSection components.
// Each review contains the reviewer's name, numeric rating (0–5), a
// comment, and an optional ISO string date when the review was
// created.
export interface Review {
  name: string;
  rating: number;
  comment: string;
  date?: string;
}
