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
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorTimeout, setErrorTimeout] = useState(null);

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
    
    // Validate all fields before submission
    const allErrors = {};
    Object.keys(newUser).forEach(key => {
      const errors = validateField(key, newUser[key]);
      Object.assign(allErrors, errors);
    });
    
    if (Object.keys(allErrors).length > 0) {
      showErrorWithTimeout(allErrors);
      return;
    }

    try {
      await axios.post("/api/register", newUser);
      setSuccess("User created successfully");
      
      // Auto-dismiss success message
      setTimeout(() => {
        setSuccess("");
      }, 3000);
      
      setNewUser({
        username: "",
        password: "",
        role: "operator",
        region: "",
      });
      setFieldErrors({});
      setShowAddForm(false);
      fetchUsers();
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to create user";
      setError(errorMsg);
      
      // Auto-dismiss error message
      setTimeout(() => {
        setError("");
      }, 5000);
    }
  };

  const validateField = (name, value) => {
    const errors = {};
    
    switch (name) {
      case 'username':
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value) && value !== '') {
          errors.username = 'Username must start with a letter and contain only letters, numbers, and underscores';
        } else if (value.length > 0 && value.length < 3) {
          errors.username = 'Username must be at least 3 characters long';
        }
        break;
      
      case 'password':
        if (value.length > 0 && value.length < 6) {
          errors.password = 'Password must be at least 6 characters long';
        }
        break;
      
      case 'region':
        if (value && !/^[a-zA-Z\s-]+$/.test(value)) {
          errors.region = 'Region must contain only letters, spaces, and hyphens';
        }
        break;
      
      default:
        break;
    }
    
    return errors;
  };

  const showErrorWithTimeout = (errors) => {
    // Clear existing timeout if any
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
    
    // Set errors without auto-dismiss
    setFieldErrors(errors);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Update the field value
    setNewUser({
      ...newUser,
      [name]: value,
    });
    
    // Validate the field
    const errors = validateField(name, value);
    
    if (Object.keys(errors).length > 0) {
      // Show error and keep it visible
      setFieldErrors(prev => ({ ...prev, ...errors }));
    } else {
      // Clear error for this field only when it's valid
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
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
                className={fieldErrors.username ? 'input-error' : ''}
              />
              {fieldErrors.username && (
                <div className="field-error-message">{fieldErrors.username}</div>
              )}
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
                className={fieldErrors.password ? 'input-error' : ''}
              />
              {fieldErrors.password && (
                <div className="field-error-message">{fieldErrors.password}</div>
              )}
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
                className={fieldErrors.region ? 'input-error' : ''}
              />
              {fieldErrors.region && (
                <div className="field-error-message">{fieldErrors.region}</div>
              )}
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
