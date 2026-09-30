import React, { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import "./issue.css";

const API_URL = "http://localhost:3002";

const CreateIssue = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] =
    useState(null);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/repo/${id}`,
        );

        setRepository(
          response.data.repository ||
            response.data,
        );
      } catch (err) {
        console.error(
          "Cannot fetch repository:",
          err,
        );

        setError(
          err.response?.data?.error ||
            "Unable to load repository.",
        );
      } finally {
        setPageLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription =
      description.trim();

    if (!cleanTitle) {
      setError("Issue title is required.");
      return;
    }

    if (!cleanDescription) {
      setError(
        "Issue description is required.",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axios.post(
        `${API_URL}/issue/create/${id}`,
        {
          title: cleanTitle,
          description: cleanDescription,
        },
      );

      const issue =
        response.data.issue ||
        response.data;

      if (issue?._id) {
        navigate(
          `/repo/${id}/issues/${issue._id}`,
        );
      } else {
        navigate(`/repo/${id}/issues`);
      }
    } catch (err) {
      console.error(
        "Cannot create issue:",
        err,
      );

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to create issue.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Navbar />

        <main className="issue-page">
          <p className="issue-message">
            Loading repository...
          </p>
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
            {repository?.name ||
              "Repository"}
          </Link>

          <span>/</span>

          <Link
            to={`/repo/${id}/issues`}
          >
            Issues
          </Link>

          <span>/</span>

          <span>New Issue</span>
        </div>

        <section className="issue-form-card">

          <div className="issue-form-header">
            <h1>
              Create a new issue
            </h1>

            <p>
              Report a bug, request a feature,
              or describe something that needs
              attention.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="issue-form"
          >

            <div className="issue-form-group">

              <label htmlFor="issue-title">
                Title
              </label>

              <input
                id="issue-title"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(
                    event.target.value,
                  );
                  setError("");
                }}
                placeholder="Issue title"
                maxLength={150}
                required
              />

            </div>

            <div className="issue-form-group">

              <label htmlFor="issue-description">
                Description
              </label>

              <textarea
                id="issue-description"
                value={description}
                onChange={(event) => {
                  setDescription(
                    event.target.value,
                  );
                  setError("");
                }}
                placeholder="Describe the issue in detail..."
                rows={9}
                required
              />

            </div>

            {error && (
              <p className="issue-inline-error">
                {error}
              </p>
            )}

            <div className="issue-form-actions">

              <Link
                to={`/repo/${id}/issues`}
                className="issue-secondary-btn"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="issue-primary-btn"
                disabled={loading}
              >
                {loading
                  ? "Creating..."
                  : "Create issue"}
              </button>

            </div>

          </form>

        </section>

      </main>
    </>
  );
};

export default CreateIssue;