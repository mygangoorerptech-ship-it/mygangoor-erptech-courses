//src/components/centers/CentersStats.tsx
//src/components/centers/CentersStats.tsx
import { useEffect, useState } from "react";
import {
  Building2,
  BookOpen,
  Layers3,
  Users2,
} from "lucide-react";

import { getOrgStats } from "../../api/orgs";

export default function CentersStats() {
  const [stats, setStats] = useState({
    totalCenters: 0,
    totalCatalogCourses: 0,
    totalCategories: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await getOrgStats();

        setStats({
          totalCenters: res.totalCenters || 0,
          totalCatalogCourses: res.totalCatalogCourses || 0,
          totalCategories: res.totalCategories || 0,
          totalStudents: res.totalStudents || 0,
        });
      } catch (e) {
        console.error("Stats fetch failed");
      }
    })();
  }, []);

  const data = [
    {
      label: "Total Centers",
      value: stats.totalCenters,
      icon: Building2,
    },
    {
      label: "Catalog Courses",
      value: stats.totalCatalogCourses,
      icon: BookOpen,
    },
    {
      label: "Categories",
      value: stats.totalCategories,
      icon: Layers3,
    },
    {
      label: "Students",
      value: stats.totalStudents,
      icon: Users2,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {data.map((s) => {
        const Icon = s.icon;

        return (
          <div
            key={s.label}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-gray-300 hover:shadow-md"
          >
            {/* TOP */}
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 transition group-hover:bg-gray-900">
                <Icon
                  size={20}
                  strokeWidth={1.9}
                  className="text-gray-700 transition group-hover:text-white"
                />
              </div>

              <span className="text-[11px] font-medium text-gray-400">
                LIVE
              </span>
            </div>

            {/* VALUE */}
            <div className="mt-6">
              <p className="text-3xl font-semibold tracking-tight text-gray-900">
                {s.value}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {s.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}