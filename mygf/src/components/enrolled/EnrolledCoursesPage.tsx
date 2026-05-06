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

  const [activeEnrollmentIds, setActiveEnrollmentIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveEnrollmentIds([]);
      return;
    }
    let cancelled = false;

    async function loadEnrollments() {
      try {
        const { data } = await api.get(
          "/student/enrollments/active"
        );

        if (cancelled) return;

        /**
         * Normalize ids safely
         */
        const ids = Array.isArray(data)
          ? data
            .map((item: any) => {
              if (
                typeof item === "string"
              ) {
                return item;
              }

              return (
                item.courseId ||
                item.course?._id ||
                item.course?.id ||
                item._id
              );
            })
            .filter(Boolean)
          : [];

        setActiveEnrollmentIds(ids);
      } catch {
        setActiveEnrollmentIds([]);
      }
    }

    loadEnrollments();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /**
   * Transform existing course shape
   * into enrolled UI model
   */
  const enrolledCourses: EnrolledCourse[] =
    useMemo(() => {
      console.log("catalogCourses", catalogCourses);
      console.log(
        "activeEnrollmentIds",
        activeEnrollmentIds
      );
      return (catalogCourses || [])
        .filter((course: any) => {
          // Robust price handling
          // Treat missing, null, non-numeric, and zero price as free
          const courseId =
            course.id ||
            course._id;

          /**
           * Robust price handling
           */
          const pricePaise = Number(
            course.pricePaise ??
            course.mrpPaise ??
            0
          );

          const isFree =
            !Number.isFinite(pricePaise) ||
            pricePaise <= 0;

          /**
           * Purchased / assigned
           */
          const isEnrolled =
            activeEnrollmentIds.includes(
              courseId
            );

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
    }, [catalogCourses, progressMap, activeEnrollmentIds]);

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
                <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  Enrolled Courses
                </h1>

                <p className="mt-3 text-sm text-slate-500 sm:text-base xl:text-lg">
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

            {/* LOADING */}
            {loading && (
              <div className="mt-20 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            )}

            {/* GRID */}
            {!loading &&
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
                      className="h-10 w-10 text-slate-400"
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

                  <h3 className="mt-5 text-xl font-bold text-slate-900">
                    No Courses Found
                  </h3>

                  <p className="mt-2 max-w-md text-sm text-slate-500">
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