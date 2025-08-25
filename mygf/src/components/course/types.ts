// mygf/src/components/course/types.ts
export interface CourseLevel {
  title: string;
  description: string;
  duration: string;
  lessons: number;
  assignment?: string;
}

export interface CourseData {
  title: string;
  description: string;
  duration: string;
  rating: number;
  reviews: number;
  tags: string[];
  levels: CourseLevel[];
}

export interface Review {
  name: string;
  rating: number;
  date: string;
  comment: string;
}
