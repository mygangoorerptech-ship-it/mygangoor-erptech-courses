// mygf/src/components/join/types.ts
export type CourseOption = {
  id: string;
  title: string;

  // duration
  duration?: string | null;
  durationHours?: number | null;

  // pricing (paise = source of truth)
  pricePaise?: number | null;
  mrpPaise?: number | null;
  salePaise?: number | null;
  discountPercent?: number | null;

  // fallback (legacy UI)
  price?: number;

  // visuals
  cover?: string;
  pill?: string;
  track?: string;
  level?: string;
  rating?: number;
  ratingCount?: number;

  // org
  orgName?: string | null;
  centerIds?: string[];
  centerNames?: string[];
};

export type Step = 1 | 2 | 3 | 4;
export type Gender = "Male" | "Female" | "Other";
export type DiscountKind = "none" | "coupon" | "refer";
export type PayMethod = "online" | "cash";
export type PayMode = "full" | "part";
