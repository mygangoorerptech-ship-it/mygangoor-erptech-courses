// mygf/src/components/course/CourseDetail.tsx
import { useMemo, useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import NavBar from "../home/NavBar";
import CourseHeader from "./CourseHeader";
import CourseProgress from "./CourseProgress";
import LevelCard from "./LevelCard";
import ReviewsSection from "./ReviewsSection";
import SuccessAnimation from "./SuccessAnimation";
import CertificateModal from "./CertificateModal";
import type { CourseData, Review as ReviewType } from "./types";
import Footer from "../common/Footer";
import { api } from "../../config/api";

type LocationState = { course?: any } | undefined;

export default function CourseDetail() {
  const { courseId } = useParams();
  const location = useLocation() as unknown as { state?: LocationState };

  // fetch one course (with chapters)
  const { data: detail } = useQuery({
    queryKey: ["student:course:detail", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await api.get(`/student-catalog/courses/${courseId}`);
      return data as {
        id: string;
        title: string;
        slug: string | null;
        category: string | null;
        description: string | null;
        duration: string;
        level: string | null;
        cover: string | null;
        tags: string[];
        chapters: Array<{
          title: string;
          description?: string | null;
          coverUrl?: string | null;
          videoUrl?: string | null;
          youtubeUrl?: string | null;
          durationSeconds?: number; // not used (same duration for all)
        }>;
      };
    },
  });

  // "not-started". overallStatus is also returned for non-bundled courses.
  const { data: progress } = useQuery({
    queryKey: ["student:course:progress", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      try {
        const { data } = await api.get(`/student/progress/${courseId}`); 
        return data as { 
          statuses: Array<{ chapterIndex: number; status: string }>; 
          overallStatus: string; 
          certificateUrl?: string | null; // ✅ now provided by backend 
        };
      } catch (e) {
        // If progress cannot be loaded (e.g. permission error), default to no progress
        return { statuses: [], overallStatus: "not-started" } as any;
      }
    },
  });

    // Fetch reviews for this course. This returns an object with
  // { reviews: ReviewType[], ratingAvg: number, ratingCount: number }.
  const { data: reviewsResponse, refetch: refetchReviews } = useQuery({
    queryKey: ["course:reviews", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await api.get(`/courses/${courseId}/reviews`);
      return data as {
        reviews: Array<{ name: string; rating: number; comment: string; date: string }>;
        ratingAvg: number;
        ratingCount: number;
      };
    },
  });

  // Handle submitting a new review. When a review is submitted, post
  // to the backend and refresh the reviews list. We do not update
  // course details here; the rating and count are overridden below
  // using the reviewsResponse.
  const handleSubmitReview = async (r: { name?: string; rating: number; comment: string }) => {
    if (!courseId) return;
    await api.post(`/courses/${courseId}/reviews`, {
      name: r.name,
      rating: r.rating,
      comment: r.comment,
    });
    // Refresh reviews after posting
    refetchReviews();
  };

  const courseData: CourseData & {
    cover?: string | null;
    slug?: string | null;
    category?: string | null;
    level?: string | null;
  } = useMemo(() => {
    if (!detail) {
      const raw = (location?.state as LocationState)?.course;
      return {
        title: raw?.title ?? "Course",
        description: raw?.description ?? "watch this course and get certificate soon",
        duration:
          raw?.duration ??
          (typeof raw?.durationHours === "number" ? `${raw.durationHours} hours` : "—"),
        rating: 0,
        reviews: 0,
        tags: Array.isArray(raw?.tags) ? raw.tags : [],
        levels: [], // fallback handled below
        cover: raw?.cover ?? null,
        slug: raw?.slug ?? null,
        category: raw?.category ?? null,
        level: raw?.level ?? null,
        // ✅ ensure header knows there are no chapters
        chapters: [],
      };
    }

    // same duration for every card → use course duration
    const perCardDuration = detail.duration || "—";

    // chapters -> level cards WITH assignment banner (real chapters)
    const levels = Array.isArray(detail.chapters)
      ? detail.chapters.map((ch) => ({
          title: ch.title,
          description: ch.description || "",
          duration: perCardDuration,     // ✅ same for all cards
          lessons: 0,
          assignment: "Complete this chapter", // ✅ orange banner for real chapters
        }))
      : [];

    return {
      title: detail.title,
      description: detail.description || "watch this course and get certificate soon",
      duration: detail.duration || "—",
      rating: 0,
      reviews: 0,
      tags: Array.isArray(detail.tags) ? detail.tags : [],
      levels,
      cover: detail.cover ?? null,
      slug: detail.slug ?? null,
      category: detail.category ?? null,
      level: detail.level ?? null,
      // ✅ pass through the raw chapters so CourseHeader can build real slides
      chapters: detail.chapters ?? [],
    };
  }, [detail, location?.state]);

    // Override course rating and review count using aggregated values
  // from the reviews API. If no reviews data is loaded yet, fall
  // back to the values from courseData (which default to 0). Use
  // useMemo to avoid unnecessary re-renders.
  const headerCourseData: CourseData = useMemo(() => {
    const ratingAvg = (reviewsResponse && typeof reviewsResponse.ratingAvg === 'number')
      ? reviewsResponse.ratingAvg
      : courseData.rating;
    const ratingCount = (reviewsResponse && typeof reviewsResponse.ratingCount === 'number')
      ? reviewsResponse.ratingCount
      : courseData.reviews;
    return { ...courseData, rating: ratingAvg, reviews: ratingCount };
  }, [courseData, reviewsResponse]);

  // incomplete chapter (or last when all complete).
  const [completedLevels, setCompletedLevels] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  // ✅ Download real certificate (supports data: URLs and http(s) URLs) 
  const handleDownloadCertificate = async () => { 
    const url = (progress as any)?.certificateUrl;
    const pid = (progress as any)?._id; 
    if (!url || typeof url !== "string" || !url.trim()) return; 
 
    const safeTitle = (headerCourseData.title || "certificate") 
      .replace(/[^\w\s-]/g, "") 
      .replace(/\s+/g, "-") 
      .toLowerCase(); 
    const fileName = `${safeTitle}-certificate.pdf`; 
 
    try { 
      if (pid) {
        window.open(`/api/certificates/download/${pid}`, "_blank", "noopener,noreferrer");
        return;
      } else if (url.startsWith("data:")) { 
        // direct data URL → just trigger a download 
        const a = document.createElement("a"); 
        a.href = url; 
        a.download = fileName; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
        return; 
      } 
      // fetch as blob (include cookies for signed routes) 
      const resp = await fetch(url, { credentials: "include" }); 
      if (!resp.ok) throw new Error(`Download failed (${resp.status})`); 
      const blob = await resp.blob(); 
      const objUrl = URL.createObjectURL(blob); 
      const a = document.createElement("a"); 
      a.href = objUrl; 
      a.download = fileName; 
      document.body.appendChild(a); 
      a.click(); 
      a.remove(); 
      URL.revokeObjectURL(objUrl); 
    } catch (err) { 
      console.error("certificate download error:", err); 
      alert("Unable to download certificate right now. Please try again."); 
    } 
  }; 
 
  // ✅ View certificate in a new tab (works for data: and http(s)) 
  const handleViewCertificate = () => { 
    const url = (progress as any)?.certificateUrl;
    const pid = (progress as any)?._id; 
    if (!url || typeof url !== "string" || !url.trim()) return; 
    const pid2 = (progress as any)?._id;
    if (pid2) window.open(`/api/certificates/download/${pid2}`, "_blank", "noopener,noreferrer");
    else window.open(url, "_blank", "noopener,noreferrer"); 
  };

  // fallback when no chapters → single card with “Complete this course”
  const effectiveLevels: typeof courseData.levels = (() => {
    const baseLevels = courseData.levels.length > 0
      ? courseData.levels
      : [
          {
            title: courseData.title,
            description: courseData.description,
            duration: courseData.duration,
            lessons: 0,
            assignment: "Complete this course",
          },
        ];
    // If progress is available, map assignments accordingly
    const n = baseLevels.length;
    const statusesArr: string[] = (() => {
      if (!progress || !Array.isArray(progress.statuses)) {
        return Array.from({ length: n }, () => "not-started");
      }
      // Map status entries by chapterIndex into an array sized n
      const map = new Map<number, string>();
      progress.statuses.forEach((s: any) => {
        const idx = Number(s.chapterIndex);
        map.set(idx, String(s.status || "not-started"));
      });
      return Array.from({ length: n }, (_, i) => map.get(i) || "not-started");
    })();
    // Build new levels array with assignment updated when complete
    return baseLevels.map((lvl, idx) => {
      const stat = statusesArr[idx];
      if (stat === "complete") {
        return { ...lvl, assignment: "Completed" };
      }
      return lvl;
    });
  })();

  // Compute statuses array sized to effectiveLevels length. A missing
  // progress entry defaults to not-started. Memoise to avoid
  // re-computation on each render.
  const statusesArr = useMemo(() => {
    const total = effectiveLevels.length > 0 ? effectiveLevels.length : 1;
    if (!progress || !Array.isArray(progress.statuses)) {
      return Array.from({ length: total }, () => "not-started");
    }
    const map = new Map<number, string>();
    progress.statuses.forEach((s: any) => {
      const idx = Number(s.chapterIndex);
      map.set(idx, String(s.status || "not-started"));
    });
    return Array.from({ length: total }, (_, i) => map.get(i) || "not-started");
  }, [progress, effectiveLevels.length]);

  // Determine if the overall course is complete.  A course is
  // actions.
  const overallStatusLower = (progress?.overallStatus ?? '').toLowerCase();
  const allChaptersComplete = statusesArr.every((s) => s === 'complete');
  const isCourseComplete = overallStatusLower === 'complete' || overallStatusLower === 'completed' || allChaptersComplete;
    const certUrl = useMemo(() => {
    const u = (progress as any)?.certificateUrl;
    return typeof u === "string" && u.trim().length ? u.trim() : null;
  }, [progress]);

  // Utility to produce a human-friendly relative time string from an
  // ISO date. Uses a simple approximation: days, weeks, months, years.
  const formatRelativeDate = (iso?: string): string => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const days = Math.floor(seconds / 86400);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 week ago';
    if (weeks < 5) return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  // Build reviews list from backend response. The ReviewsSection
  // component expects an array of ReviewType items. Map each
  // incoming review to include a relative date string.
  const reviewsData: ReviewType[] = useMemo(() => {
    if (!reviewsResponse || !Array.isArray(reviewsResponse.reviews)) return [];
    return reviewsResponse.reviews.map((r) => ({
      name: r.name || 'Anonymous',
      rating: Number(r.rating) || 0,
      comment: r.comment || '',
      date: formatRelativeDate(r.date),
    }));
  }, [reviewsResponse]);

  useEffect(() => {
    const total = courseData.levels.length > 0 ? courseData.levels.length : 1;
    // Build a status array sized to total. Fall back to not-started.
    const statusesArr: string[] = (() => {
      if (!progress || !Array.isArray(progress.statuses)) {
        return Array.from({ length: total }, () => "not-started");
      }
      const map = new Map<number, string>();
      progress.statuses.forEach((s: any) => {
        const idx = Number(s.chapterIndex);
        map.set(idx, String(s.status || "not-started"));
      });
      return Array.from({ length: total }, (_, i) => map.get(i) || "not-started");
    })();
    const completed = statusesArr.filter((s) => s === "complete").length;
    // currentLevel = first index where status != complete, else last
    let idx = statusesArr.findIndex((s) => s !== "complete");
    if (idx < 0) idx = total - 1;
    setCompletedLevels(completed);
    setCurrentLevel(idx);
  }, [progress, courseData.levels.length]);

  return (
    <>
      <div className="relative z-20">
        <NavBar />
      </div>

      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {courseId && (
            <p className="mb-2 text-xs text-gray-500">
              Course ID: <span className="font-mono">{courseId}</span>
            </p>
          )}

          <CourseHeader course={headerCourseData} />

          {/* progress (container kept intact) */}
          <CourseProgress
            currentLevel={currentLevel}
            totalLevels={effectiveLevels.length || (courseData.levels.length || 1)}
            completedLevels={completedLevels}
          />

          {/* levels */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Course Levels</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
              {effectiveLevels.map((level, index) => {
                const stat = statusesArr[index] || "not-started";
                const isCompleted = stat === "complete";
                const isUnlocked = isCompleted;
                return (
                  <LevelCard
                    key={index}
                    level={level}
                    index={index}
                    isUnlocked={isUnlocked}
                    isCompleted={isCompleted}
                    isCurrent={index === currentLevel}
                    onLevelClick={() => {}}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Current: {effectiveLevels[currentLevel]?.title ?? courseData.title}
            </h3>
            <div className="flex flex-wrap gap-4">

              <button
                disabled
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-medium opacity-60 cursor-not-allowed"
              >
                <i className="fas fa-play mr-2" />
                Start Level
              </button>
              {/* Conditionally render either the completed state or the
                 disabled complete button based on isCourseComplete. */}
              {isCourseComplete ? (
                <>
                  <button
                    disabled
                    className="bg-green-500 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2"
                  >
                    <i className="fas fa-shield-alt animate-bounce" />
                    Completed
                  </button>
                  {/* ✅ Certificate actions */} 
                  {certUrl ? ( 
                    <div className="flex gap-2"> 
                      <button 
                        onClick={handleDownloadCertificate} 
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium flex items-center gap-2" 
                      > 
                        <i className="fas fa-download" /> 
                        Download 
                      </button> 
                      {/* <button 
                        onClick={handleViewCertificate} 
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-medium flex items-center gap-2" 
                      > 
                        <i className="fas fa-eye" /> 
                        View 
                      </button>  */}
                    </div> 
                  ) : ( 
                    // When completed but certificate not yet attached 
                    <button 
                      disabled 
                      className="bg-gray-500 text-white px-6 py-3 rounded-lg font-medium opacity-80 cursor-not-allowed flex items-center gap-2" 
                      title="Your certificate will be available once issued" 
                    > 
                      <i className="fas fa-hourglass-half" /> 
                      Your certificate is being processing 
                    </button> 
                  )}
                </>
              ) : (
                <button
                  disabled
                  className="bg-green-500 text-white px-8 py-3 rounded-lg font-medium opacity-60 cursor-not-allowed flex items-center gap-2"
                >
                  {overallStatusLower === 'in-progress' ? (
                    <>
                      <i className="fas fa-hourglass-half mr-2" />
                      In Progress
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2" />
                      Complete Level
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <ReviewsSection reviews={reviewsData} onSubmitReview={handleSubmitReview} />

          <SuccessAnimation isVisible={showSuccess} />
          <CertificateModal
            isVisible={showCertificate}
            onClose={() => setShowCertificate(false)}
            courseName={courseData.title}
            studentName="John Doe"
          />
        </div>
      </div>

      <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
    </>
  );
}
