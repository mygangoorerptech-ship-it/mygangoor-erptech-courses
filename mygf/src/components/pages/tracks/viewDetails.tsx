// mygf/src/components/pages/tracks/viewDetails.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import { formatINRFromPaise } from "../../../admin/utils/currency";
import { useNavigate } from "react-router-dom";

type ViewDetailsProps = {
  open: boolean;
  courseId?: string | null;
  onClose: () => void;
  onRequireEnroll?: () => void;
};

type Chapter = {
  title?: string;
  subtitle?: string;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  durationSeconds?: number;
  order?: number;
  assignments?: Array<{ title?: string; link?: string }>;
};

type CourseDetail = {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  level?: "all" | "beginner" | "intermediate" | "advanced" | string;
  price?: number; // paise (detail may not send this)
  discountPercent?: number;
  isBundled?: boolean;
  bundleCoverUrl?: string;
  duration?: string | number;
  durationText?: string;
  cover?: string | null;
  chapters?: Chapter[];
  tags?: string[];
  skills?: string[];
  rating?: number;
  ratingAvg?: number;
  ratingCount?: number;
  ownerName?: string;
  teacherId?: string;
  teacherName?: string;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const fmtDuration = (secs?: number) => {
  if (!secs || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
};

export default function ViewDetails({ open, courseId, onClose, onRequireEnroll }: ViewDetailsProps) {
  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();

  // tunnel-scroll refs/state
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  // ===== Read more/less (animated clamp) =====
  const CLAMP_CHAR_THRESHOLD = 150;
  const COLLAPSED_MAX_PX = 160;
  const [descExpanded, setDescExpanded] = useState(false);
  const [descMax, setDescMax] = useState<number>(COLLAPSED_MAX_PX);
  const descWrapRef = useRef<HTMLDivElement | null>(null);
  const descContentRef = useRef<HTMLDivElement | null>(null);

  // ===== Pricing / premium (same logic as Tracks page) =====
  const [pricePaise, setPricePaise] = useState<number | undefined>(undefined);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);

  const hasPrice = typeof pricePaise === "number";
  const isFree = hasPrice ? (pricePaise! <= 0) : false; // only if we know the price
  const accessible = isEnrolled || isFree;

  const salePaise =
    hasPrice
      ? (discountPercent > 0
          ? Math.max(0, Math.round(pricePaise! * (1 - discountPercent / 100)))
          : pricePaise!)
      : undefined;

  // inject no-scrollbar helper once
  useEffect(() => {
    const id = "vd-no-scrollbar-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `;
      document.head.appendChild(style);
    }
  }, []);

  const updateFades = () => {
    const el = bodyRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    setAtTop(scrollTop <= 2);
    setAtBottom(scrollTop + clientHeight >= scrollHeight - 2);
  };

  // lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // esc + arrows
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, idx, onClose]);

  // Load detail + enrollment + price (mirror Tracks page)
  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;

    setLoading(true);
    setIdx(0);
    setIsEnrolled(false);
    setPricePaise(undefined);
    setDiscountPercent(0);

    (async () => {
      try {
        // 1) Course detail
        const [detailRes, enrollRes, listRes] = await Promise.all([
          api.get(`/student-catalog/courses/${courseId}`),
          api.get("/student/enrollments/active", { withCredentials: true }).catch(() => null),
          api.get("/student-catalog/courses").catch(() => null), // contains price & discountPercent
        ]);

        if (cancelled) return;

        const payload: CourseDetail = detailRes?.data || {};
        setData(payload || null);

        // 2) Active enrollment check (same as Tracks)
        let enrolled = false;
        const items: any[] = Array.isArray(enrollRes?.data?.items) ? enrollRes!.data.items : [];
        for (const e of items) {
          const id = String(e.courseId || e.course?.id || "");
          if (id !== String(courseId)) continue;
          const isPremium =
            e.premium === true ||
            e.status === "premium" ||
            e.status === "paid" ||
            e.paymentStatus === "paid" ||
            e.access === "premium" ||
            !!e.paidAt;
          if (isPremium) { enrolled = true; break; }
        }
        setIsEnrolled(enrolled);

        // 3) Price/discount (only from list endpoint; do NOT assume free if missing)
        const arr = Array.isArray(listRes?.data) ? listRes!.data : [];
        const found = arr.find((c: any) => String(c.id) === String(courseId));
        if (found) {
          if (typeof found.price === "number") setPricePaise(found.price);
          if (Number.isFinite(found.discountPercent)) setDiscountPercent(Number(found.discountPercent));
        }
      } catch {
        // fall through
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, courseId]);

  // recalc fades when content changes or modal opens
  useEffect(() => { updateFades(); }, [open, data, idx, loading]);

  const chapters: Chapter[] = useMemo(
    () => (Array.isArray(data?.chapters) ? [...data!.chapters].sort((a,b) => (a.order ?? 0) - (b.order ?? 0)) : []),
    [data]
  );
  const hasChapters = chapters.length > 0;
  const current = hasChapters ? chapters[idx] : undefined;

  // hero chips
  const rating =
    typeof (data as any)?.rating === "number"
      ? (data as any).rating
      : typeof (data as any)?.ratingAvg === "number"
      ? (data as any).ratingAvg
      : undefined;

  const level = data?.level ?? "—";
  const category = data?.category ?? "Course";

  // duration / lessons (course-level)
  const totalDurationSeconds = hasChapters
    ? chapters.reduce((sum, c) => sum + (c.durationSeconds || 0), 0)
    : 0;

  const courseDuration =
    (data?.duration != null && String(data.duration)) ||
    (data?.durationText != null && String(data.durationText)) ||
    (hasChapters ? fmtDuration(totalDurationSeconds) : "—");

  const lessonsCount = hasChapters ? chapters.length : undefined;

  const curatedSkills = useMemo<string[]>(
    () => (data?.skills?.length ? data.skills : (data?.tags || [])).slice(0, 8),
    [data]
  );

  const overviewText =
    (hasChapters && (current?.description || current?.subtitle || current?.title)) ||
    data?.description ||
    "";

  function prev() { if (hasChapters) setIdx((p) => (p - 1 + chapters.length) % chapters.length); }
  function next() { if (hasChapters) setIdx((p) => (p + 1) % chapters.length); }
  function goto(i: number) { if (hasChapters && i >= 0 && i < chapters.length) setIdx(i); }

  // Instructor: vendor/owner acts as teacher; fallback "Unknown"
  const instructorDisplay = (data?.ownerName || (data as any)?.teacherName || "Unknown").trim();
  const instructorInitials = instructorDisplay.slice(0, 2).toUpperCase() || "UN";

  // ===== Clamp recalculation logic =====
  const isLongDescription = (overviewText?.trim()?.length || 0) > CLAMP_CHAR_THRESHOLD;

  const recalcDescMax = () => {
    const wrap = descWrapRef.current;
    const content = descContentRef.current;
    if (!wrap || !content) return;
    const full = content.scrollHeight;
    const target = descExpanded ? full + 4 : Math.min(full, COLLAPSED_MAX_PX);
    setDescMax(target);
  };

  useEffect(() => {
    setDescExpanded(false);
    const raf = requestAnimationFrame(() => recalcDescMax());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, data?.id, open]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => recalcDescMax());
    const onResize = () => recalcDescMax();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewText, descExpanded]);

  const toggleDesc = () => {
    setDescExpanded((v) => !v);
    setTimeout(() => updateFades(), 320);
  };

  if (!open) return null;

  // Reusable CTA (same design language as cards)
  const SidebarEnrollCard = () => (
    <div className="rounded-2xl p-6 text-white bg-gradient-to-r from-blue-600 to-blue-700">
      {accessible ? (
        <>
          <div className="flex items-center justify-center gap-2 text-center mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-xs font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              This course is Premium
            </span>
          </div>
          <p className="text-center text-sm text-blue-100">Included in your plan</p>
        </>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              {discountPercent > 0 && (
                <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-bold leading-4 text-rose-700">
                  {discountPercent}% OFF
                </span>
              )}
            </div>
            <div className="text-3xl font-bold mb-0.5">
              {typeof salePaise === "number" ? formatINRFromPaise(salePaise) : "—"}
            </div>
            {discountPercent > 0 && hasPrice && (
              <div className="text-sm text-blue-100 line-through">
                {formatINRFromPaise(pricePaise!)}
              </div>
            )}
          </div>
<button
  className="w-full bg-white text-blue-700 font-semibold py-3 px-6 rounded-xl hover:bg-blue-50 transition-colors"
  onClick={handleEnrollClick}
>
  Enroll Now
</button>
          <p className="text-center text-xs text-blue-100 mt-3">30-day money-back guarantee</p>
        </>
      )}
    </div>
  );

  // Compact inline CTA for the right side of the Curriculum header (desktop)
  const InlineEnrollCTA = () => (
    <div className="hidden md:flex items-center gap-3">
      {accessible ? (
        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Premium
        </span>
      ) : (
        <>
          {discountPercent > 0 && (
            <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-bold leading-4 text-rose-700">
              {discountPercent}% OFF
            </span>
          )}
          <span className="text-lg font-extrabold text-slate-900 bg-white px-1.5 py-0.5 rounded">
            {typeof salePaise === "number" ? formatINRFromPaise(salePaise) : "—"}
          </span>
          {discountPercent > 0 && hasPrice && (
            <span className="text-sm text-slate-400 line-through">
              {formatINRFromPaise(pricePaise!)}
            </span>
          )}
<button
  className="ml-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
  onClick={handleEnrollClick}
>
  Enroll Now
</button>
        </>
      )}
    </div>
  );

  // inside component
  const handleEnrollClick = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const id = String(data?.id || courseId || "");
    if (!id) return;

    if (accessible) {
      // same as card: go straight to course when accessible
      navigate(`/course/${id}`);
    } else {
      // same as card: delegate to parent to open JoinNowModal
      onRequireEnroll?.();
    }
  };


  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* under navbar + tiny bottom breathing room */}
      <div
        className="flex items-start justify-center min-h-screen px-4 pt-20 pb-3 md:pt-24"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="
            relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden modal-content
            flex flex-col
            h-[calc(100vh-5rem-0.75rem)] md:h-[calc(100vh-6rem-0.75rem)]
          "
        >
          {/* ======= TOP HERO (unchanged) ======= */}
          <div className="relative h-64 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-white/90 hover:bg-white/20 rounded-full p-2 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center text-white">
              <svg className="w-24 h-24 mx-auto mb-4 opacity-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>

              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">{category}</span>
                <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">{level}</span>
              </div>

              <h2 className="text-3xl font-bold mb-1">{data?.title || "Course"}</h2>
              <p className="text-blue-100">{data?.subtitle || ""}</p>

              {typeof rating === "number" ? (
                <div className="absolute top-6 left-6 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                  ⭐ {rating.toFixed(1)}
                </div>
              ) : null}
            </div>
          </div>

          {/* ======= BODY (tunnel scroll) ======= */}
          <div
            ref={bodyRef}
            onScroll={updateFades}
            className="relative p-8 overflow-y-auto no-scrollbar flex-1 min-h-0"
          >
            <div className="grid grid-cols-12 gap-8">
              {/* Main (8 cols) */}
              <div className="col-span-12 md:col-span-8 space-y-6">
                {/* Media banner */}
                <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                  {(hasChapters && current?.coverUrl) || data?.bundleCoverUrl || data?.cover ? (
                    <img
                      src={(hasChapters ? current?.coverUrl : (data?.bundleCoverUrl || data?.cover)) as string}
                      alt={(hasChapters ? current?.title : data?.title) || "Course cover"}
                      className="w-full h-48 md:h-56 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-48 md:h-56 w-full animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" />
                  )}

                  {/* Chapter arrows */}
                  {hasChapters && (
                    <>
                      <button
                        onClick={prev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full p-2 shadow-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        aria-label="Previous chapter"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full p-2 shadow-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        aria-label="Next chapter"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Overview / Active Chapter */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {hasChapters ? `Chapter ${idx + 1}${current?.title ? `: ${current.title}` : ""}` : "Course Overview"}
                  </h3>

                  {overviewText ? (
                    <div className="mb-4">
                      <div
                        id="course-desc"
                        ref={descWrapRef}
                        className={classNames(
                          "relative transition-[max-height] duration-300 ease-in-out will-change-[max-height]",
                          descExpanded ? "overflow-visible" : "overflow-hidden"
                        )}
                        style={{ maxHeight: isLongDescription ? `${descMax}px` : "none" }}
                        aria-expanded={descExpanded}
                      >
                        <div ref={descContentRef} className="text-gray-600 leading-relaxed whitespace-pre-line">
                          {overviewText}
                        </div>
                        {!descExpanded && isLongDescription && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
                        )}
                      </div>

                      {isLongDescription && (
                        <button
                          onClick={toggleDesc}
                          className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1"
                          aria-controls="course-desc"
                        >
                          {descExpanded ? "Read less" : "Read more"}
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            {descExpanded ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 15l-6-6-6 6" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                            )}
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 leading-relaxed mb-4 italic">Description coming soon…</p>
                  )}
                </div>

                {/* Curriculum header + inline CTA (right side) */}
                {hasChapters ? (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-xl font-bold text-gray-900">Course Curriculum</h3>
                      <InlineEnrollCTA />
                    </div>
                    <div className="space-y-3">
                      {chapters.map((ch, i) => (
                        <button
                          key={`${ch.title}-${i}`}
                          onClick={() => goto(i)}
                          className={classNames(
                            "w-full text-left border rounded-xl p-4 hover:bg-gray-50 transition-colors",
                            i === idx ? "border-blue-300 bg-blue-50" : "border-gray-200"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                              {ch.coverUrl ? (
                                <img src={ch.coverUrl} alt={ch.title || `Chapter ${i+1}`} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">
                                  {i + 1}. {ch.title || "Chapter"}
                                </h4>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <p className="text-sm text-gray-600">
                                {category || "Course"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Sidebar (4 cols) */}
              <div className="col-span-12 md:col-span-4 space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Course Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold">{courseDuration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Lessons</span>
                      <span className="font-semibold">{lessonsCount != null ? `${lessonsCount}` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Level</span>
                      <span className="font-semibold">{level}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Certificate</span>
                      <span className="font-semibold">Available</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Skills You'll Gain</h3>
                  {curatedSkills.length ? (
                    <div className="flex flex-wrap gap-2">
                      {curatedSkills.map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-sm font-medium text-gray-700"
                          style={{ background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">To be updated…</p>
                  )}
                </div>

                {/* Instructor */}
                <div className="bg-blue-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Your Instructor</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {instructorInitials}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{instructorDisplay}</h4>
                      <p className="text-sm text-gray-600">Instructor</p>
                    </div>
                  </div>
                </div>

                {/* Pricing / Enroll (Premium vs Enroll Now) */}
                <SidebarEnrollCard />
              </div>
            </div>

            {hasChapters ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                {chapters.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goto(i)}
                    className={classNames("h-2 rounded-full transition-all", i === idx ? "bg-blue-600 w-6" : "bg-gray-300 w-2 hover:bg-gray-400")}
                    aria-label={`Go to chapter ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}

            {loading ? (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 10 }}>
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : null}

            {/* fade masks for tunnel scroll */}
            <div
              className={classNames(
                "pointer-events-none absolute left-0 right-0 top-0 h-6 bg-gradient-to-b from-white to-transparent transition-opacity duration-200",
                atTop ? "opacity-0" : "opacity-100"
              )}
              style={{ zIndex: 5 }}
            />
            <div
              className={classNames(
                "pointer-events-none absolute left-0 right-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent transition-opacity duration-200",
                atBottom ? "opacity-0" : "opacity-100"
              )}
              style={{ zIndex: 5 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
