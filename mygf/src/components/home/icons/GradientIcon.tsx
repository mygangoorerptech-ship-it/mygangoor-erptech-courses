// mygf/src/components/home/icons/GradientIcon.tsx
import type { JSX } from "react";

interface GradientIconProps {
  iconId: "home" | "certificates" | "about" | "login";
  uniqueSuffix?: string;
}

export default function GradientIcon({ iconId, uniqueSuffix = "" }: GradientIconProps) {
  const gradientId = `grad-${iconId}${uniqueSuffix ? `-${uniqueSuffix}` : ""}`;

  const iconPaths: Record<string, JSX.Element> = {
        home: (
      <path
        fill={`url(#${gradientId})`}
        d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5v-5H10v5A1.5 1.5 0 0 1 8.5 21.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z"
      />
    ),

certificates: (
  <g>
    {/* Document outline */}
    <rect
      x="3"
      y="4"
      width="15"
      height="15"
      rx="2"
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth="1.6"
    />

    {/* Text lines */}
    <rect x="5" y="7"  width="8" height="1.6" rx="0.8" fill={`url(#${gradientId})`} />
    <rect x="5" y="10" width="8" height="1.6" rx="0.8" fill={`url(#${gradientId})`} />
    <rect x="5" y="13" width="6" height="1.6" rx="0.8" fill={`url(#${gradientId})`} />

    {/* Seal (medallion) */}
    <circle cx="18" cy="12" r="3" fill={`url(#${gradientId})`} />

    {/* Checkmark on seal (white for contrast) */}
    <path
      d="M17.1 12.2l.9.9 1.7-1.9"
      fill="none"
      stroke="white"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Ribbon tails */}
    <path d="M17 15.5l-1 3 2-1.2z" fill={`url(#${gradientId})`} />
    <path d="M19 15.5l1 3-2-1.2z" fill={`url(#${gradientId})`} />
  </g>
),

    about: (
      <path
        fill={`url(#${gradientId})`}
        d="M12 2a10 10 0 100 20 10 10 0 000-20zm.75 15h-1.5v-6h1.5v6zm0-8h-1.5V7h1.5v2z"
      />
    ),
    login: (
      <path
        fill={`url(#${gradientId})`}
        d="M10 17l5-5-5-5v10zm9-15H5a2 2 0 00-2 2v4h2V4h14v16H5v-4H3v4a2 2 0 002 2h14a2 2 0 002-2V4a2 2 0 00-2-2z"
      />
    ),
  };

  const gradientColors: Record<string, [string, string]> = {
    home: ["#3b82f6", "#06b6d4"], // blue → cyan
    certificates: ["#34d399", "#3b82f6"], // green → blue
    about: ["#facc15", "#f43f5e"], // yellow → red
    login: ["#ec4899", "#f59e0b"], // pink → amber
  };

  const [from, to] = gradientColors[iconId];
  const iconPath = iconPaths[iconId];

  if (!iconPath) return null;

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {iconPath}
    </svg>
  );
}
