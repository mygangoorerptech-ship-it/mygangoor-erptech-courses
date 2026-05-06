// mygf/src/components/dashboard/WelcomeBanner.tsx
import { useAuthHydration } from "../../hooks/useAuthHydration";

type Props = {
  name?: string;
  subtitle?: string;
};

export default function WelcomeBanner({
  name,
  subtitle = "Continue your learning journey",
}: Props) {
  const { user } = useAuthHydration();
  const displayName = name || user?.name || user?.email || "Learner";

return (
  <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      
      {/* LEFT CONTENT */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Welcome back, {displayName} 👋
        </h2>
        <p className="text-sm text-gray-500">
          {subtitle}
        </p>

        {/* CTA BUTTONS */}
        <div className="flex gap-3 mt-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            Browse Courses
          </button>

          <button className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            View My Progress
          </button>
        </div>
      </div>

      {/* RIGHT ICON (SUBTLE) */}
      <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-lg bg-gray-100">
        <i className="fas fa-graduation-cap text-gray-500 text-xl" />
      </div>
    </div>
  </div>
);
}
