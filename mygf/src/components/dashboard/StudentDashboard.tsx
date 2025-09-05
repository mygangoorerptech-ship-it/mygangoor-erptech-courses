// mygf/src/components/dashboard/StudentDashboard.tsx
import { useMemo, useState, useEffect } from "react";
import NavBar from "../home/NavBar";
import DashboardHeader from "./DashboardHeader";
import WelcomeBanner from "./WelcomeBanner";
import ProfileInfoCard from "./ProfileInfoCard";
import CourseProgressList from "./CourseProgressList";
import QuickStatsCard from "./QuickStatsCard";
import RecentCertificatesCard from "./RecentCertificatesCard";
import LearningStreakCard from "./LearningStreakCard";
import type { CertificateItem, QuickStat } from "./types";
import Footer from "../common/Footer";
import { useAuthHydration } from "../../hooks/useAuthHydration";
import { api } from "../../api/client";

function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function initialsFrom(name?: string | null, email?: string | null) {
  const src = (name || email || "").trim();
  if (!src) return "U";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return src[0]?.toUpperCase() || "U";
}

export default function StudentDashboard() {
  // Cookie session → hydrated once, then reused from Zustand
  const { user } = useAuthHydration();

  // Only the allowed fields
  const {
    name: uName,
    email: uEmail,
    status: uStatus,
    createdAt: uCreatedAt,
    isVerified: uVerified,
    orgId: uOrgId,
  } = (user as any) || {};

    // Backend-fetched extras
  const [orgName, setOrgName] = useState<string | null>(null);
  const [dobRaw, setDobRaw] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    // 1) DOB from latest student payment (if any)
    (async () => {
      try {
        const res = await api.get("/student/payments/latest", { withCredentials: true });
        const dob = res?.data?.payment?.dob ?? null;
        if (!aborted) setDobRaw(dob);
      } catch {
        if (!aborted) setDobRaw(null); // keep placeholder if none
      }
    })();

    // 2) Organization name (if student belongs to an org)
(async () => {
  if (!uOrgId) {
    setOrgName(null);
    return;
  }
  try {
    // ⬇️ changed path to the brief endpoint (no role issue)
    const res = await api.get(`/organizations/${uOrgId}/brief`, { withCredentials: true });
    const name =
      (res?.data?.organization && res.data.organization.name) ||
      res?.data?.name ||
      null;
    setOrgName(name);
  } catch {
    setOrgName(null);
  }
})();
    return () => {
      aborted = true;
    };
  }, [uOrgId]);

  const profile = useMemo(() => {
    const name = uName || "Student";
    const handle = uEmail || "student@example.com"; // handle == email
    const registrationDate = formatDate(uCreatedAt);

    // statusBadges now reflect isVerified, Premium badge stays
    const verifiedBadge = uVerified
      ? { text: "Verified", bg: "bg-green-100", textColor: "text-green-800" }
      : { text: "Unverified", bg: "bg-amber-100", textColor: "text-amber-800" };

    const statusBadges: Array<{ text: string; bg: string; textColor: string }> = [verifiedBadge];

    // Replace previous "Premium Member" with Organization name; hide if no org
    if (orgName) {
      statusBadges.push({
        text: orgName,
        bg: "bg-blue-100",
        textColor: "text-blue-800",
      });
    }

    // Account status maps DB status -> component type
    const accountStatus: "Active" | "Suspended" =
      uStatus === "active" ? "Active" : "Suspended";

        // DOB display: keep header, and show fallback if null
    const dobDisplay = dobRaw ? formatDate(dobRaw) : "-- / -- / ----";

    return {
      initials: initialsFrom(name, handle),
      name,
      handle,
      statusBadges,
      dob: dobDisplay,
      registrationDate,               // real (createdAt)
      paymentStatus: "Paid" as const, // dummy (unchanged)
      accountStatus,                  // real (status)
    };
  }, [uName, uEmail, uStatus, uCreatedAt, uVerified, orgName, dobRaw]);

  const quickStats: QuickStat[] = [
    { id: "s1", label: "Total Courses", value: "12", iconClass: "fas fa-book", iconBg: "bg-blue-100", iconColor: "text-blue-600", valueColor: "text-blue-600" },
    { id: "s2", label: "Completed", value: "8", iconClass: "fas fa-check-circle", iconBg: "bg-green-100", iconColor: "text-green-600", valueColor: "text-green-600" },
    { id: "s3", label: "In Progress", value: "4", iconClass: "fas fa-clock", iconBg: "bg-yellow-100", iconColor: "text-yellow-600", valueColor: "text-yellow-600" },
    { id: "s4", label: "Certificates", value: "8", iconClass: "fas fa-certificate", iconBg: "bg-purple-100", iconColor: "text-purple-600", valueColor: "text-purple-600" },
  ];

  const certificates: CertificateItem[] = [
    { id: "cert1", title: "Web Development", issued: "Dec 2024", iconColor: "text-yellow-600", bgGradient: "from-yellow-50 to-yellow-100", borderColor: "border-yellow-200" },
    { id: "cert2", title: "JavaScript Basics", issued: "Nov 2024", iconColor: "text-blue-600", bgGradient: "from-blue-50 to-blue-100", borderColor: "border-blue-200" },
    { id: "cert3", title: "HTML & CSS", issued: "Oct 2024", iconColor: "text-green-600", bgGradient: "from-green-50 to-green-100", borderColor: "border-green-200" },
  ];

  return (
    <>
      <div className="relative z-20">
        <NavBar />
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen font-sans pt-16 sm:pt-20">
        <DashboardHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <WelcomeBanner name={profile.name} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ProfileInfoCard
                initials={profile.initials}
                name={profile.name}
                handle={profile.handle}
                statusBadges={profile.statusBadges}
                dob={profile.dob}
                registrationDate={profile.registrationDate}
                paymentStatus={profile.paymentStatus}
                accountStatus={profile.accountStatus}
              />
              <CourseProgressList />
            </div>

            <div className="space-y-6">
              <QuickStatsCard stats={quickStats} />
              <RecentCertificatesCard items={certificates} />
              <LearningStreakCard days={15} />
            </div>
          </div>
        </main>
      </div>

      <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
    </>
  );
}
