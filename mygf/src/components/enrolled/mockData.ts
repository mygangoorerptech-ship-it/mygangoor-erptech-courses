// src/components/enrolled/mockData.ts

export interface EnrolledCourse {
  id: string;
  title: string;
  category: string;
  image: string;
  level: string;
  duration: string;
  progress: number;
  premium: boolean;
  locked?: boolean;
  completed?: boolean;
}

export const enrolledCourses: EnrolledCourse[] = [
  {
    id: "1",
    title: "Revit Architecture",
    category: "REVIT ARCHITECTURE",
    image:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=1400&auto=format&fit=crop",
    level: "3D MODELING",
    duration: "24h",
    progress: 75,
    premium: true,
  },
    {
    id: "2",
    title: "Tekla Structures for Beginners",
    category: "TEKLA STRUCTURES",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=1400&auto=format&fit=crop",
    level: "STRUCTURAL",
    duration: "18h",
    progress: 40,
    premium: false,
    locked: true,
  },
  {
    id: "3",
    title: "3ds Max Interior Visualization",
    category: "3DS MAX",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1400&auto=format&fit=crop",
    level: "INTERIOR DESIGN",
    duration: "30h",
    progress: 100,
    premium: true,
    completed: true,
  },
    {
    id: "4",
    title: "BIM Coordination with Navisworks",
    category: "BIM COORDINATION",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop",
    level: "BIM",
    duration: "16h",
    progress: 20,
    premium: false,
    locked: true,
  },
  {
    id: "5",
    title: "STAAD.Pro Advanced Structural Design",
    category: "STAAD PRO",
    image:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1400&auto=format&fit=crop",
    level: "STRUCTURAL",
    duration: "20h",
    progress: 60,
    premium: false,
    locked: true,
  },
  {
    id: "6",
    title: "AutoCAD 2D & 3D Complete Course",
    category: "AUTOCAD",
    image:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1400&auto=format&fit=crop",
    level: "ARCHITECTURE",
    duration: "28h",
    progress: 100,
    premium: true,
    completed: true,
  },
    {
    id: "7",
    title: "Primavera P6 Project Management",
    category: "PRIMAVERA P6",
    image:
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1400&auto=format&fit=crop",
    level: "CONSTRUCTION",
    duration: "12h",
    progress: 30,
    premium: false,
    locked: true,
  },
  {
    id: "8",
    title: "Lumion Rendering Masterclass",
    category: "LUMION",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1400&auto=format&fit=crop",
    level: "VISUALIZATION",
    duration: "22h",
    progress: 100,
    premium: true,
    completed: true,
  },
];