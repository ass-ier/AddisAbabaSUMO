import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Navigation.css";
import NotificationsBar from "./NotificationsBar";
import RealTimeStatus from "./RealTimeStatus";
import {
  HomeIcon,
  VideoCameraIcon,
  MapIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentTextIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const Navigation = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme;

    // Use system preference by default
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Adjust body margin for sidebar
  useEffect(() => {
    const body = document.body;
    if (window.innerWidth > 768) {
      body.style.marginLeft = menuOpen ? "250px" : "70px";
    } else {
      body.style.marginLeft = "0";
    }

    const handleResize = () => {
      if (window.innerWidth > 768) {
        body.style.marginLeft = menuOpen ? "250px" : "70px";
      } else {
        body.style.marginLeft = "0";
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      body.style.marginLeft = "0";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <NotificationsBar />
      <nav className={`sidebar ${menuOpen ? "expanded" : ""}`}>
        <div className="sidebar-header">
          {/* Top row: Brand and Toggle */}
          <div className="sidebar-header-top">
            <div className="sidebar-brand">
              <span className="brand-icon">
                <ExclamationTriangleIcon />
              </span>
              <span className="brand-text">Traffic System</span>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle sidebar"
              title={menuOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span className="toggle-icon">
                {menuOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </span>
            </button>
          </div>

          {/* Status Section */}
          <div className="sidebar-status">
            <RealTimeStatus showDetails={menuOpen} />
          </div>
        </div>

        <div className="sidebar-menu">
          <Link
            to="/dashboard"
            className={`sidebar-link ${isActive("/dashboard") ? "active" : ""}`}
            onClick={closeMenu}
            title="Dashboard"
          >
            <span className="link-icon">
              <HomeIcon className="w-5 h-5" />
            </span>
            <span className="link-text">Dashboard</span>
          </Link>

          <Link
            to="/traffic-monitoring"
            className={`sidebar-link ${
              isActive("/traffic-monitoring") ? "active" : ""
            }`}
            onClick={closeMenu}
            title="Traffic Monitoring"
          >
            <span className="link-icon">
              <VideoCameraIcon className="w-5 h-5" />
            </span>
            <span className="link-text">Traffic Monitoring</span>
          </Link>

          <Link
            to="/traffic-map"
            className={`sidebar-link ${
              isActive("/traffic-map") ? "active" : ""
            }`}
            onClick={closeMenu}
            title="Traffic Map"
          >
            <span className="link-icon">
              <MapIcon className="w-5 h-5" />
            </span>
            <span className="link-text">Traffic Map</span>
          </Link>

          {(user?.role === "super_admin" || user?.role === "operator") && (
            <Link
              to="/sumo-integration"
              className={`sidebar-link ${
                isActive("/sumo-integration") ? "active" : ""
              }`}
              onClick={closeMenu}
              title="SUMO Integration"
            >
              <span className="link-icon">
                <LinkIcon className="w-5 h-5" />
              </span>
              <span className="link-text">SUMO Integration</span>
            </Link>
          )}

          {user?.role === "super_admin" && (
            <Link
              to="/admin/emergencies"
              className={`sidebar-link ${
                isActive("/admin/emergencies") ? "active" : ""
              }`}
              onClick={closeMenu}
              title="Emergencies"
            >
              <span className="link-icon">
                <ExclamationTriangleIcon className="w-5 h-5" />
              </span>
              <span className="link-text">Emergencies</span>
            </Link>
          )}

          {user?.role !== "super_admin" && (
            <>
              <Link
                to="/operator/emergencies"
                className={`sidebar-link ${
                  isActive("/operator/emergencies") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Emergencies"
              >
                <span className="link-icon">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Emergencies</span>
              </Link>
              <Link
                to="/operator/audit"
                className={`sidebar-link ${
                  isActive("/operator/audit") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Activity Log"
              >
                <span className="link-icon">
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Activity Log</span>
              </Link>
              <Link
                to="/operator/users"
                className={`sidebar-link ${
                  isActive("/operator/users") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Team Directory"
              >
                <span className="link-icon">
                  <UsersIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Team</span>
              </Link>
            </>
          )}

          {user?.role === "super_admin" && (
            <>
              <Link
                to="/admin/users"
                className={`sidebar-link ${
                  isActive("/admin/users") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Users"
              >
                <span className="link-icon">
                  <UsersIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Users</span>
              </Link>
              <Link
                to="/admin/audit"
                className={`sidebar-link ${
                  isActive("/admin/audit") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Audit"
              >
                <span className="link-icon">
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Audit</span>
              </Link>
              <Link
                to="/admin/reports"
                className={`sidebar-link ${
                  isActive("/admin/reports") ? "active" : ""
                }`}
                onClick={closeMenu}
                title="Reports"
              >
                <span className="link-icon">
                  <ChartBarIcon className="w-5 h-5" />
                </span>
                <span className="link-text">Reports</span>
              </Link>
            </>
          )}

          <Link
            to="/reports"
            className={`sidebar-link ${isActive("/reports") ? "active" : ""}`}
            onClick={closeMenu}
            title="Reports"
          >
            <span className="link-icon">
              <DocumentTextIcon className="w-5 h-5" />
            </span>
            <span className="link-text">Reports</span>
          </Link>

          {/* {user?.role === "super_admin" && (
            <Link
              to="/user-management"
              className={`sidebar-link ${
                isActive("/user-management") ? "active" : ""
              }`}
              onClick={closeMenu}
              title="User Management"
            >
              <span className="link-icon">
                <UserIcon className="w-5 h-5" />
              </span>
              <span className="link-text">User Management</span>
            </Link>
          )} */}
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-link theme-toggle-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="link-icon">
              {theme === "dark" ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </span>
            <span className="link-text">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          <div className="user-profile">
            <span className="link-icon">
              <UserIcon className="w-5 h-5" />
            </span>
            <div className="user-details">
              <span className="username">{user.username}</span>
              <span className="user-role">{user.role.replace("_", " ")}</span>
            </div>
          </div>

          <button
            className="sidebar-link logout-btn"
            onClick={() => {
              logout();
              closeMenu();
            }}
            title="Logout"
          >
            <span className="link-icon">
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </span>
            <span className="link-text">Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu}></div>}
    </>
  );
};

export default Navigation;
