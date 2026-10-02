import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/apiClient";
import Navbar from "../Navbar";
import "./issue.css";
import { useConfirm } from "../common/ConfirmContext";

const IssueDetails = () => {
  const { confirm } = useConfirm();
  const { id: repositoryId, issueId } = useParams();

  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("open");
  const [editLoading, setEditLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchIssue = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/issue/${issueId}`);

      const fetchedIssue = response.data.issue || response.data;

      setIssue(fetchedIssue);

      setEditTitle(fetchedIssue.title || "");

      setEditDescription(fetchedIssue.description || "");

      setEditStatus(fetchedIssue.status || "open");

      if (
        fetchedIssue.repository &&
        typeof fetchedIssue.repository === "object"
      ) {
        setRepository(fetchedIssue.repository);
      } else if (repositoryId) {
        const repositoryResponse = await api.get(`/repo/${repositoryId}`);

        setRepository(
          repositoryResponse.data.repository || repositoryResponse.data,
        );
      }
    } catch (err) {
      console.error("Cannot fetch issue:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to load issue.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssue();
  }, [issueId, repositoryId]);

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleOpenEdit = () => {
    setEditTitle(issue.title || "");
    setEditDescription(issue.description || "");
    setEditStatus(issue.status || "open");
    setError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (editLoading) return;

    setEditTitle(issue.title || "");
    setEditDescription(issue.description || "");
    setEditStatus(issue.status || "open");

    setError("");
    setIsEditing(false);
  };

  const handleUpdateIssue = async (event) => {
    event.preventDefault();

    const cleanTitle = editTitle.trim();
    const cleanDescription = editDescription.trim();

    if (!cleanTitle) {
      setError("Issue title is required.");
      return;
    }

    if (!cleanDescription) {
      setError("Issue description is required.");
      return;
    }

    try {
      setEditLoading(true);
      setError("");

      const response = await api.put(`/issue/update/${issueId}`, {
        title: cleanTitle,
        description: cleanDescription,
        status: editStatus,
      });

      const updatedIssue = response.data.issue || response.data;

      setIssue(updatedIssue);

      setEditTitle(updatedIssue.title || "");

      setEditDescription(updatedIssue.description || "");

      setEditStatus(updatedIssue.status || "open");

      setIsEditing(false);
    } catch (err) {
      console.error("Cannot update issue:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to update issue.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!issue) return;

    const nextStatus = issue.status === "open" ? "closed" : "open";

    try {
      setActionLoading(true);
      setError("");

      const response = await api.put(`/issue/update/${issueId}`, {
        title: issue.title,
        description: issue.description,
        status: nextStatus,
      });

      const updatedIssue = response.data.issue || response.data;

      setIssue(updatedIssue);

      setEditStatus(updatedIssue.status);
    } catch (err) {
      console.error("Cannot change issue status:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to change issue status.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!issue) return;

    const confirmed = await confirm({
      title: "Delete issue",

      message: `Delete issue "${issue.title}"? This action cannot be undone.`,

      confirmText: "Delete issue",

      cancelText: "Cancel",

      danger: true,
    });

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");

      await api.delete(`/issue/delete/${issueId}`);

      navigate(`/repo/${repositoryId}/issues`);
    } catch (err) {
      console.error("Cannot delete issue:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to delete issue.",
      );

      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-message">Loading issue...</p>
        </main>
      </>
    );
  }

  if (error && !issue) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-error">{error}</p>

          <button
            type="button"
            className="issue-secondary-btn"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </main>
      </>
    );
  }

  if (!issue) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-error">Issue not found.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="issue-page">
        <div className="issue-breadcrumb">
          <Link to="/">Repositories</Link>

          <span>/</span>

          <Link to={`/repo/${repositoryId}`}>
            {repository?.name || "Repository"}
          </Link>

          <span>/</span>

          <Link to={`/repo/${repositoryId}/issues`}>Issues</Link>

          <span>/</span>

          <span>#{issue._id.slice(-6)}</span>
        </div>

        <section className="issue-details-card">
          <div className="issue-details-header">
            <div>
              <div className="issue-details-status-title">
                <span
                  className={
                    issue.status === "open"
                      ? "issue-status open"
                      : "issue-status closed"
                  }
                >
                  {issue.status === "open" ? "Open" : "Closed"}
                </span>

                <h1>{issue.title}</h1>
              </div>

              <p className="issue-details-meta">
                #{issue._id.slice(-6)} · Opened {formatDate(issue.createdAt)}
              </p>
            </div>

            <div className="issue-action-group">
              <button
                type="button"
                className="issue-management-btn"
                onClick={handleToggleStatus}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Updating..."
                  : issue.status === "open"
                    ? "Close issue"
                    : "Reopen issue"}
              </button>

              <button
                type="button"
                className="issue-management-btn"
                onClick={handleOpenEdit}
                disabled={actionLoading}
              >
                Edit
              </button>

              <button
                type="button"
                className="issue-management-btn danger"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Working..." : "Delete"}
              </button>
            </div>
          </div>

          {error && <p className="issue-inline-error">{error}</p>}

          {isEditing ? (
            <form
              onSubmit={handleUpdateIssue}
              className="issue-form issue-edit-form"
            >
              <div className="issue-form-group">
                <label htmlFor="edit-issue-title">Title</label>

                <input
                  id="edit-issue-title"
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={150}
                  required
                />
              </div>

              <div className="issue-form-group">
                <label htmlFor="edit-issue-description">Description</label>

                <textarea
                  id="edit-issue-description"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={9}
                  required
                />
              </div>

              <div className="issue-form-group">
                <label htmlFor="edit-issue-status">Status</label>

                <select
                  id="edit-issue-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value)}
                >
                  <option value="open">Open</option>

                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="issue-form-actions">
                <button
                  type="button"
                  className="issue-secondary-btn"
                  onClick={handleCancelEdit}
                  disabled={editLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="issue-primary-btn"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="issue-description-box">
              <p>{issue.description}</p>

              <div className="issue-description-footer">
                <span>Created {formatDate(issue.createdAt)}</span>

                {issue.updatedAt && issue.updatedAt !== issue.createdAt && (
                  <span>Updated {formatDate(issue.updatedAt)}</span>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default IssueDetails;
