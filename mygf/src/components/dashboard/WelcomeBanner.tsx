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
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 mb-8 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h2>
          <p className="text-blue-100 text-lg">{subtitle}</p>
        </div>
        <div className="hidden md:block">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
            <i className="fas fa-user-graduate text-4xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
