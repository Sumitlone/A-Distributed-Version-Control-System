import React, { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import axios from "axios";
import Navbar from "../Navbar";
import "./vcs.css";

const API_URL = "http://localhost:3002";

const CommitHistory = () => {
  const { id } = useParams();

  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);

  const [commits, setCommits] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const [repoResponse, historyResponse] = await Promise.all([
          axios.get(`${API_URL}/repo/${id}`),

          axios.get(`${API_URL}/vcs/${id}/commits`),
        ]);

        setRepository(repoResponse.data.repository || repoResponse.data);

        setCommits(historyResponse.data.commits || []);
      } catch (err) {
        console.error("Cannot fetch commit history:", err);

        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load commit history.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [id]);

  const formatDate = (date) => {
    if (!date) {
      return "Unknown date";
    }

    return new Date(date).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-message">Loading commit history...</p>
        </main>
      </>
    );
  }

  if (error || !repository) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-error">{error || "Repository not found."}</p>

          <button
            type="button"
            className="vcs-secondary-btn"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="vcs-page">
        <div className="vcs-breadcrumb">
          <Link to="/">Repositories</Link>

          <span>/</span>

          <Link to={`/repo/${id}`}>{repository.name}</Link>

          <span>/</span>

          <span>Commit history</span>
        </div>

        <div className="vcs-header">
          <div>
            <h1>Commit history</h1>

            <p>
              {commits.length} commit
              {commits.length !== 1 ? "s" : ""} in {repository.name}.
            </p>
          </div>

          <Link to={`/repo/${id}/vcs`} className="vcs-secondary-btn">
            Version Control
          </Link>
        </div>

        {commits.length > 0 ? (
          <section className="commit-history-list">
            {commits.map((commit) => (
              <Link
                key={commit.commitId}
                to={`/repo/${id}/vcs/commits/${commit.commitId}`}
                className="commit-history-item"
              >
                <div className="commit-history-main">
                  <h2>{commit.message || "No commit message"}</h2>

                  <p>{commit.commitId}</p>

                  <span>
                    {commit.fileCount} file
                    {commit.fileCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <time>{formatDate(commit.date)}</time>
              </Link>
            ))}
          </section>
        ) : (
          <div className="vcs-empty-state">
            <h2>No commits yet</h2>

            <p>Create your first commit from the Version Control page.</p>

            <Link to={`/repo/${id}/vcs`} className="vcs-primary-btn">
              Create first commit
            </Link>
          </div>
        )}
      </main>
    </>
  );
};

export default CommitHistory;
