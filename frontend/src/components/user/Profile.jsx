import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./profile.css";
import Navbar from "../Navbar";
import { UnderlineNav } from "@primer/react";
import { BookIcon, RepoIcon } from "@primer/octicons-react";
import HeatMapProfile from "./HeatMap";
import { useAuth } from "../../authContext";

const Profile = () => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState({ username: "username" });
  const [starredRepositories, setStarredRepositories] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");
  const { setCurrentUser } = useAuth();

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userId = localStorage.getItem("userId");

      if (userId) {
        try {
          const response = await axios.get(
            `http://localhost:3002/userProfile/${userId}`,
          );
          setUserDetails(response.data);
        } catch (err) {
          console.error("Cannot fetch user details: ", err);
        }
      }
    };
    fetchUserDetails();
  }, []);

  useEffect(() => {
    const fetchProfileData = async () => {
      const userId = localStorage.getItem("userId");

      if (!userId) return;

      try {
        const [profileResponse, starredResponse] = await Promise.all([
          axios.get(`http://localhost:3002/userProfile/${userId}`),

          axios.get(`http://localhost:3002/userProfile/${userId}/starred`),
        ]);

        setUserDetails(profileResponse.data);

        setStarredRepositories(starredResponse.data.starredRepositories || []);
      } catch (err) {
        console.error("Cannot fetch profile data: ", err);
      }
    };

    fetchProfileData();
  }, []);

  return (
    <>
      <Navbar />
      <UnderlineNav aria-label="Repository">
        <UnderlineNav.Item
          aria-current={activeTab === "overview" ? "page" : undefined}
          icon={BookIcon}
          onClick={() => setActiveTab("overview")}
          sx={{
            backgroundColor: "transparent",
            color: "white",
            "&:hover": {
              textDecoration: "underline",
              color: "white",
            },
          }}
        >
          Overview
        </UnderlineNav.Item>

        <UnderlineNav.Item
          aria-current={activeTab === "starred" ? "page" : undefined}
          onClick={() => setActiveTab("starred")}
          icon={RepoIcon}
          sx={{
            backgroundColor: "transparent",
            color: "whitesmoke",
            "&:hover": {
              textDecoration: "underline",
              color: "white",
            },
          }}
        >
          Starred Repositories
        </UnderlineNav.Item>
      </UnderlineNav>

      <button
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          setCurrentUser(null);

          window.location.href = "/auth";
        }}
        style={{ position: "fixed", bottom: "50px", right: "50px" }}
        id="logout"
      >
        Logout
      </button>

      <div className="profile-page-wrapper">
        <div className="user-profile-section">
          <div className="profile-image"></div>

          <div className="name">
            <h3>{userDetails.username}</h3>
          </div>

          <button className="follow-btn">Follow</button>

          <div className="follower">
            <p>10 Follower</p>
            <p>3 Following</p>
          </div>
        </div>

        <div className="profile-content-section">
          {activeTab === "overview" ? (
            <div className="heat-map-section">
              <HeatMapProfile />
            </div>
          ) : (
            <section className="starred-repo-section">
              <div className="starred-repo-header">
                <h2>Starred Repositories</h2>

                <span>{starredRepositories.length} repositories</span>
              </div>

              {starredRepositories.length > 0 ? (
                <div className="repo-card-wrapper">
                  {starredRepositories.map((repo) => (
                    <Link
                      to={`/repo/${repo._id}`}
                      className="repo repo-link"
                      key={repo._id}
                    >
                      <div>
                        <h3 className="repo-name">{repo.name}</h3>

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
                <div className="empty-starred-state">
                  <p>You have not starred any repositories yet.</p>

                  <Link to="/">Browse repositories</Link>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default Profile;
