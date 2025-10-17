import React, { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import OTPInput from "../components/OTPInput";

export default function UserProfile() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ newPassword: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);

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

  const handleSendOTP = async () => {
    setMsg("");
    if (!user?.email && !user?.phoneNumber) {
      setMsg("No email or phone number found. Cannot send OTP.");
      return;
    }
    setSendingOTP(true);
    try {
      const identifier = user.email || user.phoneNumber;
      const method = user.email ? "email" : "sms";
      await api.sendOTP(identifier, "verification", method);
      setShowOTP(true);
      setMsg("");
    } catch (error) {
      setMsg(error.message || "Failed to send OTP");
    } finally {
      setSendingOTP(false);
    }
  };

  const handleOTPComplete = (otp, verified) => {
    if (verified) {
      setOtpVerified(true);
      setMsg("OTP verified successfully!");
      setTimeout(() => setMsg(""), 3000);
    }
  };

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
    if (!otpVerified) {
      setMsg("Please verify OTP before changing password.");
      return;
    }
    setSaving(true);
    try {
      await api.updateCurrentUser({ password: pwd.newPassword });
      setMsg("Password updated successfully.");
      setPwd({ newPassword: "", confirm: "" });
      setMustChange(false);
      setShowOTP(false);
      setOtpVerified(false);
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setMsg(""), 3000);
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
          
          {/* Send OTP Button */}
          {!showOTP && !otpVerified && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={sendingOTP}
                className="send-otp-btn"
              >
                {sendingOTP ? "Sending OTP..." : "Send OTP to Verify"}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                An OTP will be sent to your {user?.email ? "email" : "phone"} for verification
              </p>
            </div>
          )}

          {/* OTP Verification Section */}
          {showOTP && !otpVerified && (
            <div className="otp-section mb-4">
              <h3 className="text-sm font-semibold mb-2">Verify OTP</h3>
              <p className="text-xs text-gray-500 mb-3">
                Enter the OTP code sent to {user?.email || user?.phoneNumber}
              </p>
              <OTPInput
                length={6}
                onComplete={handleOTPComplete}
                identifier={user?.email || user?.phoneNumber}
                purpose="verification"
                disabled={otpVerified}
              />
            </div>
          )}

          {otpVerified && (
            <div className="success-box mb-4">
              ✅ OTP verified! You can now change your password.
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
                  disabled={!otpVerified}
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
                  disabled={!otpVerified}
                />
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn-primary" disabled={saving || !otpVerified}>
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

            {msg && (
              <div className={msg.includes("success") ? "success-message" : "error-message"} style={{ marginBottom: 12 }}>
                {msg}
              </div>
            )}

            {/* Send OTP Button */}
            {!showOTP && !otpVerified && (
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={sendingOTP}
                  className="send-otp-btn"
                  style={{ width: "100%" }}
                >
                  {sendingOTP ? "Sending OTP..." : "Send OTP to Verify"}
                </button>
                <p className="text-xs text-gray-500" style={{ marginTop: 8 }}>
                  An OTP will be sent to your {user?.email ? "email" : "phone"} for verification
                </p>
              </div>
            )}

            {/* OTP Verification Section */}
            {showOTP && !otpVerified && (
              <div style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 6 }}>
                <h4 className="text-sm font-semibold" style={{ margin: "0 0 8px 0" }}>Verify OTP</h4>
                <p className="text-xs text-gray-500" style={{ margin: "0 0 12px 0" }}>
                  Enter the OTP code sent to {user?.email || user?.phoneNumber}
                </p>
                <OTPInput
                  length={6}
                  onComplete={handleOTPComplete}
                  identifier={user?.email || user?.phoneNumber}
                  purpose="verification"
                  disabled={otpVerified}
                />
              </div>
            )}

            {otpVerified && (
              <div className="success-box" style={{ marginBottom: 16 }}>
                ✅ OTP verified! You can now change your password.
              </div>
            )}

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
                    disabled={!otpVerified}
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
                    disabled={!otpVerified}
                  />
                </div>
              </div>
              <div className="mt-4" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="submit" className="btn-primary" disabled={saving || !otpVerified}>
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
