import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./DashboardUpgradeNotification.css";

const DashboardUpgradeNotification = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show for operators or super_admin users
  if (!user || !["operator", "super_admin"].includes(user.role) || dismissed) {
    return null;
  }

  return (
    <div className="upgrade-notification">
      <div className="upgrade-content">
        <div className="upgrade-icon">✨</div>
        <div className="upgrade-text">
          <h4>Enhanced Operator Dashboard Available!</h4>
          <p>
            Experience the new professional dashboard with real-time analytics,
            advanced monitoring, and improved UI.
          </p>
        </div>
        <div className="upgrade-actions">
          <Link to="/operator/dashboard" className="upgrade-btn primary">
            Try New Dashboard
          </Link>
          <button
            className="upgrade-btn secondary"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardUpgradeNotification;
