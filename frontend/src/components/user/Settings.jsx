import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Navbar from "../Navbar";
import "./Settings.css";
import { useAuth } from "../../authContext";
import { useConfirm } from "../common/ConfirmContext";

const Settings = () => {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const userId = localStorage.getItem("userId");

      if (!userId) {
        navigate("/auth");
        return;
      }

      try {
        const response = await api.get(`/userProfile/${userId}`);

        setUser(response.data);
        setEmail(response.data.email || "");
      } catch (err) {
        console.error("Cannot fetch account:", err);

        setError(err.response?.data?.message || "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleSave = async (event) => {
    event.preventDefault();

    const userId = localStorage.getItem("userId");

    if (!userId) {
      navigate("/auth");
      return;
    }

    if (password && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!email.trim()) {
      setError("Email cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put(`/updateProfile/${userId}`, {
        email: email.trim(),
        ...(password ? { password } : {}),
      });

      setUser(response.data);

      setEmail(response.data.email || "");

      setPassword("");
      setConfirmPassword("");

      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      console.error("Cannot update profile:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to update profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const userId = localStorage.getItem("userId");

    if (!userId) return;

    const confirmed = await confirm({
      title: "Delete account",

      message:
        "Are you sure you want to delete your account? This action cannot be undone.",

      confirmText: "Delete account",

      cancelText: "Cancel",

      danger: true,
    });

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(`/deleteProfile/${userId}`);

      localStorage.removeItem("token");
      localStorage.removeItem("userId");

      setCurrentUser(null);

      navigate("/auth");
    } catch (err) {
      console.error("Cannot delete account:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to delete account.",
      );

      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="settings-loading">Loading settings...</main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="settings-page">
        <div className="settings-header">
          <div>
            <Link to="/profile" className="settings-back-link">
              ← Back to profile
            </Link>

            <h1>Account Settings</h1>

            <p>Manage your account information and password.</p>
          </div>
        </div>

        {error && <p className="settings-error">{error}</p>}

        {success && <p className="settings-success">{success}</p>}

        <section className="settings-card">
          <h2>Profile information</h2>

          <form onSubmit={handleSave} className="settings-form">
            <div className="settings-form-group">
              <label>Username</label>

              <input type="text" value={user?.username || ""} disabled />

              <small>
                Username changes are not available through the current backend.
              </small>
            </div>

            <div className="settings-form-group">
              <label htmlFor="settings-email">Email</label>

              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="settings-divider" />

            <h2>Change password</h2>

            <div className="settings-form-group">
              <label htmlFor="settings-password">New password</label>

              <input
                id="settings-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave empty to keep your current password"
              />
            </div>

            <div className="settings-form-group">
              <label htmlFor="settings-confirm-password">
                Confirm new password
              </label>

              <input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
              />
            </div>

            <div className="settings-actions">
              <Link to="/profile" className="settings-cancel-btn">
                Cancel
              </Link>

              <button
                type="submit"
                className="settings-save-btn"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-danger-card">
          <div>
            <h2>Delete account</h2>

            <p>Permanently delete your VCS account.</p>
          </div>

          <button
            type="button"
            className="settings-delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete account"}
          </button>
        </section>
      </main>
    </>
  );
};

export default Settings;
