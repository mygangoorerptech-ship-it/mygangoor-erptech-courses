// src/components/pages/tracks/usePremiumAccess.ts
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { useAuth } from "../../../auth/store";

type ActiveEnrollment = {
  course?: { id?: string };
  courseId?: string;
  premium?: boolean;
  status?: string; // 'paid' | 'premium' | ...
  paymentStatus?: string; // 'paid'
  access?: string; // 'premium'
  paidAt?: string | null;
};

export function usePremiumAccess(courses?: { id: string; pricePaise?: number | null }[]) {
  const { user } = useAuth();
  const [enrs, setEnrs] = useState<ActiveEnrollment[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // treat 0 or undefined paise as "free"
  const freeSet = useMemo(() => {
    const s = new Set<string>();
    (courses ?? []).forEach((c) => {
      const p = c?.pricePaise ?? 0;
      if (!p || p <= 0) s.add(c.id);
    });
    return s;
  }, [courses]);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        setLoading(true);
        const r = await api.get("/student/enrollments/active", { withCredentials: true });
        if (!done) setEnrs(Array.isArray(r?.data?.items) ? r.data.items : []);
      } catch {
        if (!done) setEnrs([]);
      } finally {
        if (!done) setLoading(false);
      }
    })();
    return () => { done = true; };
  }, [user?.id]);

  const premiumIds = useMemo(() => {
    const s = new Set<string>(freeSet);
    (enrs ?? []).forEach((e) => {
      const id = e.courseId || e.course?.id;
      const isPremium =
        e.premium === true ||
        e.status === "premium" ||
        e.status === "paid" ||
        e.paymentStatus === "paid" ||
        e.access === "premium" ||
        !!e.paidAt;
      if (id && isPremium) s.add(String(id));
    });
    return s;
  }, [enrs, freeSet]);

  const isPremium = (courseId: string) => premiumIds.has(String(courseId));

  return { isPremium, loading };
}
