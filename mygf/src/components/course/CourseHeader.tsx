// mygf/src/components/course/CourseHeader.tsx
import React, { useState } from "react";
import type { CourseData } from "./types";
import VideoPreviewCarousel, { type PreviewSlide } from "./VideoPreviewCarousel";

const DEMO_VIDEO =
  "https://interactive-examples.mdn.mozilla.org/media/cc0-videos/flower.mp4";

const POSTERS = [
  "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1600&auto=format&fit=crop",
];

export default function CourseHeader({ course }: { course: CourseData }) {
  const [active, setActive] = useState(0); // ✅ which level is active via carousel

  // Build one slide per level (same course id)
  const slides: PreviewSlide[] =
    course.levels?.length
      ? course.levels.map((lvl, i) => ({
          poster: POSTERS[i % POSTERS.length],
          video: DEMO_VIDEO,
          label: lvl.title,
        }))
      : [
          { poster: POSTERS[0], video: DEMO_VIDEO, label: "Course Preview" },
        ];

  const activeLevel = course.levels?.[active];

  return (
    <>
      <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            {/* Main course title stays fixed */}
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              {course.title}
            </h1>

            {/* ✅ NEW: per-level subtitle (changes with carousel) */}
            {activeLevel?.title && (
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {activeLevel.title}
              </h2>
            )}

            {/* ✅ Description now follows active level; falls back to course description */}
            <p className="text-gray-600 mb-6 leading-relaxed">
              {activeLevel?.description ?? course.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {course.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center">
                <div className="flex text-yellow-400 mr-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <i
                      key={i}
                      className={
                        "fas fa-star " +
                        (i < Math.round(course.rating)
                          ? "text-yellow-400"
                          : "text-gray-300")
                      }
                    />
                  ))}
                </div>
                <span className="text-gray-600">({course.reviews} reviews)</span>
              </div>
              <div className="flex items-center text-gray-600">
                <i className="fas fa-clock mr-2" />
                <span>{course.duration}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <i className="fas fa-layer-group mr-2" />
                <span>{course.levels.length} Levels</span>
              </div>
            </div>
          </div>

          {/* Right: carousel (same size/feel); reports slide change */}
          <div className="flex items-start md:justify-end">
            <VideoPreviewCarousel
              slides={slides}
              onSlideChange={setActive}   // ✅ updates subtitle & description
            />
          </div>
        </div>
      </div>
    </>
  );
}
