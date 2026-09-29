import React, { useState, useEffect } from "react";
import axios from "axios";
import "./dashboard.css";
import Navbar from "../Navbar";

const Dashboard = () => {
  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedRepositories, setSuggestedRepositories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    const fetchRepositories = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3002/repo/user/${userId}`
        );

        setRepositories(response.data.repositories);
      } catch (err) {
        console.error("Error while fetching repositories:", err);
      }
    };

    const fetchSuggestedRepositories = async () => {
      try {
        const response = await axios.get("http://localhost:3002/repo/all");

        setSuggestedRepositories(response.data);
      } catch (err) {
        console.error("Error while fetching repositories:", err);
      }
    };

    fetchRepositories();
    fetchSuggestedRepositories();
  }, []);

  useEffect(() => {
    if (searchQuery === "") {
      setSearchResults(repositories);
    } else {
      const filteredRepo = repositories.filter((repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            {suggestedRepositories.map((repo) => (
              <div className="repo-card" key={repo._id}>
                <h4>{repo.name}</h4>
                {repo.description && <p>{repo.description}</p>}
              </div>
            ))}
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
              <div className="repo-card" key={repo._id}>
                <h4>{repo.name}</h4>
                {repo.description && <p>{repo.description}</p>}
              </div>
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