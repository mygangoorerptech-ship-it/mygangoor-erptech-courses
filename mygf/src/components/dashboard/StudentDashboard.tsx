//  mygf/src/components/dashboard/StudentDashboard.tsx
import React from "react";
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

export default function StudentDashboard() {
  // Demo data mirrors your HTML content
  const profile = {
    initials: "AJ",
    name: "Alex Johnson",
    handle: "alexjohnson2024",
    statusBadges: [
      { text: "Active", bg: "bg-green-100", textColor: "text-green-800" },
      { text: "Premium Member", bg: "bg-blue-100", textColor: "text-blue-800" },
    ],
    dob: "March 15, 1998",
    registrationDate: "January 10, 2024",
    paymentStatus: "Paid" as const,
    accountStatus: "Active" as const,
  };

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
    {
      id: "s1",
      label: "Total Courses",
      value: "12",
      iconClass: "fas fa-book",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-600",
    },
    {
      id: "s2",
      label: "Completed",
      value: "8",
      iconClass: "fas fa-check-circle",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-600",
    },
    {
      id: "s3",
      label: "In Progress",
      value: "4",
      iconClass: "fas fa-clock",
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      valueColor: "text-yellow-600",
    },
    {
      id: "s4",
      label: "Certificates",
      value: "8",
      iconClass: "fas fa-certificate",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      valueColor: "text-purple-600",
    },
  ];

  const certificates: CertificateItem[] = [
    {
      id: "cert1",
      title: "Web Development",
      issued: "Dec 2024",
      iconColor: "text-yellow-600",
      bgGradient: "from-yellow-50 to-yellow-100",
      borderColor: "border-yellow-200",
    },
    {
      id: "cert2",
      title: "JavaScript Basics",
      issued: "Nov 2024",
      iconColor: "text-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
    },
    {
      id: "cert3",
      title: "HTML & CSS",
      issued: "Oct 2024",
      iconColor: "text-green-600",
      bgGradient: "from-green-50 to-green-100",
      borderColor: "border-green-200",
    },
  ];

  return (
        <>
              {/* make the sticky NavBar full-bleed (not inside max-w) */}
          <div className="relative z-20">
            <NavBar />
          </div>
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen font-sans">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WelcomeBanner name={profile.name} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: profile + progress */}
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

          {/* Right sidebar */}
          <div className="space-y-6">
            <QuickStatsCard stats={quickStats} />
            <RecentCertificatesCard items={certificates} />
            <LearningStreakCard days={15} />
          </div>
        </div>
      </main>
    </div>
                {/* Footer at the end */}
          <Footer
            brandName="MithunKumar"
            tagline="Learn smarter. Build faster."
          />
        </>
  );
}
