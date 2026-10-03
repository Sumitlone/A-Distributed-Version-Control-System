import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/apiClient";
import "./repositoryActivity.css";

const formatDate = (date) => {
  if (!date) return "Unknown date";

  return new Date(date).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const RepositoryActivity = ({ repoId }) => {
  const [commits, setCommits] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError("");

        const [commitResponse, issueResponse] = await Promise.all([
          api.get(`/vcs/${repoId}/commits`),
          api.get(`/issue/all/${repoId}`),
        ]);

        setCommits(commitResponse.data.commits || []);

        setIssues(
          Array.isArray(issueResponse.data)
            ? issueResponse.data
            : issueResponse.data.issues || [],
        );
      } catch (err) {
        console.error("Cannot fetch repository activity:", err);

        setError(
          err.response?.data?.message || "Unable to load repository activity.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [repoId]);

  const activity = useMemo(() => {
    const commitActivity = commits.map((commit) => ({
      type: "commit",
      title: commit.message || "Commit",
      description: `${commit.fileCount || 0} file${
        commit.fileCount === 1 ? "" : "s"
      }`,
      date: commit.date,
      to: `/repo/${repoId}/vcs/commits/${commit.commitId}`,
    }));

    const issueActivity = issues.map((issue) => ({
      type: "issue",
      title: issue.title || "Issue",
      description: `${issue.status === "closed" ? "Closed" : "Open"} issue`,
      date: issue.updatedAt || issue.createdAt,
      to: `/repo/${repoId}/issues/${issue._id}`,
    }));

    return [...commitActivity, ...issueActivity]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 10);
  }, [commits, issues, repoId]);

  return (
    <section className="repository-activity-card">
      <div className="repository-activity-heading">
        <div>
          <h2>Recent activity</h2>
          <p>Latest commits and issue updates.</p>
        </div>
      </div>

      {loading ? (
        <div className="activity-loading-list">
          {[1, 2, 3].map((item) => (
            <div className="activity-skeleton" key={item} />
          ))}
        </div>
      ) : error ? (
        <p className="activity-error">{error}</p>
      ) : activity.length === 0 ? (
        <p className="activity-empty">No activity yet.</p>
      ) : (
        <div className="repository-activity-list">
          {activity.map((item, index) => (
            <Link
              to={item.to}
              className="repository-activity-item"
              key={`${item.type}-${item.title}-${index}`}
            >
              <span className={`activity-dot ${item.type}`} />

              <div className="activity-main">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>

              <time>{formatDate(item.date)}</time>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default RepositoryActivity;
