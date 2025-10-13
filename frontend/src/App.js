import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingSpinner, ErrorBoundary } from "./components/common";
import "./styles/App.css";

// Lazy load all route components for better performance
const Login = React.lazy(() => import("./components/Login"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const UserManagement = React.lazy(() => import("./components/UserManagement"));
const TrafficMonitoring = React.lazy(
  () => import("./components/TrafficMonitoring")
);
const TrafficMap = React.lazy(() => import("./components/TrafficMap"));
const SUMOIntegration = React.lazy(
  () => import("./components/SUMOIntegration")
);
const Reports = React.lazy(() => import("./components/Reports"));
const Navigation = React.lazy(() => import("./components/Navigation"));
const UsersAdmin = React.lazy(() => import("./pages/UsersAdmin"));
const AuditLogs = React.lazy(() => import("./pages/AuditLogs"));
const ReportsAdmin = React.lazy(() => import("./pages/ReportsAdmin"));
const EmergencyPanel = React.lazy(() => import("./pages/EmergencyPanel"));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <>
      <Suspense fallback={<LoadingSpinner size="sm" message="" />}>
        {user && <Navigation />}
      </Suspense>
      <Suspense
        fallback={<LoadingSpinner size="lg" message="Loading page..." />}
      >
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
              user && user.role === "super_admin" ? (
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
      </Suspense>
    </>
  );
}

export default App;
