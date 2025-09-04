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

      {/* Spacer below fixed navbar */}
<div className="h-10 sm:h-16" aria-hidden />

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-sky-50">
        {/* Background */}
        <WavyBackdrop />

        {/* Content */}
        <main className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              About{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                ECA — Engineers Computer Academy
              </span>
            </h1>
            <p className="mt-3 text-slate-600">
              A unit under <strong>M.Y. Gangoor International Foundation® (Multi-Sciences Education &amp; Research Centre)</strong>,
              established in <strong>1995</strong> (Reg. No. <strong>BEL-S249-2013-14</strong>). We deliver career-focused computer and
              engineering education while honoring India’s timeless knowledge traditions through a clear, modern and practical approach.
            </p>
            <div className="mx-auto mt-5 h-px w-28 bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400" />
          </div>

          {/* Stats */}
          <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value="1995" label="Established" />
            <StatCard value="BEL-S249-2013-14" label="Registration No." />
            <StatCard value="8+" label="Countries Reached (US, UK, UAE, JP, CA, DE, AU, SG)" />
            <StatCard value="5+" label="Sister Concerns" />
          </section>

          {/* Mission */}
          <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6">
              <SectionHeader
                title="Our Mission"
                subtitle="Sharing ancient Indian sciences through a modern, scientific approach that inspires a meaningful life."
              />
              <p className="mt-4 text-sm md:text-base text-slate-600">
                We exist to make the priceless heritage of Indian sciences accessible to all—uniting individuals with the
                cosmic life force and nurturing <em>peace, compassion, and holistic well-being</em>. By blending tradition with
                clarity and rigor, we help learners cultivate inner strength, wisdom, and practical skills for today’s world.
              </p>

              <div className="mt-5">
                <SectionHeader title="Our Vision" />
                <p className="mt-3 text-sm md:text-base text-slate-600">
                  A world enriched by timeless knowledge—where people live healthier, wiser, and more balanced lives;
                  awakening spiritually while building compassionate communities across the globe.
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  to="/tracks"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
                >
                  Explore Courses
                </Link>
                <Link
                  to="/enquiry"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
                >
                  Enquiry &amp; Admissions
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
                  Where tradition meets technology: practical learning, clear pathways, meaningful outcomes.
                </p>
              </div>
            </div>
          </section>

          {/* What we offer / Features */}
          <section className="mt-14">
            <SectionHeader
              title="What We Offer"
              subtitle="Career-ready computer & engineering programs alongside ancient Indian knowledge systems."
              center
            />
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                title="Ancient Sciences"
                desc="Yoga & Meditation, Ayurveda & Holistic Healing, Astrology & Vastu Shastra, Reiki & Energy Sciences, Numerology & Dowsing."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                }
              />
              <FeatureCard
                title="Advance Computer Courses"
                desc="Video Editing, Online Marketing, Diploma in Office Automation (DOA), Diploma in DTP, and more."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <rect x="3" y="3" width="18" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                }
              />
              <FeatureCard
                title="Engineering Programs"
                desc="Mechanical (CATIA, NX, SolidWorks, CAM); Civil/Architecture (STAAD Pro, ETABS, 3ds Max, Revit); CS (Web, Python, C/C++)."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <path d="M3 7h18M6 3v8M18 3v8M3 15h18M6 11v8M18 11v8" />
                  </svg>
                }
              />
              <FeatureCard
                title="Well-Being & Naturopathy"
                desc="Integrated wellness via Yoga Shastra and naturopathy practices to support holistic growth."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <path d="M12 3c-4 4-4 10 0 14 4-4 4-10 0-14z" />
                    <path d="M5 21h14" />
                  </svg>
                }
              />
              <FeatureCard
                title="Global Ambassadors"
                desc="Cultural bridges across US, UK, UAE, Japan, Canada, Germany, Australia, Singapore—sharing knowledge worldwide."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                  </svg>
                }
              />
              <FeatureCard
                title="Community & Research"
                desc="A Multi-Sciences Education & Research Centre with sister concerns including Reiki International, My Yoga Academy, and more."
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="1.6">
                    <path d="M12 7v10M7 12h10" />
                    <circle cx="12" cy="12" r="9" />
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
                title="Peace & Compassion"
                desc="Human-centered learning that nurtures empathy and balanced living."
                icon={<span className="font-bold">❤</span>}
              />
              <ValueCard
                title="Scientific Rigor"
                desc="Modern, evidence-aligned methods while preserving authentic traditions."
                icon={<span className="font-bold">⚙</span>}
              />
              <ValueCard
                title="Heritage & Culture"
                desc="Respecting India’s sacred knowledge and sharing it responsibly."
                icon={<span className="font-bold">ॐ</span>}
              />
              <ValueCard
                title="Holistic Growth"
                desc="Skilling for careers—and for life: mind, body, spirit."
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
                  <TimelineItem
                    year="1995"
                    title="Foundation Established"
                    desc="M.Y. Gangoor International Foundation begins its service as a Multi-Sciences Education & Research Centre."
                  />
                  <TimelineItem
                    year="2013–14"
                    title="Registered (BEL-S249-2013-14)"
                    desc="Formal registration strengthens our mission and outreach."
                  />
                  <TimelineItem
                    year="2015–2022"
                    title="Global Outreach"
                    desc="Ambassadors and initiatives extend across US, UK, UAE, Japan, Canada, Germany, Australia, Singapore."
                  />
                  <TimelineItem
                    year="2023–Present"
                    title="Digital Learning @ ECA"
                    desc="Career-ready computer and engineering programs integrated with clear, structured learning experiences."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-6 shadow-sm">
                <p className="text-sm text-slate-600">
                  We continue to refine practical, outcome-driven learning—uniting technology with timeless wisdom, and
                  making high-quality education accessible and meaningful for everyone.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    to="/tracks"
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
                  >
                    Explore Courses
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
                  q: "How do I apply for ECA courses?",
                  a: "Use the Enquiry & Admissions option. Our team will guide you to the right computer/engineering track or wellness program.",
                },
                {
                  q: "Do you provide certificates?",
                  a: "Yes. On successful completion, eligible courses provide certificates aligned to program requirements.",
                },
                {
                  q: "Are programs online or offline?",
                  a: "We support blended delivery. Mode depends on the specific course or discipline and will be shared during admission.",
                },
                {
                  q: "Whom can I contact?",
                  a: "Dr. Ramesh Gangoor (+91-9845290825), Shri Shivanand Gangoor (+91-8496976263), or email rameshgangoor@gmail.com.",
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
            <h3 className="text-xl md:text-2xl font-semibold text-slate-900">Start your journey with ECA</h3>
            <p className="mt-2 text-slate-600">
              Engineers Computer Academy — a unit of M.Y. Gangoor International Foundation® (Angol Rd., Belagavi, Karnataka, Bharat).
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Call: +91 0831-4201267 · +91-9845290825 · +91-8496976263 · Email: rameshgangoor@gmail.com
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                to="/enquiry"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
              >
                Enquiry &amp; Admissions
              </Link>
              <Link
                to="/tracks"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
              >
                Browse Programs
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <Footer brandName="ECA" tagline="Engineers Computer Academy · A unit of M.Y. Gangoor International Foundation®" />
      </section>
    </>
  );
};

export default AboutSection;
