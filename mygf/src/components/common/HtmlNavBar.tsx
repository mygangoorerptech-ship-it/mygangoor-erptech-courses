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

    // Improved dropdown initialization with hover support
    const hoverTimeouts = new Map<HTMLElement, NodeJS.Timeout>();
    let activeDropdown: HTMLElement | null = null;
    const handlers = new WeakMap<HTMLElement, { enter: () => void; leave: () => void }>();

    const closeAllDropdowns = (except?: HTMLElement) => {
      const allDropdowns = document.querySelectorAll('.dropdown-menu');
      allDropdowns.forEach((dropdown) => {
        const dropdownEl = dropdown as HTMLElement;
        if (dropdownEl !== except) {
          dropdownEl.style.display = 'none';
          dropdownEl.classList.remove('show');
          // Close nested dropdowns
          const nestedDropdowns = dropdownEl.querySelectorAll('.dropdown-menu');
          nestedDropdowns.forEach((nested) => {
            (nested as HTMLElement).style.display = 'none';
            nested.classList.remove('show');
          });
        }
      });
    };

    const initializeDropdowns = () => {
      const dropdownItems = document.querySelectorAll('.dropdown');
      
      dropdownItems.forEach((item) => {
        const dropdownToggle = item.querySelector('[data-toggle="dropdown"]') as HTMLElement;
        const dropdownMenu = item.querySelector('.dropdown-menu') as HTMLElement;
        
        if (!dropdownToggle || !dropdownMenu) return;

        // Clean up existing timeouts
        const existingTimeout = hoverTimeouts.get(item);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          hoverTimeouts.delete(item);
        }

        // Remove existing handlers if any
        const existingHandlers = handlers.get(item);
        if (existingHandlers) {
          dropdownToggle.removeEventListener('mouseenter', existingHandlers.enter);
          dropdownToggle.removeEventListener('mouseleave', existingHandlers.leave);
          dropdownMenu.removeEventListener('mouseenter', existingHandlers.enter);
          dropdownMenu.removeEventListener('mouseleave', existingHandlers.leave);
          item.removeEventListener('mouseenter', existingHandlers.enter);
          item.removeEventListener('mouseleave', existingHandlers.leave);
        }

        // Set initial z-index for proper layering
        const depth = Array.from(item.parentElement?.querySelectorAll('.dropdown') || []).indexOf(item);
        dropdownMenu.style.zIndex = String(1050 + depth);

        // Hover enter handler
        const handleMouseEnter = () => {
          // Clear any existing timeout
          const timeout = hoverTimeouts.get(item);
          if (timeout) {
            clearTimeout(timeout);
            hoverTimeouts.delete(item);
          }

          // Close other dropdowns first
          if (activeDropdown !== dropdownMenu) {
            closeAllDropdowns(dropdownMenu);
            activeDropdown = dropdownMenu;
          }

          // Small delay before opening to prevent flicker
          const openTimeout = setTimeout(() => {
            dropdownMenu.style.display = 'block';
            dropdownMenu.classList.add('show');
            activeDropdown = dropdownMenu;
          }, 100);

          hoverTimeouts.set(item, openTimeout);
        };

        // Hover leave handler
        const handleMouseLeave = () => {
          // Clear open timeout if exists
          const openTimeout = hoverTimeouts.get(item);
          if (openTimeout) {
            clearTimeout(openTimeout);
            hoverTimeouts.delete(item);
          }

          // Delay closing to allow moving to menu
          const closeTimeout = setTimeout(() => {
            // Check if mouse is still over dropdown area
            const isOverItem = item.matches(':hover');
            const isOverMenu = dropdownMenu.matches(':hover');
            const isOverToggle = dropdownToggle.matches(':hover');
            
            if (!isOverItem && !isOverMenu && !isOverToggle) {
              dropdownMenu.style.display = 'none';
              dropdownMenu.classList.remove('show');
              if (activeDropdown === dropdownMenu) {
                activeDropdown = null;
              }
              // Close nested dropdowns
              const nestedDropdowns = dropdownMenu.querySelectorAll('.dropdown-menu');
              nestedDropdowns.forEach((nested) => {
                (nested as HTMLElement).style.display = 'none';
                nested.classList.remove('show');
              });
            }
          }, 150);

          hoverTimeouts.set(item, closeTimeout);
        };

        // Store handlers for cleanup
        handlers.set(item, { enter: handleMouseEnter, leave: handleMouseLeave });

        // Add event listeners
        dropdownToggle.addEventListener('mouseenter', handleMouseEnter);
        dropdownToggle.addEventListener('mouseleave', handleMouseLeave);
        dropdownMenu.addEventListener('mouseenter', handleMouseEnter);
        dropdownMenu.addEventListener('mouseleave', handleMouseLeave);
        item.addEventListener('mouseenter', handleMouseEnter);
        item.addEventListener('mouseleave', handleMouseLeave);

        // Handle nested dropdowns (dropdown-toggler items)
        const nestedTogglers = dropdownMenu.querySelectorAll('.dropdown-toggler');
        const nestedHandlers = new WeakMap<HTMLElement, { enter: () => void; leave: () => void }>();
        
        nestedTogglers.forEach((toggler) => {
          const togglerEl = toggler as HTMLElement;
          const parentLi = togglerEl.closest('li') as HTMLElement;
          const nestedMenu = togglerEl.nextElementSibling as HTMLElement;

          if (!nestedMenu || !nestedMenu.classList.contains('dropdown-menu')) return;

          // Set higher z-index for nested menus
          const siblingIndex = Array.from(parentLi.parentElement?.children || []).indexOf(parentLi);
          nestedMenu.style.zIndex = String(1100 + siblingIndex);
          nestedMenu.style.position = 'absolute';
          nestedMenu.style.top = '0';
          nestedMenu.style.left = '100%';

          let nestedTimeout: NodeJS.Timeout | null = null;

          const handleNestedEnter = () => {
            // Clear any pending timeout
            if (nestedTimeout) {
              clearTimeout(nestedTimeout);
              nestedTimeout = null;
            }

            // Close other nested menus in same parent
            if (parentLi.parentElement) {
              parentLi.parentElement.querySelectorAll('li').forEach((sibling) => {
                if (sibling !== parentLi) {
                  const siblingMenu = sibling.querySelector('.dropdown-menu');
                  if (siblingMenu && siblingMenu.classList.contains('dropdown-reverse')) {
                    (siblingMenu as HTMLElement).style.display = 'none';
                    siblingMenu.classList.remove('show');
                  }
                }
              });
            }
            nestedMenu.style.display = 'block';
            nestedMenu.classList.add('show');
          };

          const handleNestedLeave = () => {
            nestedTimeout = setTimeout(() => {
              const isOverLi = parentLi.matches(':hover');
              const isOverMenu = nestedMenu.matches(':hover');
              const isOverToggler = togglerEl.matches(':hover');
              
              if (!isOverLi && !isOverMenu && !isOverToggler) {
                nestedMenu.style.display = 'none';
                nestedMenu.classList.remove('show');
                nestedTimeout = null;
              }
            }, 150);
          };

          // Remove existing nested handlers if any
          const existingNestedHandlers = nestedHandlers.get(parentLi);
          if (existingNestedHandlers) {
            togglerEl.removeEventListener('mouseenter', existingNestedHandlers.enter);
            parentLi.removeEventListener('mouseenter', existingNestedHandlers.enter);
            nestedMenu.removeEventListener('mouseenter', existingNestedHandlers.enter);
            togglerEl.removeEventListener('mouseleave', existingNestedHandlers.leave);
            parentLi.removeEventListener('mouseleave', existingNestedHandlers.leave);
            nestedMenu.removeEventListener('mouseleave', existingNestedHandlers.leave);
          }

          // Store nested handlers
          nestedHandlers.set(parentLi, { enter: handleNestedEnter, leave: handleNestedLeave });

          // Add nested event listeners
          togglerEl.addEventListener('mouseenter', handleNestedEnter);
          parentLi.addEventListener('mouseenter', handleNestedEnter);
          nestedMenu.addEventListener('mouseenter', handleNestedEnter);
          togglerEl.addEventListener('mouseleave', handleNestedLeave);
          parentLi.addEventListener('mouseleave', handleNestedLeave);
          nestedMenu.addEventListener('mouseleave', handleNestedLeave);
        });
      });
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
        window.location.assign("/login.html");
      }
    };

    // Expose global function for HTML navbar
    (window as unknown as { handleDashboardClick?: (event: Event) => void }).handleDashboardClick = handleDashboardClick;

    // Show/hide dashboard nav item based on authentication
    const dashboardNavItem = document.getElementById('dashboardNavItem');
    if (dashboardNavItem) {
      dashboardNavItem.style.display = isAuthenticated ? 'list-item' : 'none';
    }

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      // Clear all hover timeouts
      hoverTimeouts.forEach((timeout) => clearTimeout(timeout));
      hoverTimeouts.clear();
      activeDropdown = null;
      closeAllDropdowns();
      // Remove all event listeners by removing handlers from stored elements
      const dropdownItems = document.querySelectorAll('.dropdown');
      dropdownItems.forEach((item) => {
        const existingHandlers = handlers.get(item as HTMLElement);
        if (existingHandlers) {
          const dropdownToggle = item.querySelector('[data-toggle="dropdown"]') as HTMLElement;
          const dropdownMenu = item.querySelector('.dropdown-menu') as HTMLElement;
          if (dropdownToggle && dropdownMenu) {
            dropdownToggle.removeEventListener('mouseenter', existingHandlers.enter);
            dropdownToggle.removeEventListener('mouseleave', existingHandlers.leave);
            dropdownMenu.removeEventListener('mouseenter', existingHandlers.enter);
            dropdownMenu.removeEventListener('mouseleave', existingHandlers.leave);
            item.removeEventListener('mouseenter', existingHandlers.enter);
            item.removeEventListener('mouseleave', existingHandlers.leave);
          }
        }
      });
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
      
      /* Dropdown menu improvements */
      .header_wrap .navbar-nav .dropdown {
        position: relative;
      }
      
      .header_wrap .navbar-nav > li.dropdown {
        position: relative;
      }
      
      .header_wrap .navbar-nav .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        display: none;
        margin-top: 0;
        padding: 0;
        min-width: 200px;
        pointer-events: auto;
        transform: translateX(0);
      }
      
      .header_wrap .navbar-nav .dropdown-menu.show {
        display: block !important;
      }
      
      /* Ensure dropdown is aligned with parent navbar item */
      .header_wrap .navbar-nav > li.dropdown > .dropdown-menu {
        left: 0;
        right: auto;
        transform: translateX(0);
      }
      
      /* Ensure dropdown menu items are properly contained */
      .header_wrap .navbar-nav .dropdown-menu ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      
      /* Prevent overlapping with proper positioning */
      .header_wrap .navbar-nav .dropdown-menu li {
        position: relative;
        display: block;
      }
      
      /* Ensure dropdown menu appears below navbar */
      .header_wrap .navbar-nav > li > .dropdown-menu {
        margin-top: 0;
        top: 100%;
      }
      
      /* Nested dropdown menu positioning - default to right side */
      .header_wrap .navbar-nav .dropdown-menu .dropdown-menu {
        position: absolute;
        top: 0;
        left: 100%;
        right: auto;
        margin-left: 0;
        margin-top: 0;
        min-width: 200px;
      }
      
      /* Ensure nested dropdowns appear on the correct side - reverse for left side */
      .header_wrap .navbar-nav .dropdown-menu.dropdown-reverse {
        right: 100%;
        left: auto;
        margin-right: 0;
        margin-left: 0;
      }
      
      /* Prevent pointer-events interference */
      .header_wrap .navbar-nav .dropdown-menu a {
        pointer-events: auto;
        cursor: pointer;
        display: block;
      }
      
      /* Smooth transitions */
      .header_wrap .navbar-nav .dropdown-menu {
        transition: opacity 0.15s ease, visibility 0.15s ease;
      }
      
      /* Ensure proper stacking context */
      .header_wrap .navbar-nav > li.dropdown > .dropdown-menu {
        z-index: 1050;
      }
      
      .header_wrap .navbar-nav .dropdown-menu .dropdown-menu {
        z-index: 1051;
      }
      
      /* Prevent dropdowns from overlapping */
      .header_wrap .navbar-nav .dropdown-menu {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      /* Ensure nested dropdown parent item stays highlighted */
      .header_wrap .navbar-nav .dropdown-menu li:hover {
        background-color: rgba(0, 0, 0, 0.05);
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
          
              </li>
              <li className="dropdown">
                <a className="dropdown-toggle nav-link" href="#" data-toggle="dropdown">About Us</a>
                <div className="dropdown-menu">
                  <ul> 
                    <li><a className="dropdown-item nav-link nav_item" href="/about.html">About Us</a></li>
                    {/* <li><a className="dropdown-item nav-link nav_item" href="/tracks">Courses</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/events.html">Events</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/static/our-sister-concern.html">Our Sister Concerns</a></li> */}
                    <li><a className="dropdown-item nav-link nav_item" href="/our-global-ambassadors.html">Our Global Ambassadors</a></li>
                    {/* <li><a className="dropdown-item nav-link nav_item" href="#">Our Researchers</a></li> */}
                    <li><a className="dropdown-item nav-link nav_item" href="/gallery-three-columns.html">Photo/Video Gallery</a></li>
                    <li><a className="dropdown-item nav-link nav_item" href="/gallery-four-columns.html">Press/Media</a></li>
                    {/* <li><a className="dropdown-item nav-link nav_item" href="#">Reviews</a></li> */}
                  </ul>
                </div>
              </li>
              <li>
                <a className="nav-link" href="/blog-masonry-three-columns.html">Blog</a>
              </li>
              <li>
                <a className="nav-link" href="/contact.html">Contact</a>
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
                    window.location.assign("/login.html");
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