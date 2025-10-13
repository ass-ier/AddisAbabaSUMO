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
  const [pwdModal, setPwdModal] = useState({ open: false, username: "", pwd: "" });

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
        phoneNumber: "",
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
    // Optimistic removal from table
    setUsers((prev) => prev.filter((u) => u._id !== id));
    try {
      await api.deleteUser(id);
      // Optional notify
      try {
        window.dispatchEvent(new CustomEvent('notify', { detail: { type: 'success', message: 'User deleted' } }));
      } catch (_) {}
    } catch (e) {
      console.error("Failed to delete user", e);
      setMessage("Failed to delete user: " + (e.message || "Unknown error"));
      // Reload to restore original list
      await load();
    }
  };

  const generateTempPassword = () => {
    try {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      const num = arr[0] % 1000000; // 0..999999
      return String(num).padStart(6, '0');
    } catch (_) {
      // Fallback if crypto is unavailable
      const num = Math.floor(Math.random() * 1000000);
      return String(num).padStart(6, '0');
    }
  };

  const handleAction = async (userObj, action) => {
    try {
      if (action === 'reset_pwd') {
        if (!window.confirm(`Reset password for ${userObj.username}?`)) return;
        const temp = generateTempPassword();
        await api.updateUser(userObj._id, { password: temp });
        setPwdModal({ open: true, username: userObj.username, pwd: temp });
        // Optionally notify
        try {
          window.dispatchEvent(new CustomEvent('notify', { detail: { type: 'info', message: `Temporary password set for ${userObj.username}` } }));
        } catch (_) {}
        return;
      }
      if (action === 'deactivate') {
        if (!window.confirm(`Deactivate ${userObj.username}?`)) return;
        await api.updateUser(userObj._id, { isActive: false });
        await load();
        return;
      }
      if (action === 'activate') {
        if (!window.confirm(`Activate ${userObj.username}?`)) return;
        await api.updateUser(userObj._id, { isActive: true });
        await load();
        return;
      }
      if (action === 'delete') {
        await removeUser(userObj._id);
        return;
      }
    } catch (e) {
      console.error('Action failed', e);
      setMessage(`Action failed: ${e.message || 'Unknown error'}`);
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
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
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
                onChange={(e) =>
                  setForm({ ...form, phoneNumber: e.target.value })
                }
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
                        <td>
                          {userData.firstName} {userData.lastName}
                        </td>
                        <td>{userData.username}</td>
                        <td>{userData.email}</td>
                        <td>
                          <select
                            className="role-select"
                            value={userData.role}
                            onChange={(e) =>
                              updateRole(userData._id, e.target.value)
                            }
                            style={{
                              backgroundColor: roleColors[userData.role],
                            }}
                          >
                            <option value="operator">Operator</option>
                            <option value="analyst">Analyst</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        </td>
                        <td>{userData.region || "N/A"}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              userData.isActive
                                ? "status-active"
                                : "status-inactive"
                            }`}
                          >
                            {userData.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {userData.createdAt
                            ? new Date(userData.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td>
                          <select
                            className="action-select"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value;
                              e.target.value = "";
                              if (v) handleAction(userData, v);
                            }}
                          >
                            <option value="" disabled>
                              Actions
                            </option>
                            <option value="reset_pwd">Reset Password</option>
                            {userData.isActive ? (
                              <option value="deactivate">Deactivate</option>
                            ) : (
                              <option value="activate">Activate</option>
                            )}
                            <option value="delete">Delete</option>
                          </select>
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

      {pwdModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          aria-modal="true"
          role="dialog"
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "min(480px, 92vw)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Temporary Password</h3>
              <button
                onClick={() => setPwdModal({ open: false, username: "", pwd: "" })}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p style={{ marginTop: 0, color: "#555" }}>
              Share this temporary password with <strong>{pwdModal.username}</strong>. They will be prompted to change it after logging in.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f7f7f7",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: "10px 12px",
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              <code style={{ fontSize: 20, letterSpacing: 2 }}>{pwdModal.pwd}</code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pwdModal.pwd);
                    window.dispatchEvent(new CustomEvent('notify', { detail: { type: 'success', message: 'Copied temporary password' } }));
                  } catch (_) {
                    // fallback: create input for copy
                    try {
                      const el = document.createElement('input');
                      el.value = pwdModal.pwd;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand('copy');
                      document.body.removeChild(el);
                      window.dispatchEvent(new CustomEvent('notify', { detail: { type: 'success', message: 'Copied temporary password' } }));
                    } catch (e) {}
                  }
                }}
                className="btn-secondary"
                style={{ marginLeft: "auto" }}
              >
                Copy
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                className="btn-primary"
                onClick={() => setPwdModal({ open: false, username: "", pwd: "" })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
