//mygf/src/components/common/Footer.tsx
import React, { useMemo, useState } from "react";

type LinkItem = { label: string; href: string };
type LinkGroup = { title: string; links: LinkItem[] };
type SocialId = "x" | "instagram" | "youtube" | "linkedin" | "github";

type SocialLink = { id: SocialId; href: string; ariaLabel?: string };

interface FooterProps {
  brandName?: string;
  tagline?: string;
  columns?: LinkGroup[];
  social?: SocialLink[];
  showNewsletter?: boolean;
  onSubscribe?: (email: string) => void;
  className?: string;
}

const Icon = {
  Logo: () => (
    <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="48" height="48" rx="12" fill="url(#lg1)" />
      <path d="M22 36c6-10 14-10 20 0" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="26" cy="26" r="2.5" fill="white" />
      <circle cx="38" cy="26" r="2.5" fill="white" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M18.9 2H22l-7.7 8.8L23.5 22h-6.6l-5.2-6.7L5.6 22H2l8.3-9.5L.8 2h6.7l4.7 6.1L18.9 2z"/>
    </svg>
  ),
  Instagram: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.4.4.6.2 1 .5 1.5 1 .5.5.7.9 1 1.5.2.5.3 1.2.4 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.4-.2.6-.5 1-1 1.5-.5.5-.9.7-1.5 1-.5.2-1.2.3-2.4.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.4-.4-.6-.2-1-.5-1.5-1-.5-.5-.7-.9-1-1.5-.2-.5-.3-1.2-.4-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.4.2-.6.5-1 1-1.5.5-.5.9-.7 1.5-1 .5-.2 1.2-.3 2.4-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.8.1-.9.1-1.4.2-1.7.3-.4.2-.6.3-.9.6-.3.3-.5.5-.6.9-.1.3-.2.8-.3 1.7-.1 1.2-.1 1.6-.1 4.8s0 3.5.1 4.8c.1.9.2 1.4.3 1.7.2.4.3.6.6.9.3.3.5.5.9.6.3.1.8.2 1.7.3 1.2.1 1.6.1 4.8.1s3.5 0 4.8-.1c.9-.1 1.4-.2 1.7-.3.4-.2.6-.3.9-.6.3-.3.5-.5.6-.9.1-.3.2-.8.3-1.7.1-1.2.1-1.6.1-4.8s0-3.5-.1-4.8c-.1-.9-.2-1.4-.3-1.7-.2-.4-.3-.6-.6-.9-.3-.3-.5-.5-.9-.6-.3-.1-.8-.2-1.7-.3-1.3-.1-1.7-.1-4.8-.1zm0 3.3a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4zm0 1.8a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zM17.6 5.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>
    </svg>
  ),
  YouTube: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M23 7.1a4 4 0 0 0-2.7-2.8C18.5 4 12 4 12 4s-6.5 0-8.3.3A4 4 0 0 0 1 7.1 41 41 0 0 0 1 12a41 41 0 0 0 .7 4.9 4 4 0 0 0 2.7 2.8C5.3 20 12 20 12 20s6.5 0 8.3-.3a4 4 0 0 0 2.7-2.8c.5-1.6.7-3.3.7-4.9s-.2-3.3-.7-4.9zM10 15.5V8.5l6 3.5-6 3.5z"/>
    </svg>
  ),
  LinkedIn: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.6h.1c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.4 2.4 4.4 5.4V21h-4v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z"/>
    </svg>
  ),
  GitHub: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.4-4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.5 1.1 3.1.9.1-.7.4-1.1.6-1.4-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.2a11.7 11.7 0 0 1 6.2 0C17.6 5.9 18.6 6.2 18.6 6.2c.6 1.7.2 3 .1 3.3.8.9 1.2 2 1.2 3.3 0 4.4-2.7 5.3-5.3 5.6.4.3.7.9.7 1.9v2.8c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/>
    </svg>
  ),
  Mail: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 6h16v12H4z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  ),
};

const FooterWave: React.FC = () => (
  <div className="absolute -top-8 inset-x-0" aria-hidden>
    <svg className="w-full h-8" viewBox="0 0 1440 80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fw" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M0,40 C200,80 400,0 720,40 C1040,80 1240,0 1440,40 L1440,80 L0,80 Z" fill="url(#fw)" opacity="0.35"/>
    </svg>
  </div>
);

const Newsletter: React.FC<{ onSubmit?: (email: string) => void; }> = ({ onSubmit }) => {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(val);
      }}
      className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-600"><Icon.Mail /></span>
        <input
          type="email"
          required
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Your email"
          className="w-full bg-transparent outline-none"
        />
      </div>
      <div className="h-px w-full mt-3 bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400" />
      <button
        type="submit"
        className="mt-3 w-full rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow"
      >
        Subscribe
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Get product updates, course launches, and curated articles.
      </p>
    </form>
  );
};

const SocialRow: React.FC<{ items: SocialLink[] }> = ({ items }) => (
  <div className="flex items-center gap-3">
    {items.map((s) => {
      const C =
        s.id === "x" ? Icon.X :
        s.id === "instagram" ? Icon.Instagram :
        s.id === "youtube" ? Icon.YouTube :
        s.id === "linkedin" ? Icon.LinkedIn :
        Icon.GitHub;
      return (
        <a
          key={s.id}
          href={s.href}
          aria-label={s.ariaLabel || s.id}
          className="group inline-flex items-center justify-center h-10 w-10 rounded-full border border-slate-200/70 bg-white/70 backdrop-blur shadow-sm hover:shadow transition"
        >
          <C />
        </a>
      );
    })}
  </div>
);

const Footer: React.FC<FooterProps> = ({
  brandName = "YourBrand",
  tagline = "Elevate learning with modern tools & curated content.",
  columns,
  social,
  showNewsletter = true,
  onSubscribe,
  className = "",
}) => {
  const year = useMemo(() => new Date().getFullYear(), []);
  const cols: LinkGroup[] =
    columns ?? [
      {
        title: "Product",
        links: [
          { label: "Courses", href: "/tracks" },
          { label: "Pricing", href: "/pricing" },
          { label: "Certificates", href: "/certificates" },
          { label: "Changelogs", href: "/changelog" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Careers", href: "/careers" },
          { label: "Contact", href: "/contact" },
          { label: "Press", href: "/press" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Blog", href: "/blog" },
          { label: "Guides", href: "/guides" },
          { label: "Docs", href: "/docs" },
          { label: "FAQ", href: "/faq" },
        ],
      },
    ];

  const socials: SocialLink[] =
    social ?? [
      { id: "x", href: "#", ariaLabel: "X (Twitter)" },
      { id: "instagram", href: "#", ariaLabel: "Instagram" },
      { id: "youtube", href: "#", ariaLabel: "YouTube" },
      { id: "linkedin", href: "#", ariaLabel: "LinkedIn" },
      { id: "github", href: "#", ariaLabel: "GitHub" },
    ];

  return (
    <footer
      role="contentinfo"
      className={`relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-sky-50 ${className}`}
    >
      {/* wave divider */}
      <FooterWave />

      {/* soft bg blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16">
        {/* top brand + newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <Icon.Logo />
              <div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">{brandName}</div>
                <div className="text-sm text-slate-600">{tagline}</div>
              </div>
            </div>

            <div className="mt-5">
              <SocialRow items={socials} />
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {cols.map((group) => (
              <div key={group.title}>
                <div className="text-sm font-semibold text-slate-800">{group.title}</div>
                <div className="mt-3 space-y-2">
                  {group.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      className="block text-sm text-slate-600 hover:text-slate-900"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {showNewsletter && (
            <div className="lg:col-span-3">
              <div className="text-sm font-semibold text-slate-800">Subscribe</div>
              <div className="mt-3">
                <Newsletter onSubmit={onSubscribe} />
              </div>
            </div>
          )}
        </div>

        {/* divider */}
        <div className="mt-12 h-px w-full bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300/70" />

        {/* bottom bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            © {year} {brandName}. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <a href="/privacy" className="hover:text-slate-900">Privacy</a>
            <span className="opacity-30">•</span>
            <a href="/terms" className="hover:text-slate-900">Terms</a>
            <span className="opacity-30">•</span>
            <a href="/status" className="hover:text-slate-900">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
