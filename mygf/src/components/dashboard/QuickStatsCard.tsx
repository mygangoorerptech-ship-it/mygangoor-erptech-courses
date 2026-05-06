// mygf/src/components/dashboard/QuickStatsCard.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import type { QuickStat } from "./types";
import { api } from "../../api/client";

type Props = { stats: QuickStat[] };

// Normalise status safely
const norm = (v?: string | null) => String(v || "").trim().toLowerCase();

export default function QuickStatsCard({ stats }: Props) {
  const [counts, setCounts] = useState({ total: 0, completed: 0, inProgress: 0, certificates: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ✅ correct endpoints
        const enr = await api.get("/student/enrollments/active");
        // controller can return array OR { ok, items }
        const list = Array.isArray(enr?.data) ? enr.data : (enr?.data?.items || []);

        // count Total ONLY for premium enrollments
        const items: Array<{ courseId?: string; status?: string }> = list || [];
        const premium = items.filter((i) => norm(i.status) === "premium");
        const courseIds = premium.map((i) => String(i.courseId || "")).filter(Boolean);

        // fetch progress per course
        const progresses = await Promise.all(
          courseIds.map(async (cid) => {
            try {
              const r = await api.get(`/student/progress/${cid}`);
              return r?.data || null;
            } catch {
              return null;
            }
          })
        );

        let completed = 0, inProgress = 0, certificates = 0;
        for (const p of progresses) {
          if (!p) continue;
          const s = norm(p.overallStatus);
          if (s === "completed" || s === "complete") completed += 1;
          else if (s === "in-progress" || s === "inprogress" || s === "started") inProgress += 1;
          if (p.certificateUrl) certificates += 1; // non-null only
        }

        if (!cancelled) {
          setCounts({ total: courseIds.length || 0, completed, inProgress, certificates });
        }
      } catch {
        if (!cancelled) setCounts({ total: 0, completed: 0, inProgress: 0, certificates: 0 });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Override incoming mock values but keep the same labels/icons/colors
  const merged: QuickStat[] = useMemo(() => {
    const pick = (label: string) => {
      const L = label.toLowerCase();
      if (L.includes("total")) return String((counts.total ?? 0) || 0);
      if (L.includes("completed")) return String((counts.completed ?? 0) || 0);
      if (L.includes("progress")) return String((counts.inProgress ?? 0) || 0);
      if (L.includes("certificate")) return String((counts.certificates ?? 0) || 0);
      return "0";
    };
    return (stats || []).map((s) => ({ ...s, value: loaded ? pick(s.label) : "0" }));
  }, [stats, counts, loaded]);

  return (
    <Card>
      <h4 className="text-sm font-semibold text-gray-900 mb-4">Overview</h4>
      <div className="space-y-3">
        {merged.map((s) => (
          <div key={s.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
<div className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100">
  <i className={`${s.iconClass} text-gray-500 text-sm`} />
</div>
              <span className="text-sm text-gray-500">{s.label}</span>
            </div>
            <span className={`font-bold text-2xl ${s.valueColor}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
