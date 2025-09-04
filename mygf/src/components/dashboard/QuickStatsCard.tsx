// mygf/src/components/dashboard/QuickStatsCard.tsx
import Card from "./ui/Card";
import type { QuickStat } from "./types";

type Props = { stats: QuickStat[] };

export default function QuickStatsCard({ stats }: Props) {
  return (
    <Card>
      <h4 className="text-lg font-bold text-gray-900 mb-4">Quick Stats</h4>
      <div className="space-y-4">
        {stats.map((s) => (
          <div key={s.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`${s.iconBg} p-2 rounded-lg`}>
                <i className={`${s.iconClass} ${s.iconColor}`} />
              </div>
              <span className="text-gray-700">{s.label}</span>
            </div>
            <span className={`font-bold text-2xl ${s.valueColor}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
