import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import "./repositoryDetails.css";

const API_URL = "http://localhost:3002";

const RepositoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");

  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isStarred, setIsStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await axios.get(`${API_URL}/repo/${id}`);

        const repo = response.data.repository || response.data;

        setRepository(repo);
        setEditDescription(repo.description || "");
      } catch (err) {
        console.error("Cannot fetch repository:", err);

        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Unable to load repository.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  useEffect(() => {
    const fetchStarredStatus = async () => {
      if (!userId || !id) return;

      try {
        const response = await axios.get(
          `${API_URL}/userProfile/${userId}/starred`,
        );

        const starredRepos = response.data.starredRepositories || [];

        setIsStarred(
          starredRepos.some((repo) => String(repo._id) === String(id)),
        );
      } catch (err) {
        console.error("Cannot fetch starred repositories:", err);
      }
    };

    fetchStarredStatus();
  }, [id, userId]);

  const ownerId = useMemo(() => {
    if (!repository?.owner) {
      return null;
    }

    return typeof repository.owner === "object"
      ? String(repository.owner._id)
      : String(repository.owner);
  }, [repository]);

  const isOwner = Boolean(userId && ownerId === String(userId));

  const content = Array.isArray(repository?.content) ? repository.content : [];

  const issues = Array.isArray(repository?.issues) ? repository.issues : [];

  const handleStar = async () => {
    if (!userId || !id) return;

    try {
      setStarLoading(true);

      const response = await axios.patch(
        `${API_URL}/userProfile/${userId}/star/${id}`,
      );

      setIsStarred(Boolean(response.data.starred));
    } catch (err) {
      console.error("Cannot update starred repository:", err);
    } finally {
      setStarLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditDescription(repository.description || "");

    setNewContent("");
    setEditError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (editLoading) return;

    setEditDescription(repository.description || "");

    setNewContent("");
    setEditError("");
    setIsEditing(false);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!isOwner) return;

    const description = editDescription.trim();

    const contentItem = newContent.trim();

    try {
      setEditLoading(true);
      setEditError("");

      const response = await axios.put(`${API_URL}/repo/update/${id}`, {
        description,
        ...(contentItem ? { content: contentItem } : {}),
      });

      const updatedRepository =
        response.data.repository || response.data.updatedRepository;

      if (updatedRepository) {
        setRepository(updatedRepository);

        setEditDescription(updatedRepository.description || "");
      } else {
        setRepository((current) => ({
          ...current,
          description,
          ...(contentItem
            ? {
                content: [...(current.content || []), contentItem],
              }
            : {}),
        }));
      }

      setNewContent("");
      setIsEditing(false);
    } catch (err) {
      console.error("Cannot update repository:", err);

      setEditError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to update repository.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isOwner || !id) return;

    try {
      setVisibilityLoading(true);

      const response = await axios.patch(`${API_URL}/repo/toggle/${id}`);

      const updatedRepository = response.data.repository;

      if (updatedRepository) {
        setRepository(updatedRepository);
      } else {
        setRepository((current) => ({
          ...current,
          visibility: !current.visibility,
        }));
      }
    } catch (err) {
      console.error("Cannot toggle repository visibility:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to change repository visibility.",
      );
    } finally {
      setVisibilityLoading(false);
    }
  };

  const handleDeleteRepository = async () => {
    if (!isOwner || !id) return;

    const confirmed = window.confirm(
      `Delete repository "${repository.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      setError("");

      await axios.delete(`${API_URL}/repo/delete/${id}`);

      navigate("/");
    } catch (err) {
      console.error("Cannot delete repository:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to delete repository.",
      );

      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="repo-details-page">
          <p className="repo-details-message">Loading repository...</p>
        </div>
      </>
    );
  }

  if (error || !repository) {
    return (
      <>
        <Navbar />

        <div className="repo-details-page">
          <p className="repo-details-message">
            {error || "Repository not found."}
          </p>

          <button className="back-btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="repo-details-page">
        {/* Header */}

        <div className="repo-details-header">
          <div className="repo-header-main">
            <div className="breadcrumb">
              <Link to="/">Repositories</Link>

              <span>/</span>

              <span>{repository.name}</span>
            </div>

            <div className="repo-title-row">
              <h1>{repository.name}</h1>

              <span
                className={`visibility-badge ${
                  repository.visibility ? "public" : "private"
                }`}
              >
                {repository.visibility ? "Public" : "Private"}
              </span>
            </div>

            <p className="repo-owner">
              Owned by{" "}
              {repository.owner?._id ? (
                <Link
                  to={`/user/${repository.owner._id}`}
                  className="repo-owner-link"
                >
                  <strong>{repository.owner.username || "Unknown user"}</strong>
                </Link>
              ) : (
                <strong>Unknown user</strong>
              )}
            </p>

            {repository.description && (
              <p className="repo-details-description">
                {repository.description}
              </p>
            )}
          </div>

          {/* Star */}

          <button
            className={`star-btn ${isStarred ? "starred" : ""}`}
            onClick={handleStar}
            disabled={starLoading}
          >
            {starLoading ? "Saving..." : isStarred ? "★ Starred" : "☆ Star"}
          </button>
        </div>

        {error && <p className="repo-inline-error">{error}</p>}

        {/* Management */}

        <section className="repo-management-bar">
          <div className="management-summary">
            <strong>Repository management</strong>

            <span>
              {isOwner
                ? "You are the owner of this repository."
                : "You can view this repository."}
            </span>
          </div>

          {isOwner && (
            <div className="management-actions">
              <button
                type="button"
                className="management-btn vcs-management-btn"
                onClick={() => navigate(`/repo/${id}/vcs`)}
                disabled={editLoading || deleteLoading || visibilityLoading}
              >
                Version Control
              </button>

              <button
                type="button"
                className="management-btn"
                onClick={handleStartEdit}
                disabled={editLoading || deleteLoading || visibilityLoading}
              >
                Edit
              </button>

              <button
                type="button"
                className="management-btn"
                onClick={handleToggleVisibility}
                disabled={visibilityLoading || editLoading || deleteLoading}
              >
                {visibilityLoading
                  ? "Updating..."
                  : repository.visibility
                    ? "Make private"
                    : "Make public"}
              </button>

              <button
                type="button"
                className="management-btn danger"
                onClick={handleDeleteRepository}
                disabled={deleteLoading || editLoading || visibilityLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </section>

        {/* Edit */}

        {isEditing && isOwner && (
          <section className="repo-edit-card">
            <div className="repo-edit-heading">
              <h2>Edit Repository</h2>

              <button
                type="button"
                className="close-edit-btn"
                onClick={handleCancelEdit}
                disabled={editLoading}
                aria-label="Close edit form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="edit-form-group">
                <label htmlFor="edit-description">Description</label>

                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Describe your repository"
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="new-content">Add content item</label>

                <textarea
                  id="new-content"
                  value={newContent}
                  onChange={(event) => setNewContent(event.target.value)}
                  rows={3}
                  placeholder="Optional: add a file name or content entry"
                />

                <small>
                  This follows your current backend model, where repository
                  content is stored as an array of strings.
                </small>
              </div>

              {editError && <p className="repo-inline-error">{editError}</p>}

              <div className="edit-actions">
                <button
                  type="button"
                  className="management-btn"
                  onClick={handleCancelEdit}
                  disabled={editLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-edit-btn"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Repository information */}

        <section className="repo-details-grid">
          <div className="repo-details-card">
            <h2>Repository Information</h2>

            <div className="repo-stat-row">
              <span>Visibility</span>

              <strong>{repository.visibility ? "Public" : "Private"}</strong>
            </div>

            <div className="repo-stat-row">
              <span>Files / Content</span>

              <strong>{content.length}</strong>
            </div>

            <div className="repo-stat-row">
              <span>Issues</span>

              <strong>{issues.length}</strong>
            </div>

            <div className="repo-stat-row">
              <span>Created</span>

              <strong>
                {repository.createdAt
                  ? new Date(repository.createdAt).toLocaleDateString()
                  : "-"}
              </strong>
            </div>
          </div>
          {/* Content */}
          <div className="repo-details-card">
            <h2>Content</h2>

            {content.length > 0 ? (
              <div className="content-list">
                {content.map((item, index) => (
                  <div className="content-item" key={`${item}-${index}`}>
                    {item}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No content has been added yet.</p>
            )}
          </div>
          {/* Issues */}
          <div className="repo-details-card">
            <div className="repo-card-heading">
              <div>
                <h2>Issues</h2>

                <p className="repo-card-subtitle">
                  {issues.length} issue
                  {issues.length !== 1 ? "s" : ""} in this repository.
                </p>
              </div>

              <Link to={`/repo/${id}/issues`} className="view-issues-btn">
                View all
              </Link>
            </div>

            {issues.length > 0 ? (
              <div className="content-list">
                {issues.slice(0, 5).map((issue) => (
                  <Link
                    to={`/repo/${id}/issues/${issue._id}`}
                    className="content-item issue-preview-item"
                    key={issue._id}
                  >
                    <div>
                      <strong>{issue.title || "Untitled issue"}</strong>

                      {issue.description && <span>{issue.description}</span>}
                    </div>

                    <span
                      className={`issue-preview-status ${
                        issue.status === "open" ? "open" : "closed"
                      }`}
                    >
                      {issue.status === "open" ? "Open" : "Closed"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No issues in this repository.</p>

                <Link
                  to={`/repo/${id}/issues/new`}
                  className="create-first-issue-link"
                >
                  Create the first issue
                </Link>
              </div>
            )}

            {issues.length > 5 && (
              <Link to={`/repo/${id}/issues`} className="view-more-issues">
                View all {issues.length} issues →
              </Link>
            )}
          </div>{" "}
        </section>
      </main>
    </>
  );
};

export default RepositoryDetails;
