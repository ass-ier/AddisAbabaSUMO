import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import "../components/UserManagement.css";

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "operator",
    region: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.listUsers();
      setUsers(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error) {
      console.error("Error loading users:", error);
      setMessage("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      await api.createUser(form);
      setForm({ username: "", password: "", role: "operator", region: "" });
      setMessage("User created successfully");
      load();
    } catch (error) {
      console.error("Error creating user:", error);
      setMessage(
        "Failed to create user: " + (error.message || "Unknown error")
      );
    }
  };

  const filtered = users.filter(
    (u) =>
      !filter || u.username.includes(filter) || (u.role || "").includes(filter)
  );

  const getRoleBadge = (role) => {
    const roleColors = {
      super_admin: "#FF5722",
      operator: "#4CAF50",
      analyst: "#FF9800",
    };

    return (
      <span
        className="role-badge"
        style={{ backgroundColor: roleColors[role] }}
      >
        {role.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  const updateRole = async (id, newRole) => {
    try {
      await api.updateUser(id, { role: newRole });
      await load();
    } catch (e) {
      console.error("Failed to update role", e);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await api.deleteUser(id);
      await load();
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600">Admin - manage users</p>
      </div>
      <div className="user-management">
        <div className="add-user-form card shadow-card">
          <h2>Create New User</h2>
          {message && (
            <div
              className={
                message.includes("successfully")
                  ? "success-message"
                  : "error-message"
              }
            >
              {message}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                placeholder="Enter username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role:</label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              >
                <option value="operator">Operator</option>
                <option value="analyst">Analyst</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="region">Region:</label>
              <input
                type="text"
                id="region"
                placeholder="Enter region (optional)"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create User
              </button>
            </div>
          </form>
        </div>

        <div className="users-section card shadow-card">
          <div className="users-header">
            <h2>System Users</h2>
            <input
              className="search-input"
              placeholder="Search users..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <div className="users-table">
              {filtered.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Region</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((userData) => (
                      <tr key={userData._id}>
                        <td>{userData.username}</td>
                        <td>
                          {getRoleBadge(userData.role)}
                          <select
                            className="ml-2"
                            value={userData.role}
                            onChange={(e) =>
                              updateRole(userData._id, e.target.value)
                            }
                          >
                            <option value="operator">Operator</option>
                            <option value="analyst">Analyst</option>
                          </select>
                        </td>
                        <td>{userData.region || "N/A"}</td>
                        <td>
                          {userData.createdAt
                            ? new Date(userData.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          <button
                            className="text-red-600 hover:text-red-800 text-xs"
                            onClick={() => removeUser(userData._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data">
                  <p>No users found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
