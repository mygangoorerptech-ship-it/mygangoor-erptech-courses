// mygf/src/components/course/CourseHeader.tsx
import { useState } from "react";
import type { CourseData } from "./types";
import VideoPreviewCarousel, { type PreviewSlide } from "./VideoPreviewCarousel";

// Posters remain as safe fallbacks for missing images
const POSTERS = [
  "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1600&auto=format&fit=crop",
];

export default function CourseHeader({ course }: { course: CourseData }) {
  const [active, setActive] = useState(0); // which level is active via carousel
  const c: any = course as any;

  // prefer raw chapters (with media) if present; otherwise rely on levels
  const rawChapters: any[] = Array.isArray(c.chapters) ? c.chapters : [];

  const bundleCover =
    c.cover || c.bundleCoverUrl || c.coverUrl || POSTERS[0];

  // Build slides from *chapters* (media-aware). If none, try to use levels (no media) then fall back to a single bundle cover slide.
  const slides: PreviewSlide[] =
    rawChapters.length > 0
      ? rawChapters.map((ch, i) => ({
          poster: ch.coverUrl || bundleCover || POSTERS[i % POSTERS.length],
          video: ch.videoUrl || ch.youtubeUrl || null, // ▶️ only if available
          label: ch.title,
        }))
      : (Array.isArray(c.levels) && c.levels.length > 0
          ? c.levels.map((lvl: any, i: number) => ({
              // levels usually don't have media; fall back per-slide to bundle cover/POSTERS
              poster: lvl.coverUrl || bundleCover || POSTERS[i % POSTERS.length],
              video:  lvl.videoUrl || lvl.youtubeUrl || null,
              label:  lvl.title,
            }))
          : [{ poster: bundleCover, video: null, label: "Course Preview" }]);

  // Active item: pick from chapters when available, else from levels
  const activeLevel =
    rawChapters.length > 0
      ? rawChapters[active]
      : (Array.isArray(c.levels) ? c.levels?.[active] : undefined);

  return (
    <>
      <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            {/* Main course title stays fixed */}
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              {course.title}
            </h1>

            {/* per-level subtitle (changes with carousel) */}
            {activeLevel?.title && (
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {activeLevel.title}
              </h2>
            )}

            {/* Description follows active item; falls back to course description or default text */}
            <p className="text-gray-600 mb-6 leading-relaxed">
              {activeLevel?.description ??
                course.description ??
                "watch this course and get certificate soon"}
            </p>

            {/* Meta chips: category, slug, level (optional) */}
            <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
              {(c as any).category && (
                <span className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Category: {(c as any).category}
                </span>
              )}
              {(c as any).slug && (
                <span className="px-3 py-1 text-xs rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                  Slug: {(c as any).slug}
                </span>
              )}
              {(c as any).level && (c as any).level !== "all" && (
                <span className="px-3 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                  Level: {(c as any).level}
                </span>
              )}
            </div>

            {/* Tags — hidden when empty */}
            {course.tags && course.tags.length > 0 && (
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
            )}

            <div className="flex flex-wrap items-center gap-6">
              {/* Rating and review count */}
              <div className="flex items-center">
                <div className="flex text-yellow-400 mr-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <i
                      key={i}
                      className={
                        'fas fa-star text-sm ' +
                        (i < Math.round(Number(course.rating) || 0)
                          ? 'text-yellow-400'
                          : 'text-gray-300')
                      }
                    />
                  ))}
                </div>
                <span className="text-gray-600">({Number(course.reviews) || 0} reviews)</span>
              </div>
              <div className="flex items-center text-gray-600">
                <i className="fas fa-clock mr-2" />
                <span>{course.duration}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <i className="fas fa-layer-group mr-2" />
                <span>{course.levels?.length ?? 0} Levels</span>
              </div>
            </div>
          </div>

          {/* Right: carousel (same size/feel); reports slide change */}
          <div className="flex items-start md:justify-end">
            <VideoPreviewCarousel
              slides={slides}
              onSlideChange={setActive}   // updates subtitle & description
            />
          </div>
        </div>
      </div>
    </>
  );
}
