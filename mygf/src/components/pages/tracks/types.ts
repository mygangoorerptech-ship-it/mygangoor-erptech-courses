// mygf/src/components/pages/tracks/types.ts
export type Level = "Beginner" | "Intermediate" | "Advanced";
export type Availability = "any" | "available" | "unavailable";

export type Course = {
  id: string;
  title: string;

  // track is now the real slug; pill is the real category
  track?: string | null;        // slug (no fallback)
  pill?: string | null;         // category (no fallback)

  // Demo carry-overs to keep card rhythm
  level: Level;
  durationHours: number;

  rating: number;
  ratingCount?: number;
  cover?: string;               // parent/bundle cover (may be undefined)
  price?: number | null;        // (legacy rupees, optional)
  pricePaise?: number | null;   // ✅ canonical paise field
  discountPercent?: number;
  category?: string | null;
  tags?: string[];
  previewUrl?: string | null | undefined;
  description?: string;
  /** Organization name. null = global / platform course */
  orgName?: string | null;
  centerIds?: string[];
centerNames?: string[];
};

export const CHIP_OPTIONS = ["All", "Latest", "Design"] as const;
export type Chip = (typeof CHIP_OPTIONS)[number];
