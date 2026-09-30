import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./profile.css";
import Navbar from "../Navbar";
import { UnderlineNav } from "@primer/react";
import {
  BookIcon,
  RepoIcon,
} from "@primer/octicons-react";
import HeatMapProfile from "./HeatMap";
import { useAuth } from "../../authContext";

const API_URL = "http://localhost:3002";

const Profile = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const [userDetails, setUserDetails] =
    useState({ username: "username" });

  const [userRepositories, setUserRepositories] =
    useState([]);

  const [starredRepositories, setStarredRepositories] =
    useState([]);

  const [activeTab, setActiveTab] =
    useState("overview");

  const [loadingRepositories, setLoadingRepositories] =
    useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      const userId =
        localStorage.getItem("userId");

      if (!userId) {
        navigate("/auth");
        return;
      }

      try {
        const [
          profileResponse,
          starredResponse,
          repositoriesResponse,
        ] = await Promise.all([
          axios.get(
            `${API_URL}/userProfile/${userId}`,
          ),

          axios.get(
            `${API_URL}/userProfile/${userId}/starred`,
          ),

          axios
            .get(
              `${API_URL}/repo/user/${userId}`,
            )
            .catch((err) => {
              if (
                err.response?.status === 404
              ) {
                return {
                  data: {
                    repositories: [],
                  },
                };
              }

              throw err;
            }),
        ]);

        setUserDetails(
          profileResponse.data,
        );

        setStarredRepositories(
          starredResponse.data
            .starredRepositories || [],
        );

        setUserRepositories(
          repositoriesResponse.data
            .repositories || [],
        );
      } catch (err) {
        console.error(
          "Cannot fetch profile data:",
          err,
        );
      } finally {
        setLoadingRepositories(
          false,
        );
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

  return (
    <>
      <Navbar />

      <UnderlineNav
        aria-label="Profile navigation"
        className="profile-tabs"
      >
        <UnderlineNav.Item
          aria-current={
            activeTab === "overview"
              ? "page"
              : undefined
          }
          icon={BookIcon}
          onClick={() =>
            setActiveTab("overview")
          }
          sx={{
            backgroundColor:
              "transparent",
            color: "white",
            "&:hover": {
              textDecoration:
                "underline",
              color: "white",
            },
          }}
        >
          Overview
        </UnderlineNav.Item>

        <UnderlineNav.Item
          aria-current={
            activeTab === "starred"
              ? "page"
              : undefined
          }
          onClick={() =>
            setActiveTab("starred")
          }
          icon={RepoIcon}
          sx={{
            backgroundColor:
              "transparent",
            color: "whitesmoke",
            "&:hover": {
              textDecoration:
                "underline",
              color: "white",
            },
          }}
        >
          Starred Repositories
        </UnderlineNav.Item>
      </UnderlineNav>

      <div className="profile-page-wrapper">

        {/* Profile sidebar */}

        <aside className="user-profile-section">

          <div className="profile-image">
            <span>
              {userDetails.username
                ?.charAt(0)
                ?.toUpperCase() ||
                "U"}
            </span>
          </div>

          <div className="name">
            <h3>
              {userDetails.username}
            </h3>
          </div>

          <button
            className="follow-btn"
            type="button"
            disabled
          >
            Follow
          </button>

          <div className="follower">
            <span>
              10 Followers
            </span>

            <span>
              3 Following
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            id="logout"
            className="profile-logout-btn"
          >
            Logout
          </button>
        </aside>

        {/* Main content */}

        <main className="profile-content-section">

          {activeTab === "overview" ? (
            <>
              {/* User repositories */}

              <section className="profile-repositories-section">

                <div className="profile-section-heading">
                  <div>
                    <h2>
                      Your Repositories
                    </h2>

                    <p>
                      Repositories owned by
                      your account.
                    </p>
                  </div>

                  <Link
                    to="/create"
                    className="profile-create-btn"
                  >
                    New repository
                  </Link>
                </div>

                {loadingRepositories ? (
                  <p className="profile-message">
                    Loading repositories...
                  </p>
                ) : userRepositories.length >
                  0 ? (
                  <div className="repo-card-wrapper profile-repo-grid">

                    {userRepositories.map(
                      (repo) => (
                        <Link
                          to={`/repo/${repo._id}`}
                          className="repo repo-link"
                          key={repo._id}
                        >
                          <div>
                            <div className="profile-repo-title-row">

                              <h3 className="repo-name">
                                {repo.name}
                              </h3>

                              <span
                                className={`profile-visibility-badge ${
                                  repo.visibility
                                    ? "public"
                                    : "private"
                                }`}
                              >
                                {repo.visibility
                                  ? "Public"
                                  : "Private"}
                              </span>
                            </div>

                            {repo.description && (
                              <p className="description">
                                {repo.description}
                              </p>
                            )}
                          </div>

                          <p className="repo-owner">
                            {userDetails.username ||
                              "You"}
                          </p>
                        </Link>
                      ),
                    )}

                  </div>
                ) : (
                  <div className="empty-repo-state">
                    <p>
                      You do not have any
                      repositories yet.
                    </p>

                    <Link to="/create">
                      Create your first
                      repository
                    </Link>
                  </div>
                )}
              </section>

              {/* Heatmap */}

              <section className="heat-map-section">

                <div className="profile-section-heading heatmap-heading">
                  <div>
                    <h2>
                      Contribution Activity
                    </h2>

                    <p>
                      Your current
                      contribution activity.
                    </p>
                  </div>
                </div>

                <HeatMapProfile />

              </section>
            </>
          ) : (

            /* Starred repositories */

            <section className="starred-repo-section">

              <div className="profile-section-heading">

                <div>
                  <h2>
                    Starred Repositories
                  </h2>

                  <p>
                    Repositories you have starred.
                  </p>
                </div>

                <span className="repo-count">
                  {starredRepositories.length}{" "}
                  repositories
                </span>

              </div>

              {starredRepositories.length >
              0 ? (
                <div className="repo-card-wrapper profile-repo-grid">

                  {starredRepositories.map(
                    (repo) => (
                      <Link
                        to={`/repo/${repo._id}`}
                        className="repo repo-link"
                        key={repo._id}
                      >
                        <div>

                          <div className="profile-repo-title-row">

                            <h3 className="repo-name">
                              {repo.name}
                            </h3>

                            <span
                              className={`profile-visibility-badge ${
                                repo.visibility
                                  ? "public"
                                  : "private"
                              }`}
                            >
                              {repo.visibility
                                ? "Public"
                                : "Private"}
                            </span>

                          </div>

                          {repo.description && (
                            <p className="description">
                              {repo.description}
                            </p>
                          )}

                        </div>

                        <p className="repo-owner">
                          {repo.owner?.username ||
                            "Unknown owner"}
                        </p>
                      </Link>
                    ),
                  )}

                </div>
              ) : (
                <div className="empty-starred-state">
                  <p>
                    You have not starred any
                    repositories yet.
                  </p>

                  <Link to="/">
                    Browse repositories
                  </Link>
                </div>
              )}
            </section>
          )}

        </main>
      </div>
    </>
  );
};

export default Profile;