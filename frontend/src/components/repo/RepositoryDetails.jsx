import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/apiClient";
import Navbar from "../Navbar";
import RepositoryTabs from "./RepositoryTabs";
import ReadmeViewer from "./ReadmeViewer";
import RepositoryActivity from "./RepositoryActivity";
import "./repositoryDetails.css";

const RepositoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");

  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isStarred, setIsStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/repo/${id}`);

        const repo = response.data.repository || response.data;

        setRepository(repo);
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
        const response = await api.get(`/userProfile/${userId}/starred`);

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


  const content = Array.isArray(repository?.content) ? repository.content : [];

  const issues = Array.isArray(repository?.issues) ? repository.issues : [];

  const handleStar = async () => {
    if (!userId || !id) return;

    try {
      setStarLoading(true);

      const response = await api.patch(`/userProfile/${userId}/star/${id}`);

      setIsStarred(Boolean(response.data.starred));
    } catch (err) {
      console.error("Cannot update starred repository:", err);
    } finally {
      setStarLoading(false);
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

        <RepositoryTabs />

        <ReadmeViewer repoId={id} />
        {error && <p className="repo-inline-error">{error}</p>}


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
        <RepositoryActivity repoId={id} />
      </main>
    </>
  );
};

export default RepositoryDetails;
