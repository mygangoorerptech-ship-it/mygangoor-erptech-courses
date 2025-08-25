// mygf/src/components/course/CourseDetail.tsx
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import NavBar from "../home/NavBar";
import CourseHeader from "./CourseHeader";
import CourseProgress from "./CourseProgress";
import LevelCard from "./LevelCard";
import ReviewsSection from "./ReviewsSection";
import SuccessAnimation from "./SuccessAnimation";
import CertificateModal from "./CertificateModal";
import type { CourseData, Review as ReviewType } from "./types";
import Footer from "../common/Footer";

type LocationState = { course?: any } | undefined;

export default function CourseDetail() {
  const { courseId } = useParams();
  const location = useLocation() as unknown as { state?: LocationState };

  // --- Demo fallback kept intact ---
  const demoCourse: CourseData = useMemo(
    () => ({
      title: "Advanced React Development",
      description:
        "Master advanced React concepts including hooks, context, performance optimization, and modern development patterns. Build production-ready applications with confidence.",
      duration: "12 weeks",
      rating: 4.8,
      reviews: 1247,
      tags: ["React", "JavaScript", "Frontend", "Advanced"],
      levels: [
        {
          title: "React Fundamentals Review",
          description: "Quick review of React basics and setup for advanced concepts",
          duration: "2 hours",
          lessons: 8,
          assignment: "Build a simple todo app",
        },
        {
          title: "Advanced Hooks & State Management",
          description:
            "Deep dive into useEffect, useCallback, useMemo, and custom hooks",
          duration: "3 hours",
          lessons: 12,
          assignment: "Create a custom hook library",
        },
        {
          title: "Performance Optimization",
          description:
            "Learn React.memo, lazy loading, and performance best practices",
          duration: "2.5 hours",
          lessons: 10,
          assignment: "Optimize a slow React application",
        },
        {
          title: "Advanced Patterns & Architecture",
          description:
            "Compound components, render props, and architectural patterns",
          duration: "4 hours",
          lessons: 15,
          assignment: "Build a reusable component library",
        },
      ],
    }),
    []
  );

  // --- Normalize incoming course (from Tracks card) to CourseData shape ---
  const raw = (location?.state as LocationState)?.course;

  const normalizedCourse: CourseData = useMemo(() => {
    // If a full CourseData with levels was passed, use it directly
    if (raw && Array.isArray(raw.levels) && raw.levels.length > 0) {
      return raw as CourseData;
    }

    // If a card-like course was passed, hydrate it with demo levels so UI never breaks
    if (raw) {
      return {
        title: raw.title ?? demoCourse.title,
        description: raw.description ?? demoCourse.description,
        duration:
          raw.duration ??
          (typeof raw.durationHours === "number" ? `${raw.durationHours} hours` : demoCourse.duration),
        rating:
          typeof raw.rating === "number" ? raw.rating : demoCourse.rating,
        reviews:
          typeof raw.ratingCount === "number" ? raw.ratingCount : demoCourse.reviews,
        tags: Array.isArray(raw.tags) ? raw.tags : demoCourse.tags,
        levels: demoCourse.levels, // fallback so .levels is always safe
      };
    }

    // Nothing passed via state — use demo for now (or fetch by courseId later)
    return demoCourse;
  }, [raw, demoCourse]);

  const [courseData] = useState<CourseData>(normalizedCourse);

  const [completedLevels, setCompletedLevels] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const reviewsData: ReviewType[] = [
    {
      name: "Sarah Johnson",
      rating: 5,
      date: "2 weeks ago",
      comment:
        "Excellent course! The instructor explains complex concepts in a very understandable way. The hands-on projects really helped solidify my understanding.",
    },
    {
      name: "Mike Chen",
      rating: 4,
      date: "1 month ago",
      comment:
        "Great content and well-structured lessons. I particularly enjoyed the performance optimization section. Highly recommended for intermediate React developers.",
    },
    {
      name: "Emily Rodriguez",
      rating: 5,
      date: "3 weeks ago",
      comment:
        "This course took my React skills to the next level. The assignments are challenging but rewarding. The certificate looks great on my LinkedIn profile!",
    },
  ];

  const handleLevelClick = (levelIndex: number) => {
    if (levelIndex <= completedLevels) {
      setCurrentLevel(levelIndex);
    }
  };

  const completeLevel = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      if (currentLevel === completedLevels) {
        setCompletedLevels((prev) => prev + 1);
        if (currentLevel + 1 < courseData.levels.length) {
          setCurrentLevel((prev) => prev + 1);
        } else {
          setShowCertificate(true);
        }
      }
    }, 2000);
  };

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

        {/* Header */}
        <CourseHeader course={courseData} />

        {/* Progress */}
        <CourseProgress
          currentLevel={currentLevel}
          totalLevels={courseData.levels.length}
          completedLevels={completedLevels}
        />

        {/* Levels */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Course Levels</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
            {courseData.levels.map((level, index) => (
              <LevelCard
                key={index}
                level={level}
                index={index}
                isUnlocked={index <= completedLevels}
                isCompleted={index < completedLevels}
                isCurrent={index === currentLevel}
                onLevelClick={handleLevelClick}
              />
            ))}
          </div>
        </div>

        {/* Current Level Action */}
        {currentLevel < courseData.levels.length && (
          <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Current: {courseData.levels[currentLevel].title}
            </h3>
            <div className="flex gap-4">
              <button
                onClick={completeLevel}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                <i className="fas fa-play mr-2" />
                {currentLevel < completedLevels ? "Review Level" : "Start Level"}
              </button>
              {currentLevel === completedLevels && (
                <button
                  onClick={completeLevel}
                  className="bg-green-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-600 transition-all"
                >
                  <i className="fas fa-check mr-2" />
                  Complete Level
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reviews */}
        <ReviewsSection reviews={reviewsData} />

        {/* Overlays */}
        <SuccessAnimation isVisible={showSuccess} />
        <CertificateModal
          isVisible={showCertificate}
          onClose={() => setShowCertificate(false)}
          courseName={courseData.title}
          studentName="John Doe"
        />
      </div>
    </div>
          {/* Footer at the end */}
      <Footer
        brandName="MithunKumar"
        tagline="Learn smarter. Build faster."
 
      />
        </>
  );
}
