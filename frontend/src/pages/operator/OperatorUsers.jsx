import React, { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import "../../components/Dashboard.css";

export default function OperatorUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.listUsers();
      // Operators see only non-admin users (other operators/analysts)
      const filteredUsers = (res.items || []).filter(
        (u) => u.role !== "super_admin"
      );
      setUsers(filteredUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(filter.toLowerCase()) ||
      u.email?.toLowerCase().includes(filter.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const badges = {
      operator:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      analyst:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      viewer:
        "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
    };
    return badges[role] || badges.viewer;
  };

  const getRoleIcon = (role) => {
    if (role === "operator") return "👨‍💼";
    if (role === "analyst") return "📊";
    return "👁️";
  };

  const stats = {
    total: users.length,
    operators: users.filter((u) => u.role === "operator").length,
    analysts: users.filter((u) => u.role === "analyst").length,
    online: users.filter((u) => u.status === "active").length,
  };

  return (
    <PageLayout
      title="Team Directory"
      subtitle="View your team members and colleagues"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Team</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <span className="text-3xl">👥</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Operators</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.operators}
                </p>
              </div>
              <span className="text-3xl">👨‍💼</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Analysts</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.analysts}
                </p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.online}
                </p>
              </div>
              <span className="text-3xl">🟢</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card shadow-card p-4">
          <input
            type="text"
            placeholder="Search by username or email..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {/* Team Members List */}
        <div className="card shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <button
              onClick={load}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading team members...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">🔍</span>
              <p className="text-muted-foreground">
                {filter
                  ? "No users found matching your search"
                  : "No team members found"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((userData) => (
                <div
                  key={userData._id}
                  className={`border rounded-lg p-4 transition-all ${
                    userData.username === currentUser?.username
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">
                      {getRoleIcon(userData.role)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {userData.username}
                        </h3>
                        {userData.username === currentUser?.username && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {userData.email || "No email"}
                      </p>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(
                            userData.role
                          )}`}
                        >
                          {userData.role?.toUpperCase() || "USER"}
                        </span>
                        {userData.status === "active" && (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Online
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="card shadow-card p-6 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="font-semibold mb-2">Team Directory Information</h3>
              <p className="text-sm text-muted-foreground">
                This directory shows your fellow operators and analysts. For
                user management and administrative tasks, please contact your
                system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
