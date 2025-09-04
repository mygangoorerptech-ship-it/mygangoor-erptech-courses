// src/admin/features/overview/Overview.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";

// SA API
import { listOrganizations } from "../../api/organizations";
import { listSaUsers } from "../../api/saUsers";
import { listSaCourses } from "../../api/saCourses";

// Admin/Vendor API
import { listAdUsers } from "../../api/adUsers";
import { listCourses } from "../../api/courses";
import { listPayments } from "../../api/payments";

// Audit (org-scoped + SA) — resilient wrapper
import { listAuditLogs } from "../../api/audit";

// Payouts (SA only)
import { listPayouts } from "../../api/payouts";

// Utils & UI
import { formatINRFromPaise } from "../../utils/currency";
import {
  Building2,
  GraduationCap,
  Users2,
  Shield,
  BookOpen,
  Activity,
  Wallet,
  IndianRupee,
} from "lucide-react";

type CountCardProps = {
  label: string;
  value?: number | string;
  icon?: React.ReactNode;
  loading?: boolean;
};

function CountCard({ label, value, icon, loading }: CountCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-semibold">
          {loading ? "…" : value ?? "—"}
        </div>
      </div>
    </div>
  );
}

export default function OverviewUnified() {
  const { user, status } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isSA = role === "superadmin";
  const isAdmin = role === "admin";
  const isVendor = role === "vendor";

  const enabled = status === "ready" && !!user;

  // ----------------- PAYMENTS / REVENUE (real backend) -----------------
  const saPaymentsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:payments:all"],
    queryFn: async () => {
      const { data } = await api.get("/sa/payments");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const adPaymentsQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:payments:org", user?.orgId || "no-org"],
    queryFn: async () => listPayments({}),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const paymentsArr = (isSA ? saPaymentsQ.data : adPaymentsQ.data) ?? [];
  const paymentsLoading = isSA ? saPaymentsQ.isLoading : adPaymentsQ.isLoading;
  const paymentsCount = Array.isArray(paymentsArr) ? paymentsArr.length : 0;

  // Captured split by type
  const capturedOnlineCount = React.useMemo(
    () =>
      (paymentsArr as any[]).filter(
        (p) =>
          (p?.status || "").toLowerCase() === "captured" &&
          (p?.type || "").toLowerCase() === "online"
      ).length,
    [paymentsArr]
  );

  const capturedOfflineCount = React.useMemo(
    () =>
      (paymentsArr as any[]).filter(
        (p) =>
          (p?.status || "").toLowerCase() === "captured" &&
          (p?.type || "").toLowerCase() === "offline"
      ).length,
    [paymentsArr]
  );

  // Unsettled ONLINE captured (payouts pending)
  const unsettledOnlineCapturedCount = React.useMemo(
    () =>
      (paymentsArr as any[]).filter(
        (p) =>
          (p?.status || "").toLowerCase() === "captured" &&
          (p?.type || "").toLowerCase() === "online" &&
          (p?.settled === false ||
            p?.settled === undefined ||
            p?.settled === null)
      ).length,
    [paymentsArr]
  );

  // Revenue (30d) (captured/verified)
  const revenue30dPaise = React.useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let sum = 0;
    for (const p of paymentsArr as any[]) {
      const created = p?.createdAt ? new Date(p.createdAt).getTime() : 0;
      const paid =
        (p?.status === "captured" || p?.status === "verified") &&
        created >= cutoff;
      if (paid) sum += Number(p?.amount || 0);
    }
    return sum;
  }, [paymentsArr]);

  const revenue30d = formatINRFromPaise(revenue30dPaise);

  // ----------------- Payout summaries (SA only) -----------------
  const saPayoutsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:payouts:list"],
    queryFn: async () => {
      try {
        const list = await listPayouts({});
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ----------------- SUPERADMIN COUNTS -----------------
  const saOrgsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:orgs:count"],
    queryFn: async () => {
      const rows = await listOrganizations({ q: "", status: "all" } as any);
      if (Array.isArray(rows)) return rows.length;
      const items = (rows as any)?.items;
      if (Array.isArray(items)) return items.length;
      const total = (rows as any)?.total;
      return typeof total === "number" ? total : 0;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saAdminsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:admins:count"],
    queryFn: async () =>
      (await listSaUsers({ role: "admin", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saVendorsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:vendors:count"],
    queryFn: async () =>
      (await listSaUsers({ role: "vendor", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Students == orgusers (SA view)
  const saStudentsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:students:count"],
    queryFn: async () =>
      (await listSaUsers({ role: "orguser", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saCoursesQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:courses:count"],
    queryFn: async () => {
      const rows = await listSaCourses({ status: "all" } as any);
      if (Array.isArray(rows)) return rows.length;
      const items = (rows as any)?.items;
      if (Array.isArray(items)) return items.length;
      const total = (rows as any)?.total;
      return typeof total === "number" ? total : 0;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ----------------- ADMIN/VENDOR COUNTS (ORG-SCOPED) -----------------
  const adVendorsQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:vendors:count", user?.orgId || "no-org"],
    queryFn: async () =>
      (await listAdUsers({ role: "vendor", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Admin/Vendor API counts students as "student"
  const adStudentsQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:students:count", user?.orgId || "no-org"],
    queryFn: async () =>
      (await listAdUsers({ role: "student", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const adCoursesQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:courses:count", user?.orgId || "no-org"],
    queryFn: async () => {
      const rows = await listCourses({ status: "all" } as any);
      if (Array.isArray(rows)) return rows.length;
      const items = (rows as any)?.items;
      if (Array.isArray(items)) return items.length;
      const total = (rows as any)?.total;
      return typeof total === "number" ? total : 0;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const orgCount = isSA ? saOrgsQ.data ?? 0 : user?.orgId ? 1 : 0;
  const orgCountLoading = isSA ? saOrgsQ.isLoading : false;

  // ----------------- AUDIT LOGS (recent mutations) -----------------
  const auditQ = useQuery({
    enabled,
    queryKey: ["audit:recent", isSA ? "sa" : user?.orgId || "no-org"],
    queryFn: async () =>
      listAuditLogs({
        limit: 10,
        roles: ["admin", "vendor"],
        orgOnly: !isSA,
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // ----------------- Render -----------------
  const num = (x: unknown) => Number(x ?? 0); // ensure numbers

  return (
    <div className="space-y-6">
      {/* Top metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Build the card list based on role */}
        {(() => {
          const cards: Array<{
            key: string;
            label: string;
            value: number | string;
            loading?: boolean;
            icon: React.ReactNode;
          }> = [];

          // Organization(s)
          cards.push({
            key: "orgs",
            label: isSA ? "Organizations" : "Organization",
            value: num(orgCount),
            loading: orgCountLoading,
            icon: <Building2 size={24} className="text-slate-600" />,
          });

          // Admins (SA only)
          if (isSA) {
            cards.push({
              key: "admins",
              label: "Admins",
              value: num(saAdminsQ.data),
              loading: saAdminsQ.isLoading,
              icon: <Shield size={24} className="text-slate-600" />,
            });
          }

          // Vendors / Teachers
          if (isSA) {
            cards.push({
              key: "vendors",
              label: "Vendors",
              value: num(saVendorsQ.data),
              loading: saVendorsQ.isLoading,
              icon: <Users2 size={24} className="text-slate-600" />,
            });
          } else if (isAdmin) {
            cards.push({
              key: "vendors",
              label: "Vendors",
              value: num(adVendorsQ.data),
              loading: adVendorsQ.isLoading,
              icon: <Users2 size={24} className="text-slate-600" />,
            });
          }

          // Students
          if (isSA) {
            cards.push({
              key: "students",
              label: "Students",
              value: num(saStudentsQ.data),
              loading: saStudentsQ.isLoading,
              icon: <GraduationCap size={24} className="text-slate-600" />,
            });
          } else {
            cards.push({
              key: "students",
              label: "Students",
              value: num(adStudentsQ.data),
              loading: adStudentsQ.isLoading,
              icon: <GraduationCap size={24} className="text-slate-600" />,
            });
          }

          // Courses
          if (isSA) {
            cards.push({
              key: "courses",
              label: "Courses",
              value: num(saCoursesQ.data),
              loading: saCoursesQ.isLoading,
              icon: <BookOpen size={24} className="text-slate-600" />,
            });
          } else {
            cards.push({
              key: "courses",
              label: "Courses",
              value: num(adCoursesQ.data),
              loading: adCoursesQ.isLoading,
              icon: <BookOpen size={24} className="text-slate-600" />,
            });
          }

          // Payments (total) — SA + Admin
          if (isSA || isAdmin) {
            cards.push({
              key: "payments",
              label: "Payments",
              value: num(paymentsCount),
              loading: paymentsLoading,
              icon: <Wallet size={24} className="text-slate-600" />,
            });

            // Payments (captured – online)
            cards.push({
              key: "payments_captured_online",
              label: "Payments (captured – online)",
              value: num(capturedOnlineCount),
              loading: paymentsLoading,
              icon: <Wallet size={24} className="text-slate-600" />,
            });

            // Payments (captured – offline)
            cards.push({
              key: "payments_captured_offline",
              label: "Payments (captured – offline)",
              value: num(capturedOfflineCount),
              loading: paymentsLoading,
              icon: <Wallet size={24} className="text-slate-600" />,
            });
          }

          // Payouts (pending) — SA only; UNSETTLED captured ONLINE
          if (isSA) {
            cards.push({
              key: "payouts_pending_online",
              label: "Payouts (pending)",
              value: num(unsettledOnlineCapturedCount),
              loading: paymentsLoading || saPayoutsQ.isLoading,
              icon: <Activity size={24} className="text-slate-600" />,
            });
          }

          // Revenue (30 days) — SA + Admin (string)
          if (isSA || isAdmin) {
            cards.push({
              key: "revenue",
              label: "Revenue (30 days)",
              value: revenue30d, // already a string like ₹
              loading: paymentsLoading,
              icon: <IndianRupee size={24} className="text-slate-600" />,
            });
          }

          return cards.map((c) => (
            <CountCard
              key={c.key}
              label={c.label}
              value={c.value}
              loading={c.loading}
              icon={c.icon}
            />
          ));
        })()}
      </div>

      {/* Recent activity (audit) */}
      <div className="rounded-xl border bg-white">
        <div className="border-b p-3 font-medium">
          Recent activity (admins & vendors)
        </div>
        <div className="divide-y">
          {(auditQ.data ?? []).map((log: any) => (
            <div
              key={log.id || log._id}
              className="p-3 flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  {log.message || log.action || "—"}
                </div>
                <div className="text-xs text-slate-500">
                  {log.actorName || log.actorEmail || log.actorRole || "—"}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
              </div>
            </div>
          ))}
          {auditQ.isLoading && (
            <div className="p-3 text-center text-slate-500 text-sm">
              Loading…
            </div>
          )}
          {!auditQ.isLoading && (auditQ.data ?? []).length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
