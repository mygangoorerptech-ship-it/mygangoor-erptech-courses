// mygf/src/components/common/HtmlNavBar.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/store";

export default function HtmlNavBar() {
  const navigate = useNavigate();
  const role = useAuth(s => s.user?.role);
  const isAuthenticated = useAuth(s => !!s.user);

  useEffect(() => {
    // Load notification bell script for bottom right corner
    const loadNotificationBell = () => {
      // Check if script is already loaded
      const existingScript = document.getElementById('notification-bell-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'notification-bell-script';
        script.src = '/static/notification-bell-standalone.js';
        script.async = true;
        document.body.appendChild(script);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(loadNotificationBell, 100);

    // Initialize Bootstrap dropdowns after component mounts
    const initializeDropdowns = () => {
      // Use direct DOM manipulation to ensure dropdowns work
      const dropdownToggles = document.querySelectorAll('[data-toggle="dropdown"]');
      dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          const dropdown = toggle.nextElementSibling as HTMLElement;
          if (dropdown && dropdown.classList.contains('dropdown-menu')) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
          }
        });
      });

      // Also try jQuery initialization if available
      const jQuery = (window as unknown as { $?: unknown }).$;
      if (jQuery && typeof jQuery === 'function') {
        try {
          (jQuery as unknown as { (selector: string): { dropdown: () => void } })('[data-toggle="dropdown"]').dropdown();
        } catch {
          console.log('jQuery dropdown initialization failed, using manual approach');
        }
      }
    };

    // Try to initialize immediately
    initializeDropdowns();

    // Also try after a delay to ensure everything is loaded
    const timeoutId1 = setTimeout(initializeDropdowns, 100);
    const timeoutId2 = setTimeout(initializeDropdowns, 500);

    // Handle dashboard click functionality
    const handleDashboardClick = (event: Event) => {
      event.preventDefault();
      if (isAuthenticated) {
        if (role && /^org/i.test(String(role))) {
          navigate("/dashboard");
          return;
        }
        switch (role) {
          case "superadmin": navigate("/superadmin"); break;
          case "admin": navigate("/admin"); break;
          case "vendor": navigate("/vendor"); break;
          case "student": navigate("/dashboard"); break;
          default: navigate("/dashboard");
        }
      } else {
        navigate("/login");
      }
    };

    // Expose global function for HTML navbar
    (window as unknown as { handleDashboardClick?: (event: Event) => void }).handleDashboardClick = handleDashboardClick;

    // Show/hide dashboard nav item based on authentication
    const dashboardNavItem = document.getElementById('dashboardNavItem');
    if (dashboardNavItem) {
      dashboardNavItem.style.display = isAuthenticated ? 'block' : 'none';
    }

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      const windowWithHandler = window as unknown as { handleDashboardClick?: (event: Event) => void };
      if (windowWithHandler.handleDashboardClick === handleDashboardClick) {
        delete windowWithHandler.handleDashboardClick;
      }
    };
  }, [isAuthenticated, role, navigate]);

  return (
    <>
    <style>{`
      .header_wrap .navbar-brand img { height: 48px; width: auto; }
      @media (max-width: 576px) { .header_wrap .navbar-brand img { height: 38px; } }
    `}</style>
    <header className="header_wrap fixed-top dark_skin main_menu_uppercase main_menu_weight_600 transparent_header">
      <div className="container">
        <nav className="navbar navbar-expand-lg"> 
          <a className="navbar-brand" href="/home">
            <img className="logo_light" src="/static/assets/images/logo_white.png" alt="logo" />
            <img className="logo_dark" src="/static/assets/images/logo_dark.png" alt="logo" />
            <img className="logo_default" src="/static/assets/images/logo_dark.png" alt="logo" />
          </a>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation"> 
            <span className="ion-android-menu"></span> 
          </button>
          <div className="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
            <ul className="navbar-nav">
              <li>
                <a className="nav-link active" href="/home">Home</a>
              </li>
              <li>
                <a className="nav-link" href="/static/schedule.html">Schedule</a>
              </li>
              <li className="dropdown">
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">Pages</a>
                <div className="dropdown-menu">
                  <ul> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/about.html">About Us</a></li>
                    <li><a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Team</a>
                      <div className="dropdown-menu">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="/static//static/team.html">Team</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static/team-single.html">Team Single</a></li>
                        </ul>
                      </div>
                    </li>
                    <li><a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Classes</a>
                      <div className="dropdown-menu">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="/tracks" onClick={(e) => { e.preventDefault(); navigate("/tracks"); }}>All Classes</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static/classes-details.html">Classes Details</a></li>
                        </ul>
                      </div>
                    </li>
                    <li><a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Events</a>
                      <div className="dropdown-menu">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="/static//static//static/events.html">All Events</a></li> 
                          <li><a className="dropdown-item nav-link nav_item" href="/static/events-details.html">Events Details</a></li> 
                        </ul>
                      </div>
                    </li>
                    <li><a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Gallery</a>
                      <div className="dropdown-menu">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="/static//static/gallery-three-columns.html">Grid 3 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static//static/gallery-four-columns.html">Grid 4 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static/gallery-masonry-three-columns.html">Masonry 3 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static/gallery-masonry-four-columns.html">Masonry 4 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="/static/gallery-detail.html">Gallery Detail</a></li>
                        </ul>
                      </div>
                    </li>  
                    <li><a className="dropdown-item nav-link nav_item" href="/static/faq.html">FAQ</a></li> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/coming-soon.html">Coming Soon</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/404.html">404 Page</a></li>
                  </ul>
                </div>
              </li>
              <li className="dropdown dropdown-mega-menu">
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">Element</a>
                <div className="dropdown-menu">
                  <ul className="mega-menu d-lg-flex">
                    <li className="mega-menu-col col-lg-3">
                      <ul> 
                        <li><a className="dropdown-item nav-link nav_item" href="accordions.html"><i className="ti-layout-accordion-separated"></i> Accordions</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="blockquotes.html"><i className="ti-quote-left"></i> Blockquotes</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="buttons.html"><i className="ti-mouse"></i> Buttons</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="call-to-action.html"><i className="ti-headphone-alt"></i> Call to Action</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="columns.html"><i className="ti-layout-column3-alt"></i> Columns</a></li>
                      </ul>
                    </li>
                    <li className="mega-menu-col col-lg-3">
                      <ul>
                        <li><a className="dropdown-item nav-link nav_item" href="countdown.html"><i className="ti-alarm-clock"></i> Countdown</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="counter.html"><i className="ti-timer"></i> Counters</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="form-controls.html"><i className="ti-clipboard"></i> Form Controls</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="heading.html"><i className="ti-text"></i> Heading</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="highlights.html"><i className="ti-underline"></i> Highligts</a></li> 
                      </ul>
                    </li>
                    <li className="mega-menu-col col-lg-3">
                      <ul>
                        <li><a className="dropdown-item nav-link nav_item" href="icon-boxes.html"><i className="ti-widget"></i> Icon Boxes</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="lists.html"><i className="ti-list"></i> Lists</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="maps.html"><i className="ti-map-alt"></i> Maps</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="pricing-table.html"><i className="ti-layout-column3"></i> Pricing Table</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="progress-bars.html"><i className="ti-layout-list-post"></i> Progress Bars</a></li>
                      </ul>
                    </li>
                    <li className="mega-menu-col col-lg-3">
                      <ul>
                        <li><a className="dropdown-item nav-link nav_item" href="subscribe.html"><i className="ti-bookmark"></i> Subscribe</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="tab.html"><i className="ti-layout-accordion-separated"></i> Tab</a></li> 
                        <li><a className="dropdown-item nav-link nav_item" href="testimonial.html"><i className="ti-layout-slider-alt"></i> Testimonials</a></li>
                        <li><a className="dropdown-item nav-link nav_item" href="tooltips-popovers.html"><i className="ti-comment-alt"></i> Tooltip Popovers</a></li> 
                      </ul>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="dropdown">
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">Blog</a>
                <div className="dropdown-menu">
                  <ul>
                    <li>
                      <a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Blog Layout</a>
                      <div className="dropdown-menu dropdown-reverse">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-standard-left-sidebar.html">Blog Standard Left Sidebar</a></li> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-standard-right-sidebar.html">Blog Standard Right Sidebar</a></li> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-three-columns.html">Blog 3 Columns </a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-four-columns.html">Blog 4 Columns</a></li>
                        </ul>
                      </div>
                    </li>
                    <li>
                      <a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Blog Masonry</a>
                      <div className="dropdown-menu dropdown-reverse">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-masonry-three-columns.html">Masonry 3 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-masonry-four-columns.html">Masonry 4 Columns</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-masonry-left-sidebar.html">Masonry Left Sidebar</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-masonry-right-sidebar.html">Masonry Right Sidebar</a></li>
                        </ul>
                      </div>
                    </li>
                    <li>
                      <a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Blog List</a>
                      <div className="dropdown-menu dropdown-reverse">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-list-left-sidebar.html">Left Sidebar</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-list-right-sidebar.html">Right Sidabar</a></li>
                        </ul>
                      </div>
                    </li>
                    <li>
                      <a className="dropdown-item nav-link nav_item dropdown-toggler" href="#">Sinlge Post</a>
                      <div className="dropdown-menu dropdown-reverse">
                        <ul> 
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single.html">Default</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single-left-sidebar.html">Left Sidebar</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single-right-sidebar.html">Right Sidebar</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single-slider.html">Slider Post</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single-video.html">Video post</a></li>
                          <li><a className="dropdown-item nav-link nav_item" href="blog-single-audio.html">Audio Post</a></li>
                        </ul>
                      </div>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="dropdown">
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">Shop</a>
                <div className="dropdown-menu">
                  <ul> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/shop.html">Shop List</a></li> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/product-details.html">Product Detail</a></li> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/cart.html">Cart</a></li> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/checkout.html">Checkout</a></li> 
                  </ul>
                </div>
              </li>
              <li>
                <a className="nav-link" href="/static/contact.html">Contact</a>
              </li>
            </ul>
          </div>
          <ul className="navbar-nav attr-nav align-items-center">
            <li id="dashboardNavItem" style={{ display: 'none' }}>
              <a href="javascript:void(0);" className="nav-link dashboard" onClick={(e) => {
                e.preventDefault();
                if (isAuthenticated) {
                  if (role && /^org/i.test(String(role))) {
                    navigate("/dashboard");
                    return;
                  }
                  switch (role) {
                    case "superadmin": navigate("/superadmin"); break;
                    case "admin": navigate("/admin"); break;
                    case "vendor": navigate("/vendor"); break;
                    case "student": navigate("/dashboard"); break;
                    default: navigate("/dashboard");
                  }
                } else {
                  navigate("/login");
                }
              }} title="Dashboard">
                <i className="ion-person"></i>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
    {/* Notification Bell Mount Point */}
    <div id="notification-bell-mount"></div>
    </>
  );
}