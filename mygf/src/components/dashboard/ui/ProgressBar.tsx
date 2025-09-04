// mygf/src/components/dashboard/ui/ProgressBar.tsx
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number; // 0..100
  barColor: string; // Tailwind class e.g., "bg-blue-600"
  trackColor: string; // Tailwind class e.g., "bg-blue-200"
  animateDelayMs?: number;
};

export default function ProgressBar({
  value,
  barColor,
  trackColor,
  animateDelayMs = 500,
}: Props) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    // mimic original: set to 0 then animate to full after delay
    if (!mounted.current) {
      mounted.current = true;
      const t = setTimeout(() => setWidth(value), animateDelayMs);
      return () => clearTimeout(t);
    }
  }, [value, animateDelayMs]);

  return (
    <div className={`w-full ${trackColor} rounded-full h-2`}>
      <div
        className={`${barColor} h-2 rounded-full transition-[width] duration-1000 ease-in-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
