import React from "react";
import "./PageLayout.css";
import { useAuth } from "../contexts/AuthContext";

const PageLayout = ({ title, subtitle, children }) => {
  const { user, logout } = useAuth();
  return (
    <div className="page-container">
      <div className="page-card">
        {(title || subtitle) && (
          <div
            className="page-header login-like"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              {title && <h1>{title}</h1>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            {user && (
              <button
                onClick={logout}
                className="logout-btn"
                aria-label="Logout"
              ></button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
