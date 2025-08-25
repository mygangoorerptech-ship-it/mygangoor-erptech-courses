// mygf/src/components/join/types.ts
export type CourseOption = {
  id: string;
  title: string;
  duration: string;
  price: number;
};

export type Step = 1 | 2 | 3 | 4;
export type Gender = "Male" | "Female" | "Other";
export type DiscountKind = "none" | "coupon" | "refer";
export type PayMethod = "online" | "cash";
export type PayMode = "full" | "part";
