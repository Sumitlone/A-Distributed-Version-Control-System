import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/apiClient";
import "./dashboard.css";
import Navbar from "../Navbar";
import Alert from "../common/Alert";

const Dashboard = () => {
  const [repositories, setRepositories] = useState([]);
  const [suggestedRepositories, setSuggestedRepositories] = useState([]);
  const [starredRepoIds, setStarredRepoIds] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("repositories");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [starLoadingId, setStarLoadingId] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          repoResponse,
          suggestedResponse,
          starredResponse,
          statsResponse,
        ] = await Promise.all([
          api.get(`/repo/user/${userId}`).catch((err) => {
            if (err.response?.status === 404) {
              return { data: { repositories: [] } };
            }
            throw err;
          }),
          api.get("/repo/all"),
          api.get(`/userProfile/${userId}/starred`),
          api.get("/dashboard/stats"),
        ]);

        setRepositories(repoResponse.data.repositories || []);
        setSuggestedRepositories(suggestedResponse.data || []);

        const starred = starredResponse.data.starredRepositories || [];
        setStarredRepoIds(starred.map((repo) => String(repo._id)));

        setStats(statsResponse.data);
      } catch (err) {
        console.error("Error while loading dashboard:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchError("");
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError("");

        const endpoint =
          searchType === "repositories"
            ? `/repo/search?q=${encodeURIComponent(query)}`
            : `/users/search?q=${encodeURIComponent(query)}`;

        const response = await api.get(endpoint);
        setSearchResults(response.data || []);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchError(
          err.response?.data?.message || "Search failed. Please try again.",
        );
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [searchQuery, searchType]);

  const handleStar = async (event, repoId) => {
    event.preventDefault();
    event.stopPropagation();

    const userId = localStorage.getItem("userId");

    if (!userId || starLoadingId === repoId) return;

    try {
      setStarLoadingId(repoId);

      const response = await api.patch(`/userProfile/${userId}/star/${repoId}`);

      setStarredRepoIds((current) => {
        if (response.data.starred) {
          return current.includes(repoId) ? current : [...current, repoId];
        }

        return current.filter((id) => id !== repoId);
      });

      setStats((current) =>
        current
          ? {
              ...current,
              starredRepositories: Math.max(
                0,
                current.starredRepositories + (response.data.starred ? 1 : -1),
              ),
            }
          : current,
      );
    } catch (err) {
      console.error("Error while updating starred repository:", err);
      setError(err.response?.data?.message || "Unable to update star status.");
    } finally {
      setStarLoadingId(null);
    }
  };

  return (
    <>
      <Navbar />

      <main className="dashboard-page">
        {error && (
          <div className="dashboard-alert-wrap">
            <Alert type="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <section className="dashboard-loading-state">
            <div className="dashboard-skeleton-search" />
            <div className="dashboard-skeleton-content" />
          </section>
        ) : (
          <>
            <section className="dashboard-search-panel">
              <div className="dashboard-search-header">
                <div>
                  <h2>Search VCS</h2>
                  <p>Find repositories or users across your workspace.</p>
                </div>

                <div className="dashboard-search-tabs">
                  <button
                    type="button"
                    className={searchType === "repositories" ? "active" : ""}
                    onClick={() => {
                      setSearchType("repositories");
                      setSearchResults([]);
                    }}
                  >
                    Repositories
                  </button>

                  <button
                    type="button"
                    className={searchType === "users" ? "active" : ""}
                    onClick={() => {
                      setSearchType("users");
                      setSearchResults([]);
                    }}
                  >
                    Users
                  </button>
                </div>
              </div>

              <input
                className="dashboard-search-input"
                type="search"
                value={searchQuery}
                placeholder={
                  searchType === "repositories"
                    ? "Search by repository name or description..."
                    : "Search by username..."
                }
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchQuery.trim() && (
                <div className="dashboard-search-results">
                  {searchLoading ? (
                    <p className="dashboard-search-muted">Searching...</p>
                  ) : searchError ? (
                    <p className="dashboard-search-error">{searchError}</p>
                  ) : searchResults.length === 0 ? (
                    <p className="dashboard-search-muted">No results found.</p>
                  ) : searchType === "repositories" ? (
                    searchResults.map((repo) => (
                      <Link
                        to={`/repo/${repo._id}`}
                        className="dashboard-search-result"
                        key={repo._id}
                      >
                        <div>
                          <strong>{repo.name}</strong>
                          <span>{repo.description || "No description"}</span>
                        </div>

                        <small>{repo.owner?.username || "Unknown owner"}</small>
                      </Link>
                    ))
                  ) : (
                    searchResults.map((user) => (
                      <Link
                        to={`/user/${user._id}`}
                        className="dashboard-search-result"
                        key={user._id}
                      >
                        <div>
                          <strong>{user.username}</strong>
                          <span>View profile</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </section>

            <section id="dashboard">
              <aside className="dashboard-sidebar">
                <div className="dashboard-section-title">
                  <h3>Suggested Repositories</h3>
                  <span>{suggestedRepositories.length}</span>
                </div>

                <div className="repo-list">
                  {suggestedRepositories.slice(0, 8).map((repo) => {
                    const repoId = String(repo._id);
                    const isStarred = starredRepoIds.includes(repoId);

                    return (
                      <div
                        className="repo-card suggested-repo-card"
                        key={repoId}
                      >
                        <Link to={`/repo/${repoId}`} className="repo-card-link">
                          <h4>{repo.name}</h4>

                          {repo.description && <p>{repo.description}</p>}

                          <small>
                            {repo.owner?.username || "Unknown owner"}
                          </small>
                        </Link>

                        <button
                          type="button"
                          className={`repo-star-btn ${
                            isStarred ? "starred" : ""
                          }`}
                          onClick={(event) => handleStar(event, repoId)}
                          disabled={starLoadingId === repoId}
                          aria-label={
                            isStarred
                              ? `Unstar ${repo.name}`
                              : `Star ${repo.name}`
                          }
                        >
                          {isStarred ? "★" : "☆"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="repositories-section">
                <div className="repositories-header">
                  <div>
                    <h2>Your Repositories</h2>
                    <p>{repositories.length} repositories</p>
                  </div>

                  <Link to="/create" className="dashboard-inline-link">
                    Create repository →
                  </Link>
                </div>

                <div className="repo-list">
                  {repositories.map((repo) => (
                    <Link
                      to={`/repo/${repo._id}`}
                      className="repo-card repo-card-link-wrapper"
                      key={repo._id}
                    >
                      <div className="dashboard-repo-title-row">
                        <h4>{repo.name}</h4>

                        <span
                          className={
                            repo.visibility
                              ? "dashboard-visibility public"
                              : "dashboard-visibility private"
                          }
                        >
                          {repo.visibility ? "Public" : "Private"}
                        </span>
                      </div>

                      {repo.description && <p>{repo.description}</p>}
                    </Link>
                  ))}

                  {repositories.length === 0 && (
                    <div className="dashboard-empty-state">
                      <h3>No repositories yet</h3>

                      <p>
                        Create your first repository to start using the VCS.
                      </p>

                      <Link to="/create" className="dashboard-create-btn">
                        Create repository
                      </Link>
                    </div>
                  )}
                </div>
              </section>

              <aside className="events-sidebar">
                <div className="dashboard-section-title">
                  <h3>Workspace snapshot</h3>
                </div>

                <div className="dashboard-side-card">
                  <span>Starred</span>
                  <strong>{stats?.starredRepositories ?? 0}</strong>
                  <small>Repositories you starred</small>
                </div>

                <div className="dashboard-side-card">
                  <span>Followers</span>
                  <strong>{stats?.followers ?? 0}</strong>
                  <small>People following you</small>
                </div>

                <div className="dashboard-side-card">
                  <span>Following</span>
                  <strong>{stats?.following ?? 0}</strong>
                  <small>People you follow</small>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </>
  );
};

export default Dashboard;
