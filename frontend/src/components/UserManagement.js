import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import "./UserManagement.css";
import PageLayout from "./PageLayout";

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "operator",
    region: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/register", newUser);
      setSuccess("User created successfully");
      setNewUser({
        username: "",
        password: "",
        role: "operator",
        region: "",
      });
      setShowAddForm(false);
      fetchUsers();
    } catch (error) {
      setError(error.response?.data?.message || "Failed to create user");
    }
  };

  const handleInputChange = (e) => {
    setNewUser({
      ...newUser,
      [e.target.name]: e.target.value,
    });
  };

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

  if (user?.role !== "super_admin") {
    return (
      <PageLayout
        title="Access Denied"
        subtitle="You don't have permission to access user management."
      >
        <div />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="User Management"
      subtitle="Manage system users and permissions"
    >
      <div className="user-controls">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
        >
          {showAddForm ? "Cancel" : "Add New User"}
        </button>
      </div>

      {showAddForm && (
        <div className="add-user-form card shadow-card">
          <h2>Add New User</h2>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleAddUser}>
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                name="username"
                value={newUser.username}
                onChange={handleInputChange}
                required
                placeholder="Enter username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={newUser.password}
                onChange={handleInputChange}
                required
                placeholder="Enter password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role:</label>
              <select
                id="role"
                name="role"
                value={newUser.role}
                onChange={handleInputChange}
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
                name="region"
                value={newUser.region}
                onChange={handleInputChange}
                placeholder="Enter region (optional)"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create User
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-section card shadow-card">
        <h2>System Users</h2>

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="users-table">
            {users.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Region</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userData) => (
                    <tr key={userData._id}>
                      <td>{userData.username}</td>
                      <td>{getRoleBadge(userData.role)}</td>
                      <td>{userData.region || "N/A"}</td>
                      <td>
                        {new Date(userData.createdAt).toLocaleDateString()}
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
    </PageLayout>
  );
};

export default UserManagement;
