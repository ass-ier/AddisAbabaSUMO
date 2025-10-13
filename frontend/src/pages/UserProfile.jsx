import React, { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

export default function UserProfile() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ newPassword: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await api.getCurrentUser();
        if (!mounted) return;
        // Support both shapes: { success, data } or direct { user }
        const u = me?.data || me?.user || me;
        setUser(u || authUser || null);
        setMustChange(!!(u?.forcePasswordChange));
      } catch (e) {
        setUser(authUser || null);
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [authUser]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!pwd.newPassword || pwd.newPassword.length < 6) {
      setMsg("Password must be at least 6 characters long.");
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      setMsg("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.updateCurrentUser({ password: pwd.newPassword });
      setMsg("Password updated successfully.");
      setPwd({ newPassword: "", confirm: "" });
      setMustChange(false);
      // Update cached user flag
      try {
        const stored = sessionStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.forcePasswordChange = false;
          sessionStorage.setItem("user", JSON.stringify(parsed));
        }
      } catch (_) {}
      try {
        window.dispatchEvent(
          new CustomEvent("notify", {
            detail: { type: "success", message: "Password updated" },
          })
        );
      } catch (_) {}
    } catch (e) {
      setMsg(e.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="My Profile" subtitle="Manage your account settings">
      <div className="space-y-6">
        {/* Basic info */}
        <div className="card shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">👤</span>
            <h3 className="text-lg font-semibold">Profile</h3>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : user ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">First Name</label>
                <input className="border p-2 w-full" value={user.firstName || ""} disabled />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                <input className="border p-2 w-full" value={user.lastName || ""} disabled />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Username</label>
                <input className="border p-2 w-full" value={user.username || ""} disabled />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <input
                  className="border p-2 w-full"
                  value={(user.role || "").replace("_", " ")}
                  disabled
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input className="border p-2 w-full" value={user.email || ""} disabled />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                <input className="border p-2 w-full" value={user.phoneNumber || ""} disabled />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No profile found</div>
          )}
        </div>

        {/* Change password */}
        <div className="card shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔐</span>
            <h3 className="text-lg font-semibold">Change Password</h3>
          </div>
          {msg && (
            <div className={msg.includes("success") ? "success-message" : "error-message"}>
              {msg}
            </div>
          )}
          <form onSubmit={handlePasswordChange}>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  className="border p-2 w-full"
                  minLength={6}
                  value={pwd.newPassword}
                  onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                  placeholder="Enter a new password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  className="border p-2 w-full"
                  minLength={6}
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  placeholder="Re-enter the new password"
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {mustChange && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "min(520px, 94vw)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 20,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔐</span>
              <h3 className="text-lg font-semibold" style={{ margin: 0 }}>Set a new password</h3>
            </div>
            <p className="text-sm text-muted-foreground" style={{ marginTop: 0 }}>
              Your password was reset by an administrator. Please set a new password to continue.
            </p>
            <form onSubmit={handlePasswordChange}>
              <div className="grid gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">New Password</label>
                  <input
                    type="password"
                    className="border p-2 w-full"
                    minLength={6}
                    value={pwd.newPassword}
                    onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                    placeholder="Enter a new password"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    className="border p-2 w-full"
                    minLength={6}
                    value={pwd.confirm}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                    placeholder="Re-enter the new password"
                    required
                  />
                </div>
              </div>
              <div className="mt-4" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
