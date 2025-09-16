// mygf/src/components/join/types.ts
export type CourseOption = {
  id: string;
  title: string;
  duration: string | null;
  /** Authoritative price in paise (integer) */
  pricePaise: number;
  /** Optional list prices in paise */
  mrpPaise?: number | null;
  salePaise?: number | null;
};

export type Step = 1 | 2 | 3 | 4;
export type Gender = "Male" | "Female" | "Other";
export type DiscountKind = "none" | "coupon" | "refer";
export type PayMethod = "online" | "cash";
export type PayMode = "full" | "part";
