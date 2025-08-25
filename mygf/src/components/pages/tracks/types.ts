// mygf/src/components/pages/tracks/types.ts
export type Level = "Beginner" | "Intermediate" | "Advanced";
export type Availability = "any" | "available" | "unavailable";

export type Course = {
  id: string;
  title: string;
  track: "Programming" | "Design" | "Data";
  level: Level;
  durationHours: number;
  rating: number;
  ratingCount?: number;
  cover?: string; // <-- new field
  pill?: "Preview" | "Top Rated" | "Free";
};

export const CHIP_OPTIONS = ["All", "Latest", "Design"] as const;
export type Chip = (typeof CHIP_OPTIONS)[number];
