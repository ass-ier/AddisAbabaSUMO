import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";
import TrafficMonitoring from "./components/TrafficMonitoring";
import TrafficMap from "./components/TrafficMap";
import SUMOIntegration from "./components/SUMOIntegration";
import Reports from "./components/Reports";
import Navigation from "./components/Navigation";
import "./styles/App.css";
import UsersAdmin from "./pages/UsersAdmin";
import SystemSettings from "./pages/SystemSettings";
import AuditLogs from "./pages/AuditLogs";
import ReportsAdmin from "./pages/ReportsAdmin";
import EmergencyPanel from "./pages/EmergencyPanel";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navigation />}
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/user-management"
          element={user ? <UserManagement /> : <Navigate to="/login" />}
        />
        <Route
          path="/traffic-monitoring"
          element={user ? <TrafficMonitoring /> : <Navigate to="/login" />}
        />
        <Route
          path="/traffic-map"
          element={user ? <TrafficMap /> : <Navigate to="/login" />}
        />
        <Route
          path="/sumo-integration"
          element={user ? <SUMOIntegration /> : <Navigate to="/login" />}
        />
        <Route
          path="/reports"
          element={user ? <Reports /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin/users"
          element={
            user && user.role === "super_admin" ? (
              <UsersAdmin />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/settings"
          element={
            user && user.role === "super_admin" ? (
              <SystemSettings />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/audit"
          element={
            user && user.role === "super_admin" ? (
              <AuditLogs />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/reports"
          element={
            user && user.role === "super_admin" ? (
              <ReportsAdmin />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/emergencies"
          element={
            user && (user.role === "super_admin" || user.role === "admin") ? (
              <EmergencyPanel />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
      </Routes>
    </>
  );
}

export default App;
