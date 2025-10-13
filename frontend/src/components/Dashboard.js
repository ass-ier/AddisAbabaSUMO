import React from "react";
import SuperAdminDashboard from "./SuperAdminDashboard";

const Dashboard = () => {
  // Use a single dashboard for all roles; RBAC is enforced by backend APIs and protected routes
  return <SuperAdminDashboard />;
};

export default Dashboard;
