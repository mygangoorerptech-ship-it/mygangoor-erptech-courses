import React from "react";

const Footer: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <footer className={`bg-[#1e1f21] text-gray-300 ${className}`}>
      {/* Top Section */}
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* ABOUT US */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-6 uppercase tracking-wide">
              Abouts Us
            </h4>

            <p className="text-sm leading-7 mb-6">
              M.Y. Gangoor Global Foundation is a holistic education and research
              centre dedicated to spiritual sciences, natural healing, and
              conscious living.
            </p>

            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-pink-500 text-lg mt-0.5">
                  <i className="fas fa-map-marker-alt"></i>
                </span>
                <span>
                  M.Y.Gangoor Global Foundation®, Angol Road,
                  <br />
                  Belagavi, Karnataka, India
                </span>
              </li>

              <li className="flex items-center gap-3">
                <span className="text-pink-500 text-lg">
                  <i className="fas fa-phone-alt"></i>
                </span>
                <span>+91 8496976263</span>
              </li>

              <li className="flex items-center gap-3">
                <span className="text-pink-500 text-lg">
                  <i className="fas fa-phone-alt"></i>
                </span>
                <span>+91 9845290825</span>
              </li>

              <li className="flex items-center gap-3">
                <span className="text-pink-500 text-lg">
                  <i className="fas fa-envelope"></i>
                </span>
                <span>rameshgangoor@gmail.com</span>
              </li>
            </ul>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-6 uppercase tracking-wide">
              Quick Links
            </h4>

            <ul className="space-y-4 text-sm">
              {[
                "Join Us",
                "About Us",
                "Courses",
                "Events",
                "Blogs",
                "Contact Us",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-white text-lg">{">"}</span>
                  <a
                    href="#"
                    className="hover:text-white transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* STAY CONNECTED */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-6 uppercase tracking-wide">
              Stay Connected
            </h4>

            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-md bg-[#2a2b2d] flex items-center justify-center hover:bg-[#3b5998] transition"
              >
                <i className="fab fa-facebook-f text-white"></i>
              </a>

              <a
                href="#"
                className="w-10 h-10 rounded-md bg-[#2a2b2d] flex items-center justify-center hover:bg-[#ff0000] transition"
              >
                <i className="fab fa-youtube text-white"></i>
              </a>

              <a
                href="#"
                className="w-10 h-10 rounded-md bg-[#2a2b2d] flex items-center justify-center hover:bg-[#e1306c] transition"
              >
                <i className="fab fa-instagram text-white"></i>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-600 opacity-40"></div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between text-sm">
        <p className="text-center md:text-left">
          © 2026 M.Y. Gangoor Global Foundation’s®. All Rights Reserved.
          <br className="md:hidden" />
          <span className="ml-1">
            Designed & Developed by{" "}
            <span className="text-pink-500">NexioGlobal</span>
          </span>
        </p>

        <div className="flex gap-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-white transition">
            Terms of use
          </a>
          <a href="#" className="hover:text-white transition">
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Subtle Background Motif */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('/static/assets/images/lotus-bg.png')] bg-center bg-no-repeat bg-contain"></div>
    </footer>
  );
};

export default Footer;