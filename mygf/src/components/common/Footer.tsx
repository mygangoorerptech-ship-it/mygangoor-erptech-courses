import React from "react";

const Footer: React.FC<{ className?: string }> = ({ className = "" }) => {
  const quickLinks = [
    "Join Us",
    "About Us",
    "Courses",
    "Events",
    "Blogs",
    "Contact Us",
  ];

  return (
    <footer
      className={`relative overflow-hidden !bg-[#18191b] !text-white ${className}`}
    >
      {/* Background Motif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('/static/assets/images/lotus-bg.png')] bg-center bg-no-repeat bg-contain"
      />

      {/* Top Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 pt-20 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-24">
          {/* ABOUT US */}
          <div>
            <h4 className="!text-white font-semibold text-lg mb-7 uppercase tracking-wide">
              About Us
            </h4>

            <p className="!text-black text-sm leading-7 mb-8 max-w-md">
              M.Y. Gangoor Global Foundation is a holistic education and
              research centre dedicated to spiritual sciences, natural healing,
              and conscious living.
            </p>

            <ul className="space-y-5 text-sm">
              <li className="flex items-start gap-4">
                <span className="!text-pink-500 text-xl mt-0.5 shrink-0">
                  <i className="fas fa-map-marker-alt" />
                </span>

                <span className="!text-white leading-6">
                  M.Y. Gangoor Global Foundation®, Angol Road,
                  <br />
                  Belagavi, Karnataka, India
                </span>
              </li>

              <li className="flex items-center gap-4">
                <span className="!text-pink-500 text-lg shrink-0">
                  <i className="fas fa-phone-alt" />
                </span>

                <a
                  href="tel:+918496976263"
                  className="!text-white hover:!text-pink-400 transition-colors"
                >
                  +91 8496976263
                </a>
              </li>

              <li className="flex items-center gap-4">
                <span className="!text-pink-500 text-lg shrink-0">
                  <i className="fas fa-phone-alt" />
                </span>

                <a
                  href="tel:+919845290825"
                  className="!text-white hover:!text-pink-400 transition-colors"
                >
                  +91 9845290825
                </a>
              </li>

              <li className="flex items-center gap-4">
                <span className="!text-pink-500 text-lg shrink-0">
                  <i className="fas fa-envelope" />
                </span>

                <a
                  href="mailto:rameshgangoor@gmail.com"
                  className="!text-white break-all hover:!text-pink-400 transition-colors"
                >
                  rameshgangoor@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className="!text-white font-semibold text-lg mb-7 uppercase tracking-wide">
              Quick Links
            </h4>

            <ul className="space-y-4 text-sm">
              {quickLinks.map((item) => (
                <li key={item} className="flex items-center gap-3 group">
                  <span className="!text-pink-500 font-semibold transition-transform group-hover:translate-x-1">
                    &gt;
                  </span>

                  <a
                    href="#"
                    className="!text-white hover:!text-pink-400 transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* STAY CONNECTED */}
          <div>
            <h4 className="!text-white font-semibold text-lg mb-7 uppercase tracking-wide">
              Stay Connected
            </h4>

            <div className="flex gap-4">
              <a
                href="#"
                aria-label="Facebook"
                className="w-11 h-11 rounded-lg bg-[#26282b] border border-white/10 flex items-center justify-center hover:bg-[#3b5998] hover:border-[#3b5998] transition-all duration-200"
              >
                <i className="fab fa-facebook-f !text-white" />
              </a>

              <a
                href="#"
                aria-label="YouTube"
                className="w-11 h-11 rounded-lg bg-[#26282b] border border-white/10 flex items-center justify-center hover:bg-[#ff0000] hover:border-[#ff0000] transition-all duration-200"
              >
                <i className="fab fa-youtube !text-white" />
              </a>

              <a
                href="#"
                aria-label="Instagram"
                className="w-11 h-11 rounded-lg bg-[#26282b] border border-white/10 flex items-center justify-center hover:bg-[#e1306c] hover:border-[#e1306c] transition-all duration-200"
              >
                <i className="fab fa-instagram !text-white" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative z-10 border-t border-white/10" />

      {/* Bottom Bar */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <p className="!text-black text-center md:text-left leading-6">
          © 2026 M.Y. Gangoor Global Foundation®. All Rights Reserved.
          <br className="md:hidden" />
          <span className="md:ml-1 !text-black">
            Designed &amp; Developed by{" "}
            <span className="font-medium !text-pink-500">NexioGlobal</span>
          </span>
        </p>

        <div className="flex gap-6">
          <a href="#" className="!text-white hover:!text-pink-400 transition-colors">
            Terms of use
          </a>

          <a href="#" className="!text-white hover:!text-pink-400 transition-colors">
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;