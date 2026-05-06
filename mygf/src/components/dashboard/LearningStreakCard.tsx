// mygf/src/components/dashboard/LearningStreakCard.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import { api } from "../../api/client";
import { useAuth } from "../../admin/auth/store";

// Helper: normalise date string -> Date or null
function safeDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Helper: midnight truncation in local time
function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Compute whole-day diff, clamped to >= 0
function diffDaysSince(dateLike: Date | null): number {
  if (!dateLike) return 0;
  const today = startOfDayLocal(new Date());
  const base = startOfDayLocal(dateLike);
  const ms = today.getTime() - base.getTime();
  const days = Math.floor(ms / 86400000);
  return days < 0 ? 0 : days;
}

type Props = {
  /** optional, keeps compatibility with your old card’s message prop */
  message?: string;
  /** optional: if you were passing these before, they won’t change the restored design */
  iconClass?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
  label?: string;
};

export default function LearningStreakCard({
  message = "Keep it up! You're on fire! 🔥",
  label = "Learning Streak",
}: Props) {
  const { user: storeUser } = useAuth();
  const [days, setDays] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveBaseDate(): Promise<Date | null> {
      // 1) Try auth store first (fast path)
      const fromStore =
        safeDate((storeUser as any)?.verifiedAt) ||
        safeDate((storeUser as any)?.emailVerifiedAt) ||
        safeDate((storeUser as any)?.registeredAt) ||
        safeDate((storeUser as any)?.registrationDate) ||
        safeDate((storeUser as any)?.createdAt);
      if (fromStore) return fromStore;

      // 2) Try /auth/me
      try {
        const r = await api.get("/auth/me");
        const me = r?.data || {};
        const fromMe =
          safeDate(me.verifiedAt) ||
          safeDate(me.emailVerifiedAt) ||
          safeDate(me.registeredAt) ||
          safeDate(me.registrationDate) ||
          safeDate(me.createdAt);
        if (fromMe) return fromMe;
      } catch {
        // ignore, fall through
      }

      // 3) Fallback: earliest enrollment.createdAt
      try {
        const enr = await api.get("/student/enrollments/active");
        const list = Array.isArray(enr?.data) ? enr.data : (enr?.data?.items || []);
        if (Array.isArray(list) && list.length) {
          const earliest = list
            .map((e: any) => safeDate(e?.createdAt))
            .filter(Boolean)
            .sort((a: any, b: any) => a.getTime() - b.getTime())[0];
          if (earliest) return earliest as Date;
        }
      } catch {
        // ignore
      }

      return null;
    }

    (async () => {
      try {
        const base = await resolveBaseDate();
        const count = diffDaysSince(base);
        if (!cancelled) setDays(count);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeUser]);

  const display = useMemo(() => (loaded ? String(days || 0) : "0"), [days, loaded]);
  const showEmoji = loaded && days === 0;

  // === Restored OLD DESIGN (centered, gradient circle, same typography) ===
return (
  <Card>
    {/* HEADER */}
    <h4 className="text-sm font-semibold text-gray-900 mb-4">
      {label}
    </h4>

    {/* CONTENT */}
    <div className="flex items-center justify-between">
      
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-100">
          {showEmoji ? (
            <span className="text-lg leading-none" role="img" aria-label="smile">
              😊
            </span>
          ) : (
            <i className="fas fa-fire text-gray-500 text-sm" />
          )}
        </div>

        <div>
          <p className="text-lg font-semibold text-gray-900">
            {display}
          </p>
          <p className="text-xs text-gray-500">
            Days in a row
          </p>
        </div>
      </div>

      {/* RIGHT (OPTIONAL MESSAGE) */}
      <div className="hidden sm:block text-right">
        <p className="text-xs text-gray-500 max-w-[140px]">
          {message}
        </p>
      </div>

    </div>
  </Card>
);
}
