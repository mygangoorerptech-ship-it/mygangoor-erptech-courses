//src/components/centers/CenterRow.tsx
import { useNavigate } from "react-router-dom";
import type { Center } from "./centers.mock";
import { Building2 } from "lucide-react";

export default function CenterRow({ center }: { center: Center }) {
  const navigate = useNavigate();

  return (
    <div className="group grid grid-cols-12 items-center px-4 py-4 border-b last:border-none hover:bg-gray-50 transition cursor-pointer">
      
      {/* LEFT */}
      <div className="col-span-5 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-100">
          <Building2 size={18} className="text-gray-500" />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-900">
            {center.name}
          </p>
          <p className="text-xs text-gray-500">
            {center.location}
          </p>
        </div>
      </div>

      {/* COURSES */}
      <div className="col-span-2 text-sm text-gray-700">
        {center.totalCourses}
      </div>

      {/* CATEGORIES */}
      <div className="col-span-2 text-sm text-gray-700">
        {center.categories}
      </div>

      {/* STUDENTS */}
      <div className="col-span-2 text-sm text-gray-700">
        {center.students}
      </div>

      {/* CTA */}
      <div className="col-span-1 text-right">
        <button
          onClick={() => navigate("/tracks")}
          className="text-sm text-gray-600 group-hover:text-indigo-600 transition"
        >
          View →
        </button>
      </div>
    </div>
  );
}