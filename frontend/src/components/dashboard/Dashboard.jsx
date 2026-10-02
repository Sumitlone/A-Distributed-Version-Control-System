import React, { useState, useEffect } from "react";
import api from "../../api/apiClient";
import { Link, useNavigate } from "react-router-dom";
import "./dashboard.css";
import Navbar from "../Navbar";

const Dashboard = () => {
  const navigate = useNavigate();

  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedRepositories, setSuggestedRepositories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  const [starredRepoIds, setStarredRepoIds] = useState([]);
  const [starLoadingId, setStarLoadingId] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    const fetchRepositories = async () => {
      try {
        const response = await api.get(`/repo/user/${userId}`);

        setRepositories(response.data.repositories);
      } catch (err) {
        console.error("Error while fetching repositories:", err);
      }
    };

    const fetchSuggestedRepositories = async () => {
      try {
        const response = await api.get("/repo/all");

        setSuggestedRepositories(response.data);
      } catch (err) {
        console.error("Error while fetching repositories:", err);
      }
    };

    const fetchStarredRepositories = async () => {
      if (!userId) return;

      try {
        const response = await api.get(`/userProfile/${userId}/starred`);

        const starredRepositories = response.data.starredRepositories || [];

        setStarredRepoIds(starredRepositories.map((repo) => String(repo._id)));
      } catch (err) {
        console.error("Error while fetching starred repositories:", err);
      }
    };

    fetchRepositories();
    fetchSuggestedRepositories();
    fetchStarredRepositories();
  }, []);

  useEffect(() => {
    if (searchQuery === "") {
      setSearchResults(repositories);
    } else {
      const filteredRepo = repositories.filter((repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      setSearchResults(filteredRepo);
    }
  }, [searchQuery, repositories]);

  return (
    <>
      <Navbar />

      <section id="dashboard">
        {/* Suggested Repositories */}
        <aside className="dashboard-sidebar">
          <h3>Suggested Repositories</h3>

          <div className="repo-list">
            {suggestedRepositories.map((repo) => {
              const repoId = String(repo._id);

              const isStarred = starredRepoIds.includes(repoId);

              const handleStar = async (event) => {
                /*
                  Prevent the click from doing anything
                  to the repository link.
                */
                event.preventDefault();
                event.stopPropagation();

                const userId = localStorage.getItem("userId");

                if (!userId || starLoadingId === repoId) {
                  return;
                }

                try {
                  setStarLoadingId(repoId);

                  const response = await api.patch(
                    `/userProfile/${userId}/star/${repoId}`,
                  );

                  setStarredRepoIds((current) => {
                    if (response.data.starred) {
                      return current.includes(repoId)
                        ? current
                        : [...current, repoId];
                    }

                    return current.filter((id) => id !== repoId);
                  });
                } catch (err) {
                  console.error(
                    "Error while updating starred repository:",
                    err,
                  );
                } finally {
                  setStarLoadingId(null);
                }
              };

              return (
                <div className="repo-card suggested-repo-card" key={repoId}>
                  {/* Repository */}
                  <Link to={`/repo/${repoId}`} className="repo-card-link">
                    <h4>{repo.name}</h4>

                    {repo.description && <p>{repo.description}</p>}
                  </Link>

                  {/* Star Button */}
                  <button
                    type="button"
                    className={`repo-star-btn ${isStarred ? "starred" : ""}`}
                    onClick={handleStar}
                    disabled={starLoadingId === repoId}
                    aria-label={
                      isStarred ? `Unstar ${repo.name}` : `Star ${repo.name}`
                    }
                    title={isStarred ? "Unstar repository" : "Star repository"}
                  >
                    {isStarred ? "★" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Your Repositories */}
        <main className="repositories-section">
          <div className="repositories-header">
            <h2>Your Repositories</h2>

            <div id="search">
              <input
                type="text"
                value={searchQuery}
                placeholder="Search repositories..."
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="repo-list">
            {searchResults.map((repo) => (
              <Link
                to={`/repo/${repo._id}`}
                className="repo-card repo-card-link-wrapper"
                key={repo._id}
              >
                <h4>{repo.name}</h4>

                {repo.description && <p>{repo.description}</p>}
              </Link>
            ))}

            {searchResults.length === 0 && (
              <p className="no-results">No repositories found.</p>
            )}
          </div>
        </main>

        {/* Upcoming Events */}
        <aside className="events-sidebar">
          <h3>Upcoming Events</h3>

          <ul>
            <li>
              <p>Tech Conference - Dec 15</p>
            </li>
            <li>
              <p>Developer Meetup - Dec 25</p>
            </li>
            <li>
              <p>React Summit - Jan 5</p>
            </li>
          </ul>
        </aside>
      </section>
    </>
  );
};

export default Dashboard;
