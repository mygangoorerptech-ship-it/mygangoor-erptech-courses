// mygf/src/components/dashboard/StudentDashboard.tsx
import { useMemo } from "react";
import NavBar from "../home/NavBar";
import DashboardHeader from "./DashboardHeader";
import WelcomeBanner from "./WelcomeBanner";
import ProfileInfoCard from "./ProfileInfoCard";
import CourseProgressList from "./CourseProgressList";
import QuickStatsCard from "./QuickStatsCard";
import RecentCertificatesCard from "./RecentCertificatesCard";
import LearningStreakCard from "./LearningStreakCard";
import type { CourseProgress, CertificateItem, QuickStat } from "./types";
import Footer from "../common/Footer";
import { useAuthHydration } from "../../hooks/useAuthHydration";

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
  } = (user as any) || {};

  const profile = useMemo(() => {
    const name = uName || "Student";
    const handle = uEmail || "student@example.com"; // handle == email
    const registrationDate = formatDate(uCreatedAt);

    // statusBadges now reflect isVerified, Premium badge stays
    const verifiedBadge = uVerified
      ? { text: "Verified", bg: "bg-green-100", textColor: "text-green-800" }
      : { text: "Unverified", bg: "bg-amber-100", textColor: "text-amber-800" };

    const statusBadges: Array<{ text: string; bg: string; textColor: string }> = [
      verifiedBadge,
      { text: "Premium Member", bg: "bg-blue-100", textColor: "text-blue-800" },
    ];

    // Account status maps DB status -> component type
    const accountStatus: "Active" | "Suspended" =
      uStatus === "active" ? "Active" : "Suspended";

    return {
      initials: initialsFrom(name, handle),
      name,
      handle,
      statusBadges,
      dob: "March 15, 1998",          // dummy (unchanged)
      registrationDate,               // real (createdAt)
      paymentStatus: "Paid" as const, // dummy (unchanged)
      accountStatus,                  // real (status)
    };
  }, [uName, uEmail, uStatus, uCreatedAt, uVerified]);

  // Keep existing demo data for the other cards
  const courseProgress: CourseProgress[] = [
    {
      id: "c1",
      title: "Web Development Fundamentals",
      percent: 100,
      gradient: { from: "from-blue-50", to: "to-blue-100" },
      barColor: "bg-blue-600",
      trackColor: "bg-blue-200",
      status: "Completed",
      showCertificate: true,
    },
    {
      id: "c2",
      title: "React.js Advanced",
      percent: 85,
      gradient: { from: "from-green-50", to: "to-green-100" },
      barColor: "bg-green-600",
      trackColor: "bg-green-200",
      status: "In Progress",
      remaining: "3 lessons remaining",
    },
    {
      id: "c3",
      title: "Database Design",
      percent: 45,
      gradient: { from: "from-purple-50", to: "to-purple-100" },
      barColor: "bg-purple-600",
      trackColor: "bg-purple-200",
      status: "In Progress",
      remaining: "8 lessons remaining",
    },
  ];

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

      <div className="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen font-sans">
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
              <CourseProgressList items={courseProgress} />
            </div>

            <div className="space-y-6">
              <QuickStatsCard stats={quickStats} />
              <RecentCertificatesCard items={certificates} />
              <LearningStreakCard days={15} />
            </div>
          </div>
        </main>
      </div>

      <Footer brandName="MithunKumar" tagline="Learn smarter. Build faster." />
    </>
  );
}
