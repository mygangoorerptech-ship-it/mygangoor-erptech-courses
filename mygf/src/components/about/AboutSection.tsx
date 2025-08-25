// mygf/src/components/about/AboutSection.tsx
import React from "react";
import NavBar from "../home/NavBar";
import Footer from "../common/Footer";
import { Link } from "react-router-dom";

/** Soft wavy/gradient backdrop (reusable on other pages too) */
const WavyBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* top wave */}
    <svg className="absolute -top-8 inset-x-0 w-full h-10" viewBox="0 0 1440 80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="aboutWave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M0,40 C200,80 400,0 720,40 C1040,80 1240,0 1440,40 L1440,80 L0,80 Z" fill="url(#aboutWave)" opacity="0.25" />
    </svg>

    {/* soft blobs */}
    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
  </div>
);

/** Section header with subtle gradient underline */
const SectionHeader: React.FC<{ title: string; subtitle?: string; center?: boolean }> = ({
  title,
  subtitle,
  center,
}) => (
  <header className={center ? "text-center" : ""}>
    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
    {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
    <div
      className={`mt-4 h-px w-24 bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 ${center ? "mx-auto" : ""}`}
    />
  </header>
);

/** Stat pill */
const StatCard: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm">
    <div className="text-2xl md:text-3xl font-semibold text-slate-900">{value}</div>
    <div className="text-sm text-slate-600 mt-1">{label}</div>
  </div>
);

/** Feature with icon */
const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode }> = ({
  title,
  desc,
  icon,
}) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm hover:shadow-md transition">
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/60 bg-white">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    </div>
    <p className="mt-3 text-sm text-slate-600">{desc}</p>
  </div>
);

/** Value chip */
const ValueCard: React.FC<{ title: string; desc: string; icon: React.ReactNode }> = ({
  title,
  desc,
  icon,
}) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 text-white">
        {icon}
      </span>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    </div>
    <p className="mt-2 text-sm text-slate-600">{desc}</p>
  </div>
);

/** Simple vertical timeline item */
const TimelineItem: React.FC<{ year: string; title: string; desc: string }> = ({ year, title, desc }) => (
  <div className="relative pl-8">
    <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500" />
    <div className="text-xs text-slate-500">{year}</div>
    <div className="text-sm font-semibold text-slate-900">{title}</div>
    <p className="text-sm text-slate-600 mt-1">{desc}</p>
  </div>
);

const AboutSection: React.FC = () => {
  return (
    <>
          {/* Full-bleed nav */}
      <div className="relative z-20">
        <NavBar />
      </div>
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-sky-50">

      {/* Background */}
      <WavyBackdrop />

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            About <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">Mithun Kumar</span>
          </h1>
          <p className="mt-3 text-slate-600">
            We help learners master real-world skills through curated tracks, hands-on assignments,
            and certificates that actually mean something.
          </p>
          <div className="mx-auto mt-5 h-px w-28 bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400" />
        </div>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="120K+" label="Learners" />
          <StatCard value="340+" label="Video Lessons" />
          <StatCard value="48" label="Career Tracks" />
          <StatCard value="92%" label="Completion Rate" />
        </section>

        {/* Mission */}
        <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6">
            <SectionHeader
              title="Our Mission"
              subtitle="Deliver high-quality, outcome-driven learning experiences with clean design and zero distractions."
            />
            <p className="mt-4 text-sm md:text-base text-slate-600">
              We combine expert-led content, practical tasks, and peer feedback to help you move from
              theory to production-ready skills. Every course is built to be clear, structured, and
              enjoyable—so you can focus on learning, not fighting the UI.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                to="/tracks"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
              >
                Browse Tracks
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* Illustration card */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm">
              <div className="aspect-[16/10] w-full rounded-2xl bg-gradient-to-br from-sky-100 via-indigo-100 to-fuchsia-100 relative overflow-hidden">
                {/* dotted grid */}
                <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 160 100" preserveAspectRatio="none">
                  <defs>
                    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" fill="#c7d2fe" />
                    </pattern>
                  </defs>
                  <rect width="160" height="100" fill="url(#dots)" />
                </svg>
                {/* floating bars */}
                <div className="absolute inset-0 flex items-center justify-center gap-2">
                  <div className="h-16 w-2 rounded-full bg-gradient-to-b from-indigo-400 to-sky-400 animate-[bounce_4s_ease-in-out_infinite]" />
                  <div className="h-10 w-2 rounded-full bg-gradient-to-b from-indigo-400 to-sky-400 animate-[bounce_3s_ease-in-out_infinite]" />
                  <div className="h-20 w-2 rounded-full bg-gradient-to-b from-indigo-400 to-sky-400 animate-[bounce_5s_ease-in-out_infinite]" />
                  <div className="h-12 w-2 rounded-full bg-gradient-to-b from-indigo-400 to-sky-400 animate-[bounce_4.5s_ease-in-out_infinite]" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Clean visuals, structured learning, and friction-free interfaces.
              </p>
            </div>
          </div>
        </section>

        {/* What we do / Features */}
        <section className="mt-14">
          <SectionHeader
            title="What We Do"
            subtitle="A focused stack of features that make learning straightforward and effective."
            center
          />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              title="Structured Tracks"
              desc="Progressive levels unlock as you complete assignments—learn in the right order."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                  <path d="M4 6h16M4 12h10M4 18h6" />
                </svg>
              }
            />
            <FeatureCard
              title="Hands-on Tasks"
              desc="Every level has a practical assignment so you can build real muscle memory."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                  <rect x="3" y="3" width="18" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              }
            />
            <FeatureCard
              title="Meaningful Certificates"
              desc="Complete all levels and instantly receive a downloadable certificate."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm2.2 6.7-3.3 3.7-1.6-1.6-1.1 1.1 2.7 2.7 4.4-5z" />
                </svg>
              }
            />
            <FeatureCard
              title="Clean UI"
              desc="Modern, distraction-free interfaces that keep you in flow."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M3 9h18" />
                </svg>
              }
            />
            <FeatureCard
              title="Responsive Everywhere"
              desc="Designed to look and work great on desktop and mobile—no compromises."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                  <rect x="4" y="6" width="12" height="12" rx="2" />
                  <rect x="18" y="8" width="2" height="8" rx="1" />
                </svg>
              }
            />
            <FeatureCard
              title="Supportive Community"
              desc="Learn together with feedback, reviews, and shared wins."
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                  <circle cx="8" cy="8" r="3" />
                  <circle cx="16" cy="8" r="3" />
                  <path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Values */}
        <section className="mt-14">
          <SectionHeader title="Our Values" center />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ValueCard
              title="Clarity"
              desc="No fluff—just well-structured learning paths that respect your time."
              icon={<span className="font-bold">C</span>}
            />
            <ValueCard
              title="Craft"
              desc="We obsess over the details so interfaces feel effortless."
              icon={<span className="font-bold">⚙</span>}
            />
            <ValueCard
              title="Care"
              desc="We build with empathy and measure success by your outcomes."
              icon={<span className="font-bold">❤</span>}
            />
            <ValueCard
              title="Consistency"
              desc="Reliable content, predictable progress, and steady growth."
              icon={<span className="font-bold">∞</span>}
            />
          </div>
        </section>

        {/* Timeline */}
        <section className="mt-14">
          <SectionHeader title="Our Journey" center />
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" aria-hidden />
              <div className="space-y-6">
                <TimelineItem year="2023" title="Prototype Launch" desc="We began with a small, sharp set of courses and a clean UI." />
                <TimelineItem year="2024" title="Tracks & Certificates" desc="Unlocked progression, assignments, and instant certificates." />
                <TimelineItem year="2025" title="Community Impact" desc="Scaled globally while keeping the experience crisp and focused." />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                Our roadmap is simple: keep polishing the learning experience. We prioritize clarity,
                build features that directly improve outcomes, and keep the interface beautifully minimal.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  to="/tracks"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
                >
                  Explore Tracks
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <SectionHeader title="Frequently Asked Questions" center />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: "How do levels unlock?",
                a: "Complete the assignment for the current level. The next level unlocks automatically.",
              },
              {
                q: "Do I need to pay for each track?",
                a: "Yes, tracks are paid. Once purchased, you retain access and can rewatch completed levels anytime.",
              },
              {
                q: "When do I get the certificate?",
                a: "Finish all levels in a track and your certificate is generated instantly for download.",
              },
              {
                q: "Is this mobile friendly?",
                a: "Totally. The UI is responsive and tuned for both desktop and mobile.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm open:shadow-md transition"
              >
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900 flex items-center justify-between">
                  {item.q}
                  <span className="ml-4 text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h3 className="text-xl md:text-2xl font-semibold text-slate-900">
            Ready to learn with clarity?
          </h3>
          <p className="mt-2 text-slate-600">
            Join thousands of learners building career-ready skills with MithunKumar.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
            >
              Create Account
            </Link>
            <Link
              to="/tracks"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
            >
              Browse Courses
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer brandName="MithunKumar" tagline="Learn smarter. Build faster." />
    </section>
    </>
  );
};

export default AboutSection;
