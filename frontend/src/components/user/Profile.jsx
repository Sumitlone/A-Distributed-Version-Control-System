import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import "./profile.css";
import Navbar from "../Navbar";
import { UnderlineNav } from "@primer/react";
import { BookIcon, RepoIcon } from "@primer/octicons-react";
import HeatMapProfile from "./HeatMap";
import { useAuth } from "../../authContext";

const Profile = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const [userDetails, setUserDetails] = useState(null);
  const [userRepositories, setUserRepositories] = useState([]);
  const [starredRepositories, setStarredRepositories] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfileData = async () => {
      const userId = localStorage.getItem("userId");

      if (!userId) {
        navigate("/auth");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          profileResponse,
          repositoriesResponse,
          starredResponse,
          followersResponse,
          followingResponse,
        ] = await Promise.all([
          api.get(`/userProfile/${userId}`),

          api.get(`/repo/user/${userId}`).catch((err) => {
            if (err.response?.status === 404) {
              return {
                data: {
                  repositories: [],
                },
              };
            }

            throw err;
          }),

          api.get(`/userProfile/${userId}/starred`),
          api.get(`/userProfile/${userId}/followers`),
          api.get(`/userProfile/${userId}/following`),
        ]);

        setUserDetails(profileResponse.data);
        setUserRepositories(repositoriesResponse.data.repositories || []);
        setStarredRepositories(starredResponse.data.starredRepositories || []);
        setFollowers(followersResponse.data.followers || []);
        setFollowing(followingResponse.data.following || []);
      } catch (err) {
        console.error("Cannot fetch profile data:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");

    setCurrentUser(null);
    navigate("/auth");
  };

  const renderUserList = (users, emptyMessage) => {
    if (users.length === 0) {
      return (
        <div className="profile-empty-state">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="profile-user-list">
        {users.map((user) => (
          <Link
            key={user._id}
            to={`/user/${user._id}`}
            className="profile-user-card"
          >
            <div className="profile-user-avatar">
              {user.username?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div>
              <strong>{user.username}</strong>

              <span>View profile</span>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="profile-loading">Loading profile...</main>
      </>
    );
  }

  if (error || !userDetails) {
    return (
      <>
        <Navbar />

        <main className="profile-loading">
          <p>{error || "Profile not found."}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <UnderlineNav aria-label="Profile navigation" className="profile-tabs">
        <UnderlineNav.Item
          aria-current={activeTab === "overview" ? "page" : undefined}
          icon={BookIcon}
          onClick={() => setActiveTab("overview")}
          sx={{
            backgroundColor: "transparent",
            color: "white",
          }}
        >
          Overview
        </UnderlineNav.Item>

        <UnderlineNav.Item
          aria-current={activeTab === "starred" ? "page" : undefined}
          icon={RepoIcon}
          onClick={() => setActiveTab("starred")}
          sx={{
            backgroundColor: "transparent",
            color: "whitesmoke",
          }}
        >
          Starred
        </UnderlineNav.Item>

        <UnderlineNav.Item
          aria-current={activeTab === "followers" ? "page" : undefined}
          onClick={() => setActiveTab("followers")}
          sx={{
            backgroundColor: "transparent",
            color: "whitesmoke",
          }}
        >
          Followers
        </UnderlineNav.Item>

        <UnderlineNav.Item
          aria-current={activeTab === "following" ? "page" : undefined}
          onClick={() => setActiveTab("following")}
          sx={{
            backgroundColor: "transparent",
            color: "whitesmoke",
          }}
        >
          Following
        </UnderlineNav.Item>
      </UnderlineNav>

      <div className="profile-page-wrapper">
        {/* Sidebar */}

        <aside className="user-profile-section">
          <div className="profile-image">
            <span>{userDetails.username?.charAt(0)?.toUpperCase() || "U"}</span>
          </div>

          <div className="name">
            <h3>{userDetails.username}</h3>
          </div>

          <div className="profile-stats">
            <button type="button" onClick={() => setActiveTab("followers")}>
              <strong>{followers.length}</strong>

              <span>Followers</span>
            </button>

            <button type="button" onClick={() => setActiveTab("following")}>
              <strong>{following.length}</strong>

              <span>Following</span>
            </button>
          </div>

          <Link to="/settings" className="profile-settings-btn">
            Settings
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="profile-logout-btn"
          >
            Logout
          </button>
        </aside>

        {/* Main */}

        <main className="profile-content-section">
          {activeTab === "overview" && (
            <>
              <section className="profile-repositories-section">
                <div className="profile-section-heading">
                  <div>
                    <h2>Your Repositories</h2>

                    <p>Repositories owned by your account.</p>
                  </div>

                  <Link to="/create" className="profile-create-btn">
                    New repository
                  </Link>
                </div>

                {userRepositories.length > 0 ? (
                  <div className="profile-repo-grid">
                    {userRepositories.map((repo) => (
                      <Link
                        key={repo._id}
                        to={`/repo/${repo._id}`}
                        className="repo repo-link"
                      >
                        <div>
                          <div className="profile-repo-title-row">
                            <h3 className="repo-name">{repo.name}</h3>

                            <span
                              className={`profile-visibility-badge ${
                                repo.visibility ? "public" : "private"
                              }`}
                            >
                              {repo.visibility ? "Public" : "Private"}
                            </span>
                          </div>

                          {repo.description && (
                            <p className="description">{repo.description}</p>
                          )}
                        </div>

                        <p className="repo-owner">{userDetails.username}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="profile-empty-state">
                    <p>You do not have any repositories yet.</p>

                    <Link to="/create">Create your first repository</Link>
                  </div>
                )}
              </section>

              <section className="heat-map-section">
                <div className="profile-section-heading">
                  <div>
                    <h2>Contribution Activity</h2>

                    <p>Your contribution activity.</p>
                  </div>
                </div>

                <HeatMapProfile />
              </section>
            </>
          )}

          {activeTab === "starred" && (
            <section className="profile-list-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Starred Repositories</h2>

                  <p>Repositories you have starred.</p>
                </div>

                <span className="repo-count">{starredRepositories.length}</span>
              </div>

              {starredRepositories.length > 0 ? (
                <div className="profile-repo-grid">
                  {starredRepositories.map((repo) => (
                    <Link
                      key={repo._id}
                      to={`/repo/${repo._id}`}
                      className="repo repo-link"
                    >
                      <div>
                        <div className="profile-repo-title-row">
                          <h3 className="repo-name">{repo.name}</h3>

                          <span
                            className={`profile-visibility-badge ${
                              repo.visibility ? "public" : "private"
                            }`}
                          >
                            {repo.visibility ? "Public" : "Private"}
                          </span>
                        </div>

                        {repo.description && (
                          <p className="description">{repo.description}</p>
                        )}
                      </div>

                      <p className="repo-owner">
                        {repo.owner?.username || "Unknown owner"}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="profile-empty-state">
                  <p>You have not starred any repositories yet.</p>

                  <Link to="/">Browse repositories</Link>
                </div>
              )}
            </section>
          )}

          {activeTab === "followers" && (
            <section className="profile-list-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Followers</h2>

                  <p>People who follow you.</p>
                </div>

                <span className="repo-count">{followers.length}</span>
              </div>

              {renderUserList(followers, "You do not have any followers yet.")}
            </section>
          )}

          {activeTab === "following" && (
            <section className="profile-list-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Following</h2>

                  <p>People you follow.</p>
                </div>

                <span className="repo-count">{following.length}</span>
              </div>

              {renderUserList(following, "You are not following anyone yet.")}
            </section>
          )}
        </main>
      </div>
    </>
  );
};

export default Profile;
