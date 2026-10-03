import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/apiClient";
import Navbar from "../Navbar";
import RepositoryTabs from "./RepositoryTabs";
import { useConfirm } from "../common/ConfirmContext";
import "./repositorySettings.css";

const RepositorySettings = () => {
  const { confirm } = useConfirm();
  const { id } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        setLoading(true);

        const response = await api.get(`/repo/${id}`);

        const repo = response.data.repository || response.data;

        setRepository(repo);
        setDescription(repo.description || "");
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load repository settings.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  const saveChanges = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put(`/repo/update/${id}`, {
        description: description.trim(),
      });

      const updated = response.data.repository || response.data;

      setRepository(updated);
      setDescription(updated.description || "");
      setSuccess("Repository description updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to update repository.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async () => {
    try {
      setVisibilityLoading(true);
      setError("");
      setSuccess("");

      const response = await api.patch(`/repo/toggle/${id}`);

      const updated = response.data.repository || response.data;

      setRepository(updated);

      setSuccess(
        `Repository is now ${updated.visibility ? "public" : "private"}.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to change repository visibility.",
      );
    } finally {
      setVisibilityLoading(false);
    }
  };

  const deleteRepository = async () => {
    const confirmed = await confirm({
      title: "Delete repository",
      message: `Delete repository "${repository?.name}"? This removes the repository, issues, local VCS cache, and all S3 VCS data permanently.`,
      confirmText: "Delete repository",
      cancelText: "Cancel",
      danger: true,
    });

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(`/repo/delete/${id}`);

      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to delete repository.",
      );

      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="repo-settings-page">
          <div className="repo-settings-skeleton" />
          <div className="repo-settings-skeleton short" />
          <div className="repo-settings-skeleton" />
        </main>
      </>
    );
  }

  const ownerId = repository?.owner
    ? typeof repository.owner === "object"
      ? String(repository.owner._id)
      : String(repository.owner)
    : null;

  const isOwner = Boolean(userId && ownerId && String(userId) === ownerId);

  if (!repository) {
    return (
      <>
        <Navbar />

        <main className="repo-settings-page">
          <div className="repo-settings-alert error">
            {error || "Repository not found."}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="repo-settings-page">
        <div className="repo-settings-breadcrumb">
          <Link to={`/repo/${id}`}>← {repository.name}</Link>
        </div>

        <h1>Repository settings</h1>

        <p className="repo-settings-subtitle">
          Manage repository information, visibility, and deletion.
        </p>

        <RepositoryTabs />

        {!isOwner ? (
          <div className="repo-settings-alert error">
            Only the repository owner can manage these settings.
          </div>
        ) : null}

        {error && <div className="repo-settings-alert error">{error}</div>}

        {success && (
          <div className="repo-settings-alert success">{success}</div>
        )}

        {isOwner && (
          <section className="repo-settings-card">
            <h2>General</h2>

            <form onSubmit={saveChanges}>
              <div className="repo-settings-group">
                <label>Repository name</label>

                <input value={repository.name} disabled />
              </div>

              <div className="repo-settings-group">
                <label htmlFor="repo-settings-description">Description</label>

                <textarea
                  id="repo-settings-description"
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="repo-settings-actions">
                <button
                  type="submit"
                  className="repo-settings-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        )}

        {isOwner && (
          <section className="repo-settings-card">
            <h2>Visibility</h2>

            <p>
              This repository is currently{" "}
              <strong>{repository.visibility ? "public" : "private"}</strong>.
            </p>

            <button
              type="button"
              className="repo-settings-secondary"
              onClick={toggleVisibility}
              disabled={visibilityLoading}
            >
              {visibilityLoading
                ? "Updating..."
                : repository.visibility
                  ? "Make private"
                  : "Make public"}
            </button>
          </section>
        )}

        {isOwner && (
          <section className="repo-settings-danger">
            <div>
              <h2>Danger zone</h2>

              <p>
                Permanently delete this repository and its associated VCS
                storage.
              </p>
            </div>

            <button
              type="button"
              className="repo-settings-danger-btn"
              onClick={deleteRepository}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete repository"}
            </button>
          </section>
        )}
      </main>
    </>
  );
};

export default RepositorySettings;
