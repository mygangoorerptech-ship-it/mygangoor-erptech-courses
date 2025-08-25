import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { Role } from "../../config/nav";

export default function DashboardLayout({ role }: { role: Role }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar role={role} onMenuClick={() => setMobileOpen(true)} />

      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div className="relative lg:flex lg:gap-6">
          {/* Sidebar (drawer on mobile, inline on desktop) */}
          <Sidebar role={role} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

          {/* Main content */}
          <main className="flex-1 pt-4 lg:pt-6 lg:pl-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4 sm:p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
