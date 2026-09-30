import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import "./issue.css";

const API_URL = "http://localhost:3002";

const IssueList = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] =
    useState(null);

  const [issues, setIssues] = useState([]);

  const [activeFilter, setActiveFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          repositoryResponse,
          issuesResponse,
        ] = await Promise.all([
          axios.get(`${API_URL}/repo/${id}`),
          axios.get(`${API_URL}/issue/all/${id}`),
        ]);

        setRepository(
          repositoryResponse.data.repository ||
            repositoryResponse.data,
        );

        setIssues(
          Array.isArray(issuesResponse.data)
            ? issuesResponse.data
            : issuesResponse.data.issues || [],
        );
      } catch (err) {
        console.error(
          "Cannot fetch issues:",
          err,
        );

        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Unable to load issues.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [id]);

  const filteredIssues = useMemo(() => {
    if (activeFilter === "all") {
      return issues;
    }

    return issues.filter(
      (issue) =>
        issue.status === activeFilter,
    );
  }, [issues, activeFilter]);

  const openCount = issues.filter(
    (issue) => issue.status === "open",
  ).length;

  const closedCount = issues.filter(
    (issue) => issue.status === "closed",
  ).length;

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-message">
            Loading issues...
          </p>
        </main>
      </>
    );
  }

  if (error || !repository) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-error">
            {error ||
              "Repository not found."}
          </p>

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

  return (
    <>
      <Navbar />

      <main className="issue-page">

        <div className="issue-breadcrumb">
          <Link to="/">
            Repositories
          </Link>

          <span>/</span>

          <Link to={`/repo/${id}`}>
            {repository.name}
          </Link>

          <span>/</span>

          <span>Issues</span>
        </div>

        <div className="issue-list-header">

          <div>
            <h1>Issues</h1>

            <p>
              Track and manage issues for{" "}
              <strong>
                {repository.name}
              </strong>
            </p>
          </div>

          <Link
            to={`/repo/${id}/issues/new`}
            className="issue-primary-btn"
          >
            New issue
          </Link>

        </div>

        <div className="issue-summary">

          <span>
            <strong>{openCount}</strong>{" "}
            Open
          </span>

          <span>
            <strong>{closedCount}</strong>{" "}
            Closed
          </span>

          <span>
            <strong>{issues.length}</strong>{" "}
            Total
          </span>

        </div>

        <div className="issue-filters">

          <button
            type="button"
            className={
              activeFilter === "all"
                ? "issue-filter active"
                : "issue-filter"
            }
            onClick={() =>
              setActiveFilter("all")
            }
          >
            All
          </button>

          <button
            type="button"
            className={
              activeFilter === "open"
                ? "issue-filter active"
                : "issue-filter"
            }
            onClick={() =>
              setActiveFilter("open")
            }
          >
            Open
          </button>

          <button
            type="button"
            className={
              activeFilter === "closed"
                ? "issue-filter active"
                : "issue-filter"
            }
            onClick={() =>
              setActiveFilter("closed")
            }
          >
            Closed
          </button>

        </div>

        <section className="issue-list-container">

          {filteredIssues.length > 0 ? (
            filteredIssues.map(
              (issue) => (
                <Link
                  key={issue._id}
                  to={`/repo/${id}/issues/${issue._id}`}
                  className="issue-list-item"
                >
                  <div className="issue-list-main">

                    <div className="issue-title-row">

                      <span
                        className={
                          issue.status === "open"
                            ? "issue-status open"
                            : "issue-status closed"
                        }
                      >
                        {issue.status ===
                        "open"
                          ? "Open"
                          : "Closed"}
                      </span>

                      <h2>
                        {issue.title}
                      </h2>

                    </div>

                    <p className="issue-list-description">
                      {issue.description}
                    </p>

                    <p className="issue-list-meta">
                      Created{" "}
                      {formatDate(
                        issue.createdAt,
                      )}
                    </p>

                  </div>

                  <span className="issue-arrow">
                    →
                  </span>
                </Link>
              ),
            )
          ) : (
            <div className="issue-empty-state">

              <h2>
                No{" "}
                {activeFilter === "all"
                  ? ""
                  : activeFilter}{" "}
                issues
              </h2>

              <p>
                There are no issues matching
                this filter.
              </p>

              {activeFilter === "all" && (
                <Link
                  to={`/repo/${id}/issues/new`}
                  className="issue-primary-btn"
                >
                  Create your first issue
                </Link>
              )}

            </div>
          )}

        </section>

      </main>
    </>
  );
};

export default IssueList;