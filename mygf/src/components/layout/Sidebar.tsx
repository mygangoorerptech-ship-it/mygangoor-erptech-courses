// mygf/src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { MENUS, type Role, type MenuGroup } from "../../config/nav";
import RoleAvatar from "../../admin/avatar/RoleAvatar";
import { motion } from "framer-motion";
import { useAuth } from "../../auth/store";

// very small hook to detect ≥lg for Framer
function useIsLg() {
  const [isLg, setIsLg] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLg(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isLg;
}

export default function Sidebar({
  role,
  mobileOpen,
  onClose,
}: {
  role: Role;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const isLg = useIsLg();
  const { user } = useAuth();
  const name = (user as any)?.name || (user as any)?.fullName || "User";
  const groups: MenuGroup[] = React.useMemo(() => MENUS[role] || [], [role]);

  return (
    <>
      {/* Drawer / static sidebar */}
      <motion.aside
        initial={false}
        animate={isLg ? { x: 0 } : { x: mobileOpen ? 0 : -288 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={[
          "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r shadow-sm",
          "lg:static lg:shadow-none",
        ].join(" ")}
        role="navigation"
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b">
            <RoleAvatar role={role} size={36} />
            <div className="leading-tight">
              <div className="text-[11px] text-gray-500 capitalize">{role}</div>
              <div className="text-sm font-semibold truncate max-w-[10rem]">{name}</div>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {groups.map((g, i) => (
              <div key={i} className="mb-4">
                {g.heading && (
                  <div className="px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {g.heading}
                  </div>
                )}
                <ul className="space-y-1">
                  {g.items.map((it) => {
                    const Icon = it.icon as any;
                    return (
                      <li key={it.to}>
                        <NavLink
                          to={it.to}
                          end={!!it.exact}
                          className={({ isActive }) =>
                            [
                              "group flex items-center gap-3 px-3 py-2 rounded-xl transition",
                              isActive
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                                : "text-gray-700 hover:bg-gray-50",
                            ].join(" ")
                          }
                          onClick={!isLg ? onClose : undefined}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" />}
                          <span className="text-sm font-medium">{it.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="px-4 py-3 border-t text-xs text-gray-500">© {new Date().getFullYear()}</div>
        </div>
      </motion.aside>

      {/* Mobile backdrop */}
      {!isLg && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
