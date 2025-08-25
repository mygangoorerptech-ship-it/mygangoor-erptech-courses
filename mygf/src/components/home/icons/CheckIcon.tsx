import React from "react";

type Props = {
  animated?: boolean;
  durationMs?: number; // keep in sync with bar
  delayMs?: number;    // row-based delay
  className?: string;
};

export default function CheckIcon({
  animated = false,
  durationMs = 2500,
  delayMs = 0,
  className = "",
}: Props) {
  // One path that draws/undraws using stroke-dashoffset.
  // We set a generous dash length so it fully “writes” the tick.
  const style: React.CSSProperties = animated
    ? ({
        ["--dur" as any]: `${durationMs}ms`,
        ["--delay" as any]: `${delayMs}ms`,
      } as React.CSSProperties)
    : {};

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* base (subtle slate) — always visible */}
      <path d="M5 13l4 4L19 7" className="stroke-slate-300" />

      {/* animated overlay (draw/undraw + color shift) */}
      <path
        d="M5 13l4 4L19 7"
        className={animated ? "animate-checkDrawColor" : "stroke-green-500"}
        style={style}
      />
    </svg>
  );
}
