// mygf/src/components/home/HomeSection.tsx
import NavBar from "./NavBar";
import BackgroundWaves from "./BackgroundWaves";
import HeroLeftCard from "./HeroLeftCard";
import HeroRightMedia from "./HeroRightMedia";
import CourseCard from "./CourseCard";
import { featured } from "./data";
import Footer from "../common/Footer";

export default function HomeSection() {
  return (
    <>
          {/* make the sticky NavBar full-bleed (not inside max-w) */}
      <div className="relative z-20">
        <NavBar />
      </div>
    <section className="relative overflow-hidden">
            <BackgroundWaves />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-2 md:pt-4 pb-10 md:pb-14">

        {/* Hero row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
          <div className="relative">
            <HeroLeftCard />
          </div>
          <HeroRightMedia />
        </div>

        {/* Free Course block */}
        <div className="rounded-3xl bg-white/95 shadow-xl shadow-slate-900/10 border border-white/40 overflow-hidden">
          <div className="h-4 w-full bg-white" />
          <div className="px-6 sm:px-8 pt-1 sm:pt-2 pb-6 sm:pb-8">
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug text-slate-900">
              Free Courses
            </h2>

            {/* On lg: 4 columns total.
                Cols 1-3 = course cards, Col 4 = triptych of 3 gradient pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {featured.slice(0, 3).map((c) => (
                <CourseCard key={c.id} {...c} />
              ))}

              {/* equals the width/height of a single course card */}
              <GradientTriptych className="hidden lg:block" />
            </div>
          </div>
        </div>
      </div>

      {/* inline keyframes used by media progress bar */}
      <style>{`
        @keyframes grow { 0%,100% { width: 30% } 50% { width: 70% } }
        @keyframes hueFloat {
          0% { filter: hue-rotate(0deg); transform: translateY(0); }
          50% { filter: hue-rotate(20deg); transform: translateY(-6px); }
          100% { filter: hue-rotate(0deg); transform: translateY(0); }
        }
      `}</style>

            {/* Footer at the end */}
      <Footer
        brandName="MithunKumar"
        tagline="Learn smarter. Build faster."
        className="mt-8"
      />
    </section>
    </>
  );
}

/* --------- Triptych: 5 tall, thin gradient pillars --------- */
function GradientTriptych({ className = "" }: { className?: string }) {
  return (
    <article
      className={`rounded-xl overflow-hidden border-0 shadow-none bg-transparent ${className}`}
      aria-hidden="true"
    >
      {/* taller container instead of fixed 16:9 */}
      <div className="relative h-36 sm:h-40 md:h-44 lg:h-48">
        <div className="absolute inset-0 flex items-end justify-between gap-3 p-3">
          <Pillar variant="blue" />
          <Pillar variant="purple" />
          <Pillar variant="teal" />
          <Pillar variant="amber" />
          <Pillar variant="rose" />
        </div>
      </div>
      <div className="p-0.5" />
    </article>
  );
}

function Pillar({
  variant,
}: {
  variant: "blue" | "purple" | "teal" | "amber" | "rose";
}) {
  const bg =
    variant === "blue"
      ? "bg-[conic-gradient(at_30%_20%,#93c5fd_0%,#3b82f6_35%,#06b6d4_75%,#93c5fd_100%)]"
      : variant === "purple"
      ? "bg-[conic-gradient(at_70%_30%,#e9d5ff_0%,#a78bfa_35%,#8b5cf6_75%,#e9d5ff_100%)]"
      : variant === "teal"
      ? "bg-[conic-gradient(at_30%_70%,#99f6e4_0%,#34d399_35%,#22d3ee_75%,#99f6e4_100%)]"
      : variant === "amber"
      ? "bg-[conic-gradient(at_70%_70%,#fde68a_0%,#f59e0b_40%,#f97316_75%,#fde68a_100%)]"
      : "bg-[conic-gradient(at_30%_50%,#fecdd3_0%,#fb7185_40%,#f43f5e_75%,#fecdd3_100%)]"; // rose

  return (
    <div
      className={`h-full w-2 sm:w-2.5 md:w-3 rounded-xl ${bg} border border-white/30 shadow-md shadow-slate-900/10 bg-transparent`}
      style={{ animation: "hueFloat 6s ease-in-out infinite" }}
    />
  );
}
