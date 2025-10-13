import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import "../components/UserManagement.css";

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    role: "operator",
    region: "",
    phoneNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.listUsers();
      // Support both API shapes:
      // - legacy: returns an array of users
      // - new: returns { success: true, data: users, pagination: ... }
      const usersList = Array.isArray(data) ? data : data?.data || [];
      setUsers(Array.isArray(usersList) ? usersList : []);
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
      const res = await api.createUser(form);
      // Backend may return multiple shapes:
      // - direct user object (res._id etc.)
      // - envelope: { success: true, data: user }
      // - envelope: { success: true, data: { ... }, pagination: ... }
      let createdUser = null;
      if (!res) {
        createdUser = null;
      } else if (res._id) {
        // direct user object
        createdUser = res;
      } else if (res.data && res.data._id) {
        createdUser = res.data;
      } else if (res.data && Array.isArray(res.data)) {
        // sometimes API may return list on create - fallback to reload
        createdUser = null;
      } else if (res.success && res.data) {
        createdUser = res.data;
      }

      if (createdUser) {
        setUsers((prev) => [createdUser, ...prev]);
      } else {
        await load();
      }

      setForm({
        firstName: "", 
        lastName: "", 
        username: "", 
        email: "", 
        password: "", 
        role: "operator", 
        region: "", 
        phoneNumber: "" 
      });
      setMessage("User created successfully");
      // If we appended above, we've already updated the UI. Otherwise load() was called.
    } catch (error) {
      console.error("Error creating user:", error);
      setMessage(
        "Failed to create user: " + (error.message || "Unknown error")
      );
    }
  };

  const filtered = users.filter(
    (u) =>
      !filter || 
      u.username.includes(filter) || 
      (u.role || "").includes(filter) ||
      (u.email || "").toLowerCase().includes(filter.toLowerCase()) ||
      (u.firstName || "").toLowerCase().includes(filter.toLowerCase()) ||
      (u.lastName || "").toLowerCase().includes(filter.toLowerCase()) ||
      (u.region || "").toLowerCase().includes(filter.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const roleColors = {
      operator: "#4CAF50",
      analyst: "#FF9800", 
      super_admin: "#9C27B0",
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

  // Role color map (used for inline styling of the select)
  const roleColors = {
    operator: "#4CAF50",
    analyst: "#FF9800",
    super_admin: "#9C27B0",
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
              <label htmlFor="firstName">First Name:</label>
              <input
                type="text"
                id="firstName"
                placeholder="Enter first name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name:</label>
              <input
                type="text"
                id="lastName"
                placeholder="Enter last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>

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
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                placeholder="Enter email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                placeholder="Enter password (min 6 characters)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
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
                <option value="super_admin">Super Admin</option>
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

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number:</label>
              <input
                type="tel"
                id="phoneNumber"
                placeholder="Enter phone number (optional)"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
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
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((userData) => (
                      <tr key={userData._id}>
                        <td>{userData.firstName} {userData.lastName}</td>
                        <td>{userData.username}</td>
                        <td>{userData.email}</td>
                        <td>
                          <select
                            className="role-select"
                            value={userData.role}
                            onChange={(e) => updateRole(userData._id, e.target.value)}
                            style={{ backgroundColor: roleColors[userData.role] }}
                          >
                            <option value="operator">Operator</option>
                            <option value="analyst">Analyst</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        </td>
                        <td>{userData.region || "N/A"}</td>
                        <td>
                          <span className={`status-badge ${
                            userData.isActive ? 'status-active' : 'status-inactive'
                          }`}>
                            {userData.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
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
