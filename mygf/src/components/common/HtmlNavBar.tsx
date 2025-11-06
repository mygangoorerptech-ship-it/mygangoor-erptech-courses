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
      
      /* Ensure navbar items are visible */
      .header_wrap.dark_skin .navbar-nav > li > .nav-link,
      .header_wrap.dark_skin .navbar-nav > li > a {
        color: #DB9EC3 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      .header_wrap.dark_skin .navbar-nav > li > .nav-link:hover,
      .header_wrap.dark_skin .navbar-nav > li > a:hover,
      .header_wrap.dark_skin .navbar-nav > li > .nav-link.active,
      .header_wrap.dark_skin .navbar-nav > li > a.active {
        color: #DB9EC3 !important;
        opacity: 1 !important;
      }
      
      .header_wrap .navbar-nav {
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .header_wrap .navbar-nav > li {
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Ensure dropdown menu items are visible */
      .header_wrap.dark_skin .navbar-nav .dropdown-menu .nav-link,
      .header_wrap.dark_skin .navbar-nav .dropdown-menu .dropdown-item,
      .header_wrap.dark_skin .navbar-nav .dropdown-menu a {
        color: #333333 !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .header_wrap.dark_skin .navbar-nav .dropdown-menu .nav-link:hover,
      .header_wrap.dark_skin .navbar-nav .dropdown-menu .dropdown-item:hover,
      .header_wrap.dark_skin .navbar-nav .dropdown-menu a:hover {
        color: #d32f2f !important;
      }
      
      /* Ensure navbar toggler is visible */
      .header_wrap .navbar-toggler {
        color: #000000 !important;
        border-color: rgba(0, 0, 0, 0.3) !important;
      }
      
      .header_wrap .navbar-toggler .ion-android-menu {
        color: #000000 !important;
      }
      
      /* Ensure dashboard icon is visible */
      .header_wrap .attr-nav .nav-link.dashboard {
        color: #000000 !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .header_wrap .attr-nav .nav-link.dashboard:hover {
        color: #000000 !important;
        opacity: 0.8 !important;
      }
      
      .header_wrap .attr-nav .nav-link.dashboard i {
        color: #000000 !important;
        visibility: visible !important;
      }
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
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">About Us</a>
                <div className="dropdown-menu">
                  <ul> 
                    <li><a className="dropdown-item nav-link nav_item" href="/static/about.html">About Us</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/tracks">Courses</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/events.html">Events</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/our-sister-concern.html">Our Sister Concerns</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/our-global-ambassadors.html">Our Global Ambassadors</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="#">Our Researchers</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/gallery-three-columns.html">Photo/Video Gallery</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/gallery-four-columns.html">Press/Media</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="#">Reviews</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/coming-soon.html">Coming Soon</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/contact.html">Contact Us</a></li>
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
              <li>
                <a className="nav-link" href="/static/contact.html">Contact</a>
              </li>
            </ul>
          </div>
          <ul className="navbar-nav attr-nav align-items-center">
            <li id="dashboardNavItem" style={{ display: 'none' }}>
              <a href="javascript:void(0);" className="nav-link dashboard" onClick={(e) => {
                e.preventDefault();
                const handleDashboardClick = (window as unknown as { handleDashboardClick?: (event: Event) => void }).handleDashboardClick;
                if (handleDashboardClick) {
                  handleDashboardClick(e.nativeEvent);
                } else {
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