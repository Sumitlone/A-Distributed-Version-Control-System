import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Navbar from "../Navbar";
import "./createRepository.css";

const CreateRepository = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleVisibilityChange = (event) => {
    setFormData((current) => ({
      ...current,
      visibility: event.target.value === "public",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const userId = localStorage.getItem("userId");
    const name = formData.name.trim();
    const description = formData.description.trim();

    if (!userId) {
      setError("Please log in before creating a repository.");
      return;
    }

    if (!name) {
      setError("Repository name is required.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.post(`/repo/create`, {
        name,
        description,
        visibility: formData.visibility,
      });

      const repositoryId = response.data.repositoryID;

      if (repositoryId) {
        navigate(`/repo/${repositoryId}`);
        return;
      }

      navigate("/");
    } catch (err) {
      console.error("Error while creating repository:", err);

      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to create repository. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="create-repository-page">
        <div className="create-repository-card">
          <div className="create-repository-heading">
            <h1>Create a new repository</h1>

            <p>
              A repository is where you store and manage your project content.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="create-repository-form">
            <div className="form-group">
              <label htmlFor="repository-name">Repository name</label>

              <input
                id="repository-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="my-project"
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="repository-description">
                Description <span>(optional)</span>
              </label>

              <textarea
                id="repository-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="What is this repository about?"
                rows={5}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <span className="form-label">Visibility</span>

              <label className="visibility-option">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={formData.visibility === true}
                  onChange={handleVisibilityChange}
                />

                <span>
                  <strong>Public</strong>
                  <small>Anyone can view this repository.</small>
                </span>
              </label>

              <label className="visibility-option">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={formData.visibility === false}
                  onChange={handleVisibilityChange}
                />

                <span>
                  <strong>Private</strong>
                  <small>Only you can view this repository.</small>
                </span>
              </label>
            </div>

            {error && <p className="create-repository-error">{error}</p>}

            <div className="create-repository-actions">
              <button
                type="button"
                className="secondary-action-btn"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-action-btn"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create repository"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateRepository;
