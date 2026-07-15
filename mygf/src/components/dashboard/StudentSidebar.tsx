//src/components/dashboard/StudentSidebar.tsx
import { useState } from "react";
import { useAuth } from "../../auth/store";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    BookOpen,
    // Building2,
    // Settings,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
} from "lucide-react";

export default function StudentSidebar() {
    const user = useAuth((s) => s.user);
    const status = useAuth((s) => s.status);
    const [collapsed, setCollapsed] = useState(
        typeof window !== "undefined" ? window.innerWidth < 1024 : false
    );

    const navigate = useNavigate();
    const location = useLocation();

        // Prevent sidebar render until auth hydration completes
    // and a valid authenticated session exists.
    if (status !== "ready" || !user) {
        return null;
    }

    const items = [
        { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { label: "Courses", icon: BookOpen, path: "/tracks" },

        // ✅ NEW ITEMS
        { label: "Enrolled Courses", icon: GraduationCap, path: "/enrolled" },
        // { label: "My Certificates", icon: Award, path: "#" },

        // { label: "Center", icon: Building2, path: "/centers" },
        // { label: "Settings", icon: Settings, path: "#" },
    ];

    return (
        <aside
            className={`hidden md:flex flex-col ${collapsed ? "w-16" : "w-64"
                } bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 h-screen sticky top-0 transition-all duration-300`}
        >
            {/* TOP */}
            <div className="flex items-center justify-between px-3 py-3">
                {!collapsed && (
                    <span className="text-sm font-semibold text-black dark:text-black">
                        Student
                    </span>
                )}

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                    {collapsed ? (
                        <ChevronRight size={16} />
                    ) : (
                        <ChevronLeft size={16} />
                    )}
                </button>
            </div>

            {/* NAV */}
            <nav className="flex-1 px-2 mt-2 space-y-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <button
                            key={item.label}
                            onClick={() => item.path !== "#" && navigate(item.path)}
                            title={collapsed ? item.label : ""}
                            className={`relative w-full flex items-center ${collapsed ? "justify-center" : "justify-start"
                                } gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200
              
              ${isActive
                                    ? "bg-gray-100 dark:bg-slate-800 text-black dark:text-white"
                                    : "text-black dark:text-black hover:bg-gray-100 dark:hover:bg-slate-800"
                                }
              `}
                        >
                            {/* ACTIVE INDICATOR */}
                            {isActive && (
                                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gray-900 dark:bg-white" />
                            )}

                            {/* ICON */}
                            <Icon size={18} className="flex-shrink-0" />

                            {/* LABEL */}
                            {!collapsed && (
                                <span className="truncate">{item.label}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* BOTTOM */}
            {/* <div className="px-3 py-3">
                {!collapsed && (
                    <div className="text-xs text-black dark:text-black">
                        Student Panel
                    </div>
                )}
            </div> */}
        </aside>
    );
}