//src/components/enrolled/EnrolledCoursesPage.tsx

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import EnrolledCourseCard from "./EnrolledCourseCard";
import EnrolledStats from "./EnrolledStats";
import EnrolledTabs from "./EnrolledTabs";
import EnrolledToolbar from "./EnrolledToolbar";

import StudentSidebar from "../dashboard/StudentSidebar";
import NavBar from "../home/NavBar";
import Footer from "../common/Footer";

import { useCourses } from "../pages/tracks/useCourses";

import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { useEnrollmentStore } from "../../store/enrollmentStore";

import type {
  EnrolledCourse,
  CourseProgressResponse,
} from "./types";

import {
  transformToEnrolledCourse,
} from "./utils";

export default function EnrolledCoursesPage() {
  const [activeTab, setActiveTab] = useState<
    "all" | "progress" | "completed" | "pinned"
  >("all");

  /**
   * Existing production course source
   */
  const {
    data: catalogCourses,
    loading,
  } = useCourses();

  const isAuthenticated = useAuth(
    (s) => !!s.user
  );

  // RF-2: consume the global enrollment store instead of a parallel independent fetch.
  // premiumIds is populated by enrollmentStore.fetchActive() which fires from
  // TracksAndCollectionsSection and App.tsx (RF-3). Replace-semantics (RF-1) ensure
  // revocations are reflected after the next server sync.
  const premiumIds = useEnrollmentStore((s) => s.premiumIds);
  const enrollmentLoading = useEnrollmentStore((s) => s.loading);

  /**
   * Progress map
   */
  const [progressMap, setProgressMap] = useState<
    Record<string, CourseProgressResponse | null>
  >({});

  /**
   * Fetch progress for all visible courses
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    if (!catalogCourses?.length) return;

    let cancelled = false;

    async function loadProgress() {
      try {
        const results = await Promise.all(
          catalogCourses.map(async (course: any) => {
            const courseId =
              course.id ||
              course._id;

            try {
              const { data } = await api.get(
                `/student/progress/${courseId}`
              );

              return {
                id: courseId,
                progress: data,
              };
            } catch {
              return {
                id: courseId,
                progress: null,
              };
            }
          })
        );

        if (cancelled) return;

        const map: Record<
          string,
          CourseProgressResponse | null
        > = {};

        for (const item of results) {
          map[item.id] = item.progress;
        }

        setProgressMap(map);
      } catch {
        // silent fail
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [catalogCourses, isAuthenticated]);

  /**
   * Transform existing course shape
   * into enrolled UI model
   */
  const enrolledCourses: EnrolledCourse[] =
    useMemo(() => {
      return (catalogCourses || [])
        .filter((course: any) => {
          const courseId =
            course.id ||
            course._id;

          /**
           * Robust price handling — treat missing/null/zero as free
           */
          const pricePaise = Number(
            course.pricePaise ??
            course.mrpPaise ??
            0
          );

          const isFree =
            !Number.isFinite(pricePaise) ||
            pricePaise <= 0;

          // RF-2: use global premiumIds (Set) instead of local array.
          // .has() is O(1) vs .includes() O(n); also avoids stale independent fetch.
          const isEnrolled = premiumIds.has(String(courseId));

          return (
            isFree ||
            isEnrolled
          );
        })
        .map((course: any) => {
          const courseId =
            course.id ||
            course._id;

          const progress =
            progressMap[courseId];

          return transformToEnrolledCourse(
            {
              id: courseId,

              title: course.title,

              slug: course.track ?? null,

              category:
                course.pill ?? null,

              duration: `${Math.round(
                Number(
                  course.durationHours || 0
                )
              )}h`,

              level: course.level,

              cover:
                course.cover ?? null,

              tags: course.tags ?? [],

              chapters: [],
            },
            progress
          );
        }
        );
    }, [catalogCourses, progressMap, premiumIds]);

  /**
   * UI filters
   */
  const filteredCourses = useMemo(() => {
    let data: EnrolledCourse[] = [
      ...enrolledCourses,
    ];

    if (activeTab === "progress") {
      data = data.filter(
        (course) =>
          course.progress > 0 &&
          course.progress < 100
      );
    }

    if (activeTab === "completed") {
      data = data.filter(
        (course) => course.completed
      );
    }

    if (activeTab === "pinned") {
      data = data.slice(0, 2);
    }

    return data;
  }, [activeTab, enrolledCourses]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* NAVBAR */}
      <div className="fixed left-0 top-0 z-50 w-full">
        <NavBar />
      </div>

      {/* LAYOUT */}
      <div className="flex pt-16 sm:pt-20">
        {/* SIDEBAR */}
        <StudentSidebar />

        {/* CONTENT */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            {/* HEADER */}
            {/* AUTH WARNING */}
            {!isAuthenticated && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-rose-700">
                      Login Required
                    </h3>

                    <p className="mt-1 text-sm text-rose-600">
                      Please login to access your enrolled courses and learning progress.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              {/* LEFT */}
              <div>
                <h1 className="text-3xl font-black tracking-tight text-black sm:text-4xl">
                  Enrolled Courses
                </h1>

                <p className="mt-3 text-sm text-black sm:text-base xl:text-lg">
                  Continue your learning
                  journey. Pick up where
                  you left off.
                </p>
              </div>

              {/* RIGHT */}
              <div className="w-full xl:max-w-2xl">
                <EnrolledToolbar />
              </div>
            </div>

            {/* STATS */}
            <div className="mt-8">
              <EnrolledStats
                totalCourses={
                  enrolledCourses.length
                }
                completedCourses={
                  enrolledCourses.filter(
                    (c) => c.completed
                  ).length
                }
                inProgressCourses={
                  enrolledCourses.filter(
                    (c) =>
                      c.progress > 0 &&
                      c.progress < 100
                  ).length
                }
              />
            </div>

            {/* TABS */}
            <div className="mt-10">
              <EnrolledTabs
                active={activeTab}
                setActive={setActiveTab}
                counts={{
                  all:
                    enrolledCourses.length,
                  inProgress:
                    enrolledCourses.filter(
                      (c) =>
                        c.progress > 0 &&
                        c.progress < 100
                    ).length,
                  completed:
                    enrolledCourses.filter(
                      (c) => c.completed
                    ).length,
                }}
              />
            </div>

            {/* LOADING — catalog fetch OR first-load enrollment sync */}
            {(loading || (enrollmentLoading && premiumIds.size === 0)) && (
              <div className="mt-20 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            )}

            {/* GRID */}
            {!loading &&
              !(enrollmentLoading && premiumIds.size === 0) &&
              filteredCourses.length >
              0 && (
                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredCourses.map(
                    (course) => (
                      <EnrolledCourseCard
                        key={course.id}
                        course={course}
                      />
                    )
                  )}
                </div>
              )}

            {/* EMPTY */}
            {!loading &&
              filteredCourses.length ===
              0 && (
                <div className="mt-20 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 text-black"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={
                        1.5
                      }
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6l4 2"
                      />
                    </svg>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-black">
                    No Courses Found
                  </h3>

                  <p className="mt-2 max-w-md text-sm text-black">
                    No enrolled courses
                    are available in this
                    category right now.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}