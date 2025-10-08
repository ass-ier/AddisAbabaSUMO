import React from "react";
import { useAuth } from "../contexts/AuthContext";
import SuperAdminDashboard from "./SuperAdminDashboard";
import OperatorDashboard from "./OperatorDashboard";

const Dashboard = () => {
  const { user } = useAuth();

  // Route to appropriate dashboard based on user role
  if (user?.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  // Default dashboard for operators and analysts
  return <OperatorDashboard />;
};

export default Dashboard;
