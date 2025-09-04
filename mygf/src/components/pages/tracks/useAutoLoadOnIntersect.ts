// mygf/src/components/pages/tracks/useAutoLoadOnIntersect.ts
import { useEffect, useRef } from "react";

export default function useAutoLoadOnIntersect<T extends HTMLElement>(
  enabled: boolean,
  onHit: () => Promise<void> | void,
  options: IntersectionObserverInit = { root: null, rootMargin: "800px 0px", threshold: 0.01 }
) {
  const ref = useRef<T | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const el = ref.current;
    const obs = new IntersectionObserver(async (entries) => {
      const [e] = entries;
      if (!e?.isIntersecting || lock.current) return;
      lock.current = true;
      try {
        const p = onHit();
        if (p && typeof (p as any).finally === "function") await (p as Promise<void>);
      } finally {
        // small delay prevents rapid double triggers
        setTimeout(() => (lock.current = false), 150);
      }
    }, options);

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onHit]);

  return ref;
}
