// mygf/src/components/pages/tracks/useCourses.ts
import { useCallback, useEffect, useState } from "react";
import type { Course } from "./types";
import { fetchCourses } from "./api";

export function useCourses() {
  const [data, setData] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCourses();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
