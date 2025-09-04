// mygf/src/components/home/HomeLanding.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../admin/auth/store";
import { createPortal } from "react-dom";
import { JoinNowModal } from "../join";

export default function HomeLanding() {
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const isAuthed = !!(isAuthenticated ?? user);
  const [joinOpen, setJoinOpen] = useState(false);

  // ==== ACTIONS: copy the runtime behavior from NavBar.tsx & HeroLeftCard.tsx ====
const goLoginOrDashboard = () => {
  if (isAuthed) {
    if (role && /^org/i.test(String(role))) {
      navigate("/dashboard");
      return;
    }
    switch (role) {
      case "superadmin": navigate("/superadmin"); break;
      case "admin":      navigate("/admin"); break;
      case "vendor":     navigate("/vendor"); break;
      case "student":    navigate("/dashboard"); break;
      default:           navigate("/dashboard");
    }
  } else {
    navigate("/login");
  }
};

  // Expose a global opener (parity with NavBar), but Home can open it itself
  useEffect(() => {
    const handler = () => setJoinOpen(true);
    (window as any).app = (window as any).app || {};
    (window as any).app.openJoinForm = handler;
    return () => {
      if ((window as any).app?.openJoinForm === handler) {
        delete (window as any).app.openJoinForm;
      }
    };
  }, []);

  const openJoinForm = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setJoinOpen(true); // open the JoinNowModal right here
  };

  const browseCourses = () => {
    // same route HeroLeftCard.tsx uses
    navigate("/tracks");
  };

  const watchDemo = () => {
    // If HeroLeftCard.tsx opens a demo modal, call it; else navigate to demo route
    try {
      // @ts-ignore
      if (window?.app?.openDemo) return window.app.openDemo();
    } catch {}
    navigate("/demo");
  };

  const goAboutPage = () => {
    // CTA only. Keep navbar "About" as anchor per your requirement.
    navigate("/about");
  };

  // ==== Refs for DOM hookups (search suggestions, carousel, etc.) ====
  const rootRef = useRef<HTMLDivElement>(null);

  // ==== Side effects that mirror the inline <script> in your HTML ====
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Smooth anchor scroll for in-page links
    const anchorHandler = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      const target = root.querySelector(href) as HTMLElement | null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const anchors = root.querySelectorAll('a[href^="#"]');
    anchors.forEach(a => a.addEventListener("click", anchorHandler));

    // Course filter buttons
    const filterButtons = root.querySelectorAll<HTMLButtonElement>(".course-filter");
    const courseItems = root.querySelectorAll<HTMLElement>(".course-item");
    const onFilterClick = (btn: HTMLButtonElement) => {
      filterButtons.forEach(b => {
        b.classList.remove("from-pink-500","to-blue-500","bg-gradient-to-r","text-white");
        b.classList.add("bg-white","text-gray-700");
      });
      btn.classList.remove("bg-white","text-gray-700");
      btn.classList.add("bg-gradient-to-r","from-pink-500","to-blue-500","text-white");

      const category = btn.getAttribute("data-category");
      courseItems.forEach(item => {
        const ok = category === "all" || item.getAttribute("data-category") === category;
        item.style.display = ok ? "block" : "none";
        if (ok) item.style.animation = "fadeInUp .5s ease forwards";
      });
    };
    filterButtons.forEach(b => b.addEventListener("click", () => onFilterClick(b)));

    // Typewriter
    const typewriterEl = root.querySelector<HTMLElement>("#typewriter");
    const words = ["Career", "Future", "Skills", "Dream"];
    let wordIndex = 0, charIndex = 0, isDeleting = false, tId: number | null = null;

    const runType = () => {
      if (!typewriterEl) return;
      const current = words[wordIndex];
      typewriterEl.textContent = isDeleting
        ? current.substring(0, charIndex - 1)
        : current.substring(0, charIndex + 1);
      charIndex += isDeleting ? -1 : 1;

      let speed = isDeleting ? 90 : 140;
      if (!isDeleting && charIndex === current.length) {
        speed = 1600; isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false; wordIndex = (wordIndex + 1) % words.length; speed = 500;
      }
      tId = window.setTimeout(runType, speed);
    };
    const typeStart = window.setTimeout(runType, 800);

    // Search suggestions
    const searchInput = root.querySelector<HTMLInputElement>("#heroSearch");
    const searchSuggestions = root.querySelector<HTMLElement>("#searchSuggestions");
    const suggestionSpans = root.querySelectorAll<HTMLElement>("#searchSuggestions span");
    const onFocus = () => {
      searchSuggestions?.classList.remove("opacity-0","invisible");
      searchSuggestions?.classList.add("opacity-100","visible");
    };
    const onBlur = () => {
      window.setTimeout(() => {
        searchSuggestions?.classList.add("opacity-0","invisible");
        searchSuggestions?.classList.remove("opacity-100","visible");
      }, 200);
    };
    searchInput?.addEventListener("focus", onFocus);
    searchInput?.addEventListener("blur", onBlur);
    suggestionSpans.forEach(s => s.addEventListener("click", () => {
      if (searchInput) searchInput.value = s.textContent || "";
      onBlur();
    }));

    // Background hero carousel
    const slides = root.querySelectorAll<HTMLElement>(".carousel-slide");
    let slideIdx = 0;
    const nextSlide = () => {
      if (!slides.length) return;
      slides[slideIdx].classList.remove("opacity-100");
      slides[slideIdx].classList.add("opacity-0");
      slideIdx = (slideIdx + 1) % slides.length;
      slides[slideIdx].classList.remove("opacity-0");
      slides[slideIdx].classList.add("opacity-100");
    };
    const carouselId = window.setInterval(nextSlide, 5000);

    // Intersection observer for fade-ins
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
      }),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    root.querySelectorAll(".fade-in, .fade-in-delay-1, .fade-in-delay-2, .fade-in-delay-3")
        .forEach(el => observer.observe(el));

    // Nav scroll effect (keeps your translucent -> solid transition)
    const nav = root.querySelector("nav");
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 100) { nav.classList.add("bg-white/95"); nav.classList.remove("bg-white/80"); }
      else { nav.classList.add("bg-white/80"); nav.classList.remove("bg-white/95"); }
    };
    window.addEventListener("scroll", onScroll);
    onScroll(); // initialize

    // Cleanup
    return () => {
      anchors.forEach(a => a.removeEventListener("click", anchorHandler));
      filterButtons.forEach(b => b.replaceWith(b.cloneNode(true))); // drop handlers
      searchInput?.removeEventListener("focus", onFocus);
      searchInput?.removeEventListener("blur", onBlur);
      window.clearInterval(carouselId);
      window.clearTimeout(typeStart);
      if (tId) window.clearTimeout(tId);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [isAuthed, role]);

  // Image error handler (mirror your HTML onerror)
  const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.src = "";
    img.style.display = "none";
  };

  return (
    <>
      {/* Keep the small CSS from the original HTML (animations, blobs, etc.) */}
      <style>{`
        .gradient-bg { background: linear-gradient(135deg,#fce7f3 0%,#e0f2fe 50%,#f8fafc 100%); }
        .card-hover { transition: all .3s ease; }
        .card-hover:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,.1); }

        .fade-in{opacity:0;transform:translateY(30px);animation:fadeInUp .8s ease forwards}
        .fade-in-delay-1{animation-delay:.2s}.fade-in-delay-2{animation-delay:.4s}.fade-in-delay-3{animation-delay:.6s}
        @keyframes fadeInUp{to{opacity:1;transform:translateY(0)}}

        .blob { filter: blur(40px); opacity:.5; animation:floatY 10s ease-in-out infinite; }
        .blob:nth-child(2){animation-duration:12s}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}

        .course-card{background:rgba(255,255,255,.9);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.2)}

        .nav-link{position:relative;transition:color .3s ease;}
        .nav-link::after{content:'';position:absolute;width:0;height:2px;bottom:-5px;left:0;background:linear-gradient(90deg,#ec4899,#06b6d4);transition:width .3s ease;}
        .nav-link:hover::after{width:100%}

        .hero-media { box-shadow: 0 30px 60px rgba(0,0,0,.15); }
        .hero-bubble { box-shadow: 0 10px 30px rgba(236,72,153,.25); }
      `}</style>

      <div ref={rootRef} className="gradient-bg min-h-screen">
        {/* NAVIGATION — same design, logic copied from NavBar.tsx for Login/Join/Dashboard */}
        <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-pink-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
                  ECA Academy
                </div>
              </div>
              <div className="hidden md:flex space-x-8">
        {/* Home -> /home */}
        <a
          href="/home"
          onClick={(e) => { e.preventDefault(); navigate("/home"); }}
          className="nav-link text-gray-700 hover:text-pink-500 flex items-center gap-2"
        >
          <i className="fa-solid fa-house-chimney" /><span>Home</span>
        </a>
        {/* About -> /about */}
        <a
          href="/about"
          onClick={(e) => { e.preventDefault(); navigate("/about"); }}
          className="nav-link text-gray-700 hover:text-pink-500 flex items-center gap-2"
        >
          <i className="fa-solid fa-circle-info" /><span>About</span>
        </a>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={goLoginOrDashboard}
                  className="text-gray-700 hover:text-pink-500 transition-colors flex items-center gap-2"
                >
                  <i className="fa-solid fa-right-to-bracket" />
                  {isAuthed ? "Dashboard" : "Login"}
                </button>
            {/* Join Form */}
            <button
              type="button"
              onClick={openJoinForm}
              className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-pink-500 text-white px-5 py-2 font-semibold shadow-md shadow-rose-700/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="group-hover:rotate-12 transition-transform text-yellow-200">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Join Form</span>
            </button>
              </div>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section id="home" className="relative pt-28 pb-14 px-4 overflow-hidden">
          {/* background carousel */}
          <div className="absolute inset-0">
            <div className="carousel-container relative w-full h-full">
              <div className="carousel-slide absolute inset-0 transition-opacity duration-1000 opacity-100">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80"
                  alt="Students learning" className="w-full h-full object-cover" onError={onImgErr}
                />
                <div className="absolute inset-0 bg-white/85" />
              </div>
              <div className="carousel-slide absolute inset-0 transition-opacity duration-1000 opacity-0">
                <img
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1920&q=80"
                  alt="Online learning" className="w-full h-full object-cover" onError={onImgErr}
                />
                <div className="absolute inset-0 bg-white/85" />
              </div>
              <div className="carousel-slide absolute inset-0 transition-opacity duration-1000 opacity-0">
                <img
                  src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1920&q=80"
                  alt="Digital workspace" className="w-full h-full object-cover" onError={onImgErr}
                />
                <div className="absolute inset-0 bg-white/85" />
              </div>
              <div className="carousel-slide absolute inset-0 transition-opacity duration-1000 opacity-0">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80"
                  alt="Technology learning" className="w-full h-full object-cover" onError={onImgErr}
                />
                <div className="absolute inset-0 bg-white/85" />
              </div>
            </div>
            {/* blobs + soft gradient */}
            <div className="absolute -top-12 -left-10 w-64 h-64 bg-pink-200 rounded-full blob" />
            <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-blue-200 rounded-full blob" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-blue-50/30" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              {/* left copy */}
              <div className="text-center md:text-left">
                <div className="inline-flex items-center bg-gradient-to-r from-pink-100 to-blue-100 border border-pink-200 rounded-full px-5 py-2.5 mb-6 shadow-sm fade-in">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">🎉 Join 50,000+ successful learners</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight fade-in-delay-1">
                  Master New Skills. Level Up Your{" "}
                  <span id="typewriter" className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent" />
                </h1>

                <p className="text-lg md:text-xl text-gray-600 mt-5 mb-8 leading-relaxed fade-in-delay-2">
                  Expert-led courses, hands-on projects, and certificates that employers value.
                </p>

                {/* search */}
                <div className="relative z-30 max-w-xl md:max-w-2xl fade-in-delay-3 mx-auto md:mx-0">
                  <div className="flex items-center bg-white rounded-2xl shadow-xl border border-gray-100 p-2.5">
                    <i className="fas fa-search text-gray-400 ml-3 mr-2" />
                    <input
                      id="heroSearch" type="text" placeholder="What do you want to learn today?"
                      className="flex-1 py-3 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400 text-base md:text-lg"
                    />
                    <button
                      className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-5 py-3 rounded-xl font-semibold hover:shadow-lg transition-all ml-2"
                      onClick={browseCourses}
                    >
                      Search
                    </button>
                  </div>
                  <div
                    className="absolute top-full left-0 right-0 bg-white rounded-2xl shadow-xl mt-2 p-5 opacity-0 invisible transition-all duration-300"
                    id="searchSuggestions"
                  >
                    <div className="text-sm text-gray-500 mb-3">Popular searches:</div>
                    <div className="flex flex-wrap gap-3">
                      <span className="bg-pink-100 text-pink-700 px-4 py-2 rounded-full text-sm cursor-pointer hover:bg-pink-200 transition-colors">Web Development</span>
                      <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm cursor-pointer hover:bg-blue-200 transition-colors">Data Science</span>
                      <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm cursor-pointer hover:bg-purple-200 transition-colors">UI/UX Design</span>
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm cursor-pointer hover:bg-green-200 transition-colors">Digital Marketing</span>
                    </div>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-8 fade-in-delay-3 justify-center md:justify-start">
                  <button
                    onClick={browseCourses}
                    className="group bg-gradient-to-r from-pink-500 to-blue-500 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:shadow-2xl transition-all relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <i className="fas fa-play mr-3" /> Browse Courses
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={watchDemo}
                    className="group border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-2xl text-lg font-semibold hover:border-pink-300 hover:text-pink-600 transition-all flex items-center justify-center"
                  >
                    <i className="fas fa-video mr-3 group-hover:scale-110 transition-transform" /> Watch Demo
                  </button>
                </div>

                {/* stats */}
                <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-xl mt-10 fade-in-delay-3 mx-auto md:mx-0">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">50K+</div>
                    <div className="text-gray-600 text-sm">Active Students</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">200+</div>
                    <div className="text-gray-600 text-sm">Expert Courses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">4.9★</div>
                    <div className="text-gray-600 text-sm">Avg. Rating</div>
                  </div>
                </div>
              </div>

              {/* right media card */}
              <div className="relative fade-in-delay-2">
                <div className="relative bg-white rounded-3xl overflow-hidden hero-media">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-blue-50" />
                  <div className="relative p-4 sm:p-5 md:p-6 h-72 md:h-96">
                    <div className="grid grid-cols-2 gap-3 h-full">
                      <div className="relative rounded-2xl overflow-hidden group">
                        <img
                          src="https://images.unsplash.com/photo-1518779578993-ec3579fee39f?auto=format&fit=crop&w=800&q=70"
                          alt="Web Development" className="h-full w-full object-cover" onError={onImgErr}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold shadow">
                          <i className="fa-solid fa-code mr-1 text-pink-500" /> Web Dev
                        </div>
                        <div className="absolute bottom-2 left-2 text-white text-sm font-semibold drop-shadow">
                          React + APIs
                        </div>
                      </div>

                      <div className="relative rounded-2xl overflow-hidden group">
                        <img
                          src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=70"
                          alt="Data Science" className="h-full w-full object-cover" onError={onImgErr}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold shadow">
                          <i className="fa-solid fa-chart-line mr-1 text-blue-600" /> Data Science
                        </div>
                        <div className="absolute bottom-2 left-2 text-white text-sm font-semibold drop-shadow">
                          Python + ML
                        </div>
                      </div>

                      <div className="relative rounded-2xl overflow-hidden group">
                        <img
                          src="https://images.unsplash.com/photo-1559027615-5f5c6f2cf5a0?auto=format&fit=crop&w=800&q=70"
                          alt="UI/UX Design" className="h-full w-full object-cover" onError={onImgErr}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold shadow">
                          <i className="fa-solid fa-pen-ruler mr-1 text-purple-600" /> UI/UX
                        </div>
                        <div className="absolute bottom-2 left-2 text-white text-sm font-semibold drop-shadow">
                          Figma to App
                        </div>
                      </div>

                      <div className="relative rounded-2xl bg-white ring-1 ring-gray-200 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-800">ECA Certificate</div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gradient-to-r from-pink-500 to-blue-500 px-2.5 py-1 rounded-full shadow">
                            <i className="fa-solid fa-award" /> Verified
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-gray-600">
                          Awarded to <span className="font-semibold text-gray-900">Your Name</span> for completing:
                          <div className="mt-1 font-medium text-gray-900">React Bootcamp</div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-xs text-gray-500">ID: ECA-2024-RB-1024</div>
                          <div className="flex items-center gap-2 text-xs">
                            <i className="fa-solid fa-shield-halved text-green-600" />
                            <span className="text-gray-600">Blockchain logged</span>
                          </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-r from-pink-200 to-blue-200 blur-2xl opacity-60 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold hero-bubble">
                  <i className="fa-solid fa-certificate mr-2" /> Certificate Ready
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white px-4 py-2 rounded-full text-sm font-semibold shadow hero-bubble">
                  <i className="fa-solid fa-clock mr-2 text-pink-500" /> Learn at your pace
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT (unchanged) */}
        <section id="about" className="py-16 bg-white/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 fade-in">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">Why Choose ECA Academy?</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                We're committed to providing world-class education that transforms careers and lives
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center fade-in-delay-1 card-hover bg-white rounded-2xl p-8 shadow-lg">
                <div className="bg-gradient-to-r from-pink-500 to-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-chalkboard-teacher text-white text-2xl" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Expert Instructors</h3>
                <p className="text-gray-600">Learn from industry professionals with years of real-world experience</p>
              </div>
              <div className="text-center fade-in-delay-2 card-hover bg-white rounded-2xl p-8 shadow-lg">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-clock text-white text-2xl" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Flexible Learning</h3>
                <p className="text-gray-600">Study at your own pace with 24/7 access to course materials</p>
              </div>
              <div className="text-center fade-in-delay-3 card-hover bg-white rounded-2xl p-8 shadow-lg">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-certificate text-white text-2xl" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Certified Programs</h3>
                <p className="text-gray-600">Earn recognized certificates to boost your career prospects</p>
              </div>

              {/* Learn more CTA → dedicated About screen (your About.tsx) */}
              <div className="mt-10 fade-in col-span-full flex justify-center">
                <button
                  onClick={goAboutPage}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:shadow-2xl transition-all group"
                >
                  <i className="fa-solid fa-circle-info" />
                  <span>Learn More About Us?</span>
                  <i className="fa-solid fa-arrow-right ml-1 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* COURSES (unchanged design) */}
        <section id="courses" className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 fade-in">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">Featured Courses</h2>
              <p className="text-xl text-gray-600">Discover our most popular and highly-rated courses</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <button className="course-filter active bg-gradient-to-r from-pink-500 to-blue-500 text-white px-6 py-3 rounded-full font-semibold" data-category="all">
                All Courses
              </button>
              <button className="course-filter bg-white text-gray-700 px-6 py-3 rounded-full font-semibold hover:bg-pink-50 transition-all" data-category="paid">
                Premium Courses
              </button>
              <button className="course-filter bg-white text-gray-700 px-6 py-3 rounded-full font-semibold hover:bg-pink-50 transition-all" data-category="free">
                Free Courses
              </button>
            </div>

            {/* Cards preserved from your HTML (omitted here for brevity’s sake in explanation) */}
            {/* ↓↓↓ Paste the six course cards from your HTML here exactly as-is, changing only onError={onImgErr} on <img> tags ↓↓↓ */}

<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
  {/* Premium Course 1 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="paid">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80"
        alt="Web Development Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Premium
      </div>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-gray-800">
        $99
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Complete Web Development</h3>
      <p className="text-gray-600 mb-4">Master HTML, CSS, JavaScript, and React from scratch</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.9 (2.1k)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          40 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Enroll Now
      </button>
    </div>
  </div>

  {/* Premium Course 2 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="paid">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80"
        alt="Data Science Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Premium
      </div>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-gray-800">
        $149
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Data Science Mastery</h3>
      <p className="text-gray-600 mb-4">Learn Python, Machine Learning, and Data Analysis</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.8 (1.8k)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          60 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Enroll Now
      </button>
    </div>
  </div>

  {/* Free Course 1 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="free">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=400&q=80"
        alt="Digital Marketing Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Free
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Digital Marketing Basics</h3>
      <p className="text-gray-600 mb-4">Introduction to SEO, Social Media, and Content Marketing</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.7 (950)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          15 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-green-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Start Free
      </button>
    </div>
  </div>

  {/* Premium Course 3 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="paid">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80"
        alt="UI/UX Design Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Premium
      </div>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-gray-800">
        $89
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">UI/UX Design Pro</h3>
      <p className="text-gray-600 mb-4">Create stunning user interfaces and experiences</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.9 (1.5k)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          35 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Enroll Now
      </button>
    </div>
  </div>

  {/* Free Course 2 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="free">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80"
        alt="Business Fundamentals Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Free
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Business Fundamentals</h3>
      <p className="text-gray-600 mb-4">Essential business concepts for entrepreneurs</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.6 (720)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          12 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-green-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Start Free
      </button>
    </div>
  </div>

  {/* Free Course 3 */}
  <div className="course-card card-hover rounded-2xl overflow-hidden shadow-lg course-item" data-category="free">
    <div className="relative">
      <img
        src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=400&q=80"
        alt="Photography Basics Course"
        className="w-full h-48 object-cover"
        onError={onImgErr}
      />
      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        Free
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Photography Basics</h3>
      <p className="text-gray-600 mb-4">Learn the fundamentals of digital photography</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-yellow-500">
          <i className="fas fa-star" />
          <span className="ml-1 text-gray-700">4.5 (680)</span>
        </div>
        <div className="text-gray-600">
          <i className="fas fa-clock mr-1" />
          10 hours
        </div>
      </div>
      <button
        type="button"
        className="w-full bg-green-500 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all"
      >
        Start Free
      </button>
    </div>
  </div>
</div>
          </div>
        </section>

        {/* NEWSLETTER */}
        <section className="py-16 bg-gradient-to-r from-pink-500 to-blue-500">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="fade-in">
              <h2 className="text-4xl font-bold text-white mb-4">Stay Updated with New Courses</h2>
              <p className="text-xl text-white/90 mb-8">
                Get notified about new courses, special offers, and learning tips delivered to your inbox
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  id="newsletterEmail" type="email" placeholder="Enter your email"
                  className="flex-1 px-6 py-4 rounded-full text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white/30"
                />
                <button
                  onClick={() => alert("Thank you for subscribing! You'll receive updates about new courses and offers.")}
                  className="bg-white text-pink-500 px-8 py-4 rounded-full font-semibold hover:shadow-lg transition-all"
                >
                  Subscribe
                </button>
              </div>
              <p className="text-white/80 text-sm mt-4">No spam, unsubscribe anytime</p>
            </div>
          </div>
        </section>

        {/* RECOMMENDATIONS (unchanged) */}
        <section id="contact" className="py-16 bg-white/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 fade-in">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">Recommended for You</h2>
              <p className="text-xl text-gray-600">Based on your interests and learning goals</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: "fa-code", title: "Advanced JavaScript", desc: "Master ES6+ features" },
                { icon: "fa-mobile-alt", title: "Mobile App Development", desc: "Build iOS & Android apps" },
                { icon: "fa-brain", title: "AI & Machine Learning", desc: "Future of technology" },
                { icon: "fa-chart-line", title: "Digital Analytics", desc: "Data-driven decisions" },
              ].map((c, i) => (
                <div key={i} className="card-hover bg-white rounded-xl p-6 shadow-lg text-center">
                  <div className="bg-gradient-to-r from-pink-500 to-blue-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className={`fas ${c.icon} text-white`} />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">{c.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{c.desc}</p>
                  <button className="text-pink-500 font-semibold hover:text-pink-600 transition-colors">
                    Learn More →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER (unchanged) */}
        <footer className="bg-gray-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent mb-4">
                  ECA Academy
                </div>
                <p className="text-gray-400 mb-6">
                  Empowering learners worldwide with quality education and practical skills for the digital age.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors"><i className="fab fa-facebook-f" /></a>
                  <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors"><i className="fab fa-twitter" /></a>
                  <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors"><i className="fab fa-linkedin-in" /></a>
                  <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors"><i className="fab fa-instagram" /></a>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Courses</h3>
                <ul className="space-y-2 text-gray-400">
                  <li><a href="#" className="hover:text-white transition-colors">Web Development</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Data Science</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">UI/UX Design</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Digital Marketing</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Support</h3>
                <ul className="space-y-2 text-gray-400">
                  <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-gray-400">
                  <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
              <p>&copy; {new Date().getFullYear()} ECA Academy. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    {joinOpen && createPortal(<JoinNowModal onClose={() => setJoinOpen(false)} />, document.body)}
    </>
  );
}
