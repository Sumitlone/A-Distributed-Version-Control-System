import React, { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../../api/apiClient";
import Navbar from "../Navbar";
import "./vcs.css";

import { useConfirm } from "../common/ConfirmContext";

const shortCommitId = (commitId) =>
  commitId ? commitId.slice(0, 8) : "unknown";

const CommitDetails = () => {
  const { confirm } = useConfirm();

  const { id, commitId } = useParams();

  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);

  const [commit, setCommit] = useState(null);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [revertCommitId, setRevertCommitId] = useState(null);

  useEffect(() => {
    const fetchCommit = async () => {
      try {
        setLoading(true);
        setError("");

        const [repoResponse, commitResponse] = await Promise.all([
          api.get(`/repo/${id}`),

          api.get(`/vcs/${id}/commits/${commitId}`),
        ]);

        setRepository(repoResponse.data.repository || repoResponse.data);

        setCommit(commitResponse.data.commit);
      } catch (err) {
        console.error("Cannot fetch commit:", err);

        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load commit.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCommit();
  }, [id, commitId]);

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

  const handleRevert = async () => {
    if (!commit) {
      return;
    }

    const confirmed = await confirm({
      title: "Create revert commit",

      message: `Create a new commit that restores the workspace to "${commit.message}"? This will preserve history and will need to be pushed to S3.`,

      confirmText: "Create revert",

      cancelText: "Cancel",

      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);

      setError("");
      setNotice("");
      setRevertCommitId(null);

      const response = await api.post(`/vcs/${id}/revert/${commitId}`, {});

      const newCommit = response.data.commit;

      if (newCommit?.commitId) {
        setRevertCommitId(newCommit.commitId);
      }

      setNotice(
        `Revert commit ${shortCommitId(
          newCommit?.commitId,
        )} created locally. Push it to synchronize the reverted state with S3.`,
      );
    } catch (err) {
      console.error("Cannot revert commit:", err);

      setError(
        err.response?.data?.message || "Unable to create revert commit.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-message">Loading commit...</p>
        </main>
      </>
    );
  }

  if (error || !commit || !repository) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-error">{error || "Commit not found."}</p>

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

          <Link to={`/repo/${id}/vcs/history`}>Commit history</Link>

          <span>/</span>

          <span>{shortCommitId(commit.commitId)}</span>
        </div>

        <section className="commit-details-card">
          <div className="commit-details-header">
            <div>
              <div className="commit-details-title-row">
                <h1>{commit.message || "No commit message"}</h1>

                <span
                  className={
                    commit.pushed
                      ? "vcs-commit-badge pushed"
                      : "vcs-commit-badge local"
                  }
                >
                  {commit.pushed ? "Remote" : "Unpushed"}
                </span>
              </div>

              <p>{commit.commitId}</p>

              <time>{formatDate(commit.date)}</time>
            </div>

            <button
              type="button"
              className="vcs-danger-btn"
              onClick={handleRevert}
              disabled={actionLoading}
            >
              {actionLoading ? "Creating revert..." : "Create revert commit"}
            </button>
          </div>

          {notice && (
            <div className="vcs-success">
              {notice}

              {revertCommitId && (
                <Link
                  to={`/repo/${id}/vcs/commits/${revertCommitId}`}
                  className="vcs-inline-link"
                >
                  View revert commit
                </Link>
              )}
            </div>
          )}

          {error && <div className="vcs-error">{error}</div>}

          <div className="commit-details-summary">
            <span>
              <strong>{commit.files.length}</strong> file
              {commit.files.length !== 1 ? "s" : ""}
            </span>

            <span>
              Parent: <strong>{shortCommitId(commit.parent)}</strong>
            </span>

            {commit.reverts && (
              <span>
                Reverts: <strong>{shortCommitId(commit.reverts)}</strong>
              </span>
            )}

            <span>Created {formatDate(commit.date)}</span>
          </div>

          <div className="commit-files-list">
            {commit.files.length > 0 ? (
              commit.files.map((file) => (
                <article className="commit-file-card" key={file.name}>
                  <div className="commit-file-name">{file.name}</div>

                  <pre>{file.content}</pre>
                </article>
              ))
            ) : (
              <div className="vcs-empty-state small">
                This commit contains no files.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default CommitDetails;
