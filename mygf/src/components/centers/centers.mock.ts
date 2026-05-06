//src/components/centers/centers.mock.ts
export type Center = {
  id: string;
  name: string;
  location: string;
  region: string;
  totalCourses: number;
  categories: number;
  students: string;
};

export const centers: Center[] = [
  {
    id: "1",
    name: "Belagavi Center",
    location: "Belagavi, Karnataka",
    region: "Karnataka Region",
    totalCourses: 32,
    categories: 5,
    students: "2.4K+",
  },
  {
    id: "2",
    name: "Uttara Karnataka Center",
    location: "Dharwad, Karnataka",
    region: "Karnataka Region",
    totalCourses: 28,
    categories: 4,
    students: "1.8K+",
  },
  {
    id: "3",
    name: "Udupi Center",
    location: "Udupi, Karnataka",
    region: "Karnataka Region",
    totalCourses: 24,
    categories: 4,
    students: "1.6K+",
  },
  {
    id: "4",
    name: "Davanagere Center",
    location: "Davanagere, Karnataka",
    region: "Karnataka Region",
    totalCourses: 26,
    categories: 4,
    students: "2.1K+",
  },
];