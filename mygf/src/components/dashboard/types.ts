// mygf/src/components/dashboard/types.ts
export type CourseProgress = {
  id: string;
  title: string;
  percent: number;
  gradient: { from: string; to: string };
  barColor: string; // e.g., "bg-blue-600"
  trackColor: string; // e.g., "bg-blue-200"
  status: "Completed" | "In Progress";
  remaining?: string; // e.g., "3 lessons remaining"
  showCertificate?: boolean;
};

export type CertificateItem = {
  id: string;
  title: string;
  issued: string;
  iconColor: string; // e.g., "text-yellow-600"
  bgGradient: string; // e.g., "from-yellow-50 to-yellow-100"
  borderColor: string; // e.g., "border-yellow-200"
};

export type QuickStat = {
  id: string;
  label: string;
  value: string;
  iconClass: string;   // e.g., "fas fa-book"
  iconBg: string;      // e.g., "bg-blue-100"
  iconColor: string;   // e.g., "text-blue-600"
  valueColor: string;  // e.g., "text-blue-600"
};
