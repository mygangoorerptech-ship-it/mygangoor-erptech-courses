// mygf/src/components/common/TopProgressBar.tsx
import { useEffect, useRef, useState } from "react";

export default function TopProgressBar({
  active,
  zIndex = 80,
}: {
  active: boolean;
  zIndex?: number;
}) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      setVisible(true);
      setProgress((p) => (p < 10 ? 10 : p)); // start near-visible
      if (timer.current) window.clearInterval(timer.current);
      timer.current = window.setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          const delta = Math.max(1, (90 - p) * 0.06); // decelerate to 90%
          return Math.min(90, p + delta);
        });
      }, 200);
    } else {
      if (timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
      setProgress(100);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 320); // slightly > CSS transition
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [active]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 pointer-events-none" style={{ zIndex }}>
      <div className="h-[2px] w-full bg-transparent">
        <div
          className="h-full bg-slate-900/90 transition-[width,opacity] duration-200 ease-linear"
          style={{ width: `${progress}%`, opacity: visible ? 1 : 0.9 }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
