// src/api/student/courses.ts
import { api } from "../client";

export type StudentCourse = {
  id: string;
  title: string;
  duration?: string;
  price?: number;
  image?: string;
  visibility?: "public" | "private" | "unlisted";
};

export async function listStudentCourses(): Promise<StudentCourse[]> {
  const { data } = await api.get("catalog/courses", { withCredentials: true });
  return (data ?? []).map((c: any) => ({
    id: c.id ?? c._id ?? "",
    title: c.title,
    duration: c.duration,
    price: c.price,
    image: c.image,
    visibility: c.visibility,
  }));
}
