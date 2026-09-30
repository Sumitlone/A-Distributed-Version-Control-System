import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import "./repositoryDetails.css";

const RepositoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isStarred, setIsStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  const userId = localStorage.getItem("userId");

  // Fetch repository details
  useEffect(() => {
    const fetchRepository = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await axios.get(`http://localhost:3002/repo/${id}`);

        setRepository(response.data.repository || response.data);
      } catch (err) {
        console.error("Cannot fetch repository: ", err);
        setError("Unable to load repository.");
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  // Check whether current user has starred this repository
  useEffect(() => {
    const fetchStarredStatus = async () => {
      if (!userId || !id) return;

      try {
        const response = await axios.get(
          `http://localhost:3002/userProfile/${userId}/starred`,
        );

        const starredRepos = response.data.starredRepositories || [];

        setIsStarred(
          starredRepos.some((repo) => String(repo._id) === String(id)),
        );
      } catch (err) {
        console.error("Cannot fetch starred repositories: ", err);
      }
    };

    fetchStarredStatus();
  }, [id, userId]);

  // Star / Unstar
  const handleStar = async () => {
    if (!userId) return;

    try {
      setStarLoading(true);

      const response = await axios.patch(
        `http://localhost:3002/userProfile/${userId}/star/${id}`,
      );

      setIsStarred(response.data.starred);
    } catch (err) {
      console.error("Cannot update starred repository: ", err);
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

  const content = Array.isArray(repository.content) ? repository.content : [];

  const issues = Array.isArray(repository.issues) ? repository.issues : [];

  return (
    <>
      <Navbar />

      <main className="repo-details-page">
        {/* Header */}
        <div className="repo-details-header">
          <div>
            <div className="breadcrumb">
              <Link to="/">Repositories</Link>

              <span>/</span>

              <span>{repository.name}</span>
            </div>

            <h1>{repository.name}</h1>

            <p className="repo-owner">
              Owned by{" "}
              <strong>{repository.owner?.username || "Unknown user"}</strong>
            </p>

            {repository.description && (
              <p className="repo-details-description">
                {repository.description}
              </p>
            )}
          </div>

          {/* Star Button */}
          <button
            className={`star-btn ${isStarred ? "starred" : ""}`}
            onClick={handleStar}
            disabled={starLoading}
          >
            {starLoading ? "Saving..." : isStarred ? "★ Starred" : "☆ Star"}
          </button>
        </div>

        {/* Repository Details */}
        <section className="repo-details-grid">
          {/* Information */}
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
            <h2>Issues</h2>

            {issues.length > 0 ? (
              <div className="content-list">
                {issues.map((issue) => (
                  <div className="content-item" key={issue._id}>
                    <strong>{issue.title || "Untitled issue"}</strong>

                    {issue.description && <span>{issue.description}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No issues in this repository.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default RepositoryDetails;
