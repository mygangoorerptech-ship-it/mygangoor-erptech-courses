// src/components/enrolled/EnrolledStats.tsx

import {
  BookOpen,
  Clock3,
  CircleCheckBig,
  LoaderCircle,
} from "lucide-react";

interface Props {
  totalCourses: number;
  inProgressCourses: number;
  completedCourses: number;
  totalLearningHours?: number;
}

export default function EnrolledStats({
  totalCourses,
  inProgressCourses,
  completedCourses,
  totalLearningHours = 0,
}: Props) {
  const stats = [
    {
      title: "Total Enrolled",
      value: totalCourses,
      subtitle: "Courses",
      icon: BookOpen,
    },
    {
      title: "In Progress",
      value: inProgressCourses,
      subtitle: "Courses",
      icon: LoaderCircle,
    },
    {
      title: "Completed",
      value: completedCourses,
      subtitle: "Courses",
      icon: CircleCheckBig,
    },
    {
      title: "Total Learning",
      value: `${totalLearningHours}h`,
      subtitle: "Learning Time",
      icon: Clock3,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              {/* ICON */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Icon className="h-7 w-7" />
              </div>

              {/* CONTENT */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">
                  {item.title}
                </p>

                <h3 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                  {item.value}
                </h3>

                <p className="text-sm text-slate-500">
                  {item.subtitle}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}