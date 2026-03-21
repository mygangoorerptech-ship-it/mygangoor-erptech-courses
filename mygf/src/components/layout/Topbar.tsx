// mygf/src/components/layout/Topbar.tsx
import { Menu } from "lucide-react";
import RoleAvatar from "../../admin/avatar/RoleAvatar";
import { useAuth } from "../../auth/store";
import { useNavigate } from "react-router-dom";

export default function Topbar({
  role,
  onMenuClick,
}: {
  role: "superadmin" | "admin" | "teacher" | "student" | "orgadmin" | "orguser";
  onMenuClick: () => void;
}) {
  const { user, logout } = useAuth();
  const name = (user as any)?.name || (user as any)?.fullName || "User";
  const nav = useNavigate();

  const handleLogout = async () => {
    try {
      await (logout?.());
    } catch {}
    nav("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
            aria-label="Open menu"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-500 capitalize">{role}</span>
            <span className="text-sm text-gray-300">•</span>
            <span className="text-sm font-semibold">Dashboard</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 pr-2">
            <span className="text-sm text-gray-600 truncate max-w-[12rem]">{name}</span>
          </div>
          <RoleAvatar role={role} size={28} />
          <button
            onClick={handleLogout}
            className="ml-2 inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
