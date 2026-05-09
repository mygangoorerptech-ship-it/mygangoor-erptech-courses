//src/api/formProfile.ts
import { api } from "./client";

export type SavedFormProfile = {
  fullName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  birth: string;
  address: string;
  mobile: string;
  email: string;
};

export async function fetchFormProfile(): Promise<SavedFormProfile | null> {
  const { data } = await api.get("/student/profile/form");
  return data?.profile ?? null;
}

export function isProfileComplete(
  p: SavedFormProfile | null
): p is SavedFormProfile {
  return !!(
    p &&
    p.fullName?.trim() &&
    p.mobile?.trim() &&
    p.email?.trim()
  );
}
