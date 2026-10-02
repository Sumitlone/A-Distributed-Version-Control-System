import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import "./userProfile.css";

const API_URL = "http://localhost:3002";

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem("userId");
  const [userDetails, setUserDetails] = useState(null);
  const [currentUserDetails, setCurrentUserDetails] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        setError("");

        if (currentUserId && String(currentUserId) === String(id)) {
          navigate("/profile");
          return;
        }

        const [
          userResponse,
          repositoriesResponse,
          followersResponse,
          followingResponse,
          currentUserResponse,
        ] = await Promise.all([
          axios.get(`${API_URL}/userProfile/${id}`),

          axios.get(`${API_URL}/repo/user/${id}`).catch((err) => {
            if (err.response?.status === 404) {
              return {
                data: {
                  repositories: [],
                },
              };
            }

            throw err;
          }),

          axios.get(`${API_URL}/userProfile/${id}/followers`),

          axios.get(`${API_URL}/userProfile/${id}/following`),

          currentUserId
            ? axios.get(`${API_URL}/userProfile/${currentUserId}`)
            : Promise.resolve({
                data: null,
              }),
        ]);

        const targetUser = userResponse.data;

        setUserDetails(targetUser);
        setRepositories(repositoriesResponse.data.repositories || []);
        setFollowers(followersResponse.data.followers || []);
        setFollowing(followingResponse.data.following || []);
        setCurrentUserDetails(currentUserResponse.data);

        const currentFollowing = currentUserResponse.data?.followedUsers || [];

        setIsFollowing(
          currentFollowing.some(
            (followedUser) => String(followedUser) === String(id),
          ),
        );
      } catch (err) {
        console.error("Cannot fetch user profile:", err);

        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load user profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, currentUserId, navigate]);

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      navigate("/auth");
      return;
    }

    try {
      setFollowLoading(true);
      setError("");

      const response = await axios.patch(
        `${API_URL}/userProfile/${currentUserId}/follow/${id}`,
      );

      const followingState = Boolean(response.data.following);

      setIsFollowing(followingState);

      if (followingState) {
        setFollowers((current) => {
          if (
            current.some((user) => String(user._id) === String(currentUserId))
          ) {
            return current;
          }

          return [
            ...current,
            {
              _id: currentUserId,
              username: currentUserDetails?.username || "You",
            },
          ];
        });
      } else {
        setFollowers((current) =>
          current.filter((user) => String(user._id) !== String(currentUserId)),
        );
      }
    } catch (err) {
      console.error("Cannot update follow state:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to update follow status.",
      );
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="user-profile-loading">Loading profile...</main>
      </>
    );
  }

  if (error || !userDetails) {
    return (
      <>
        <Navbar />

        <main className="user-profile-loading">
          <p>{error || "User not found."}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="user-profile-page">
        <div className="user-profile-header">
          <div className="user-profile-avatar-large">
            {userDetails.username?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="user-profile-header-info">
            <h1>{userDetails.username}</h1>

            <p>User profile</p>

            {currentUserId && (
              <button
                type="button"
                className={`user-follow-button ${
                  isFollowing ? "following" : ""
                }`}
                onClick={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading
                  ? "Updating..."
                  : isFollowing
                    ? "Unfollow"
                    : "Follow"}
              </button>
            )}
          </div>
        </div>

        {error && <p className="user-profile-error">{error}</p>}

        <div className="user-profile-stats">
          <div>
            <strong>{repositories.length}</strong>
            <span>Repositories</span>
          </div>

          <div>
            <strong>{followers.length}</strong>
            <span>Followers</span>
          </div>

          <div>
            <strong>{following.length}</strong>
            <span>Following</span>
          </div>
        </div>

        <section className="user-profile-section-block">
          <div className="user-profile-section-heading">
            <div>
              <h2>Repositories</h2>

              <p>Public repositories owned by {userDetails.username}.</p>
            </div>
          </div>

          {repositories.length > 0 ? (
            <div className="user-profile-repo-grid">
              {repositories.map((repo) => (
                <Link
                  key={repo._id}
                  to={`/repo/${repo._id}`}
                  className="user-profile-repo-card"
                >
                  <div className="user-profile-repo-title">
                    <h3>{repo.name}</h3>

                    <span className={repo.visibility ? "public" : "private"}>
                      {repo.visibility ? "Public" : "Private"}
                    </span>
                  </div>

                  {repo.description && <p>{repo.description}</p>}
                </Link>
              ))}
            </div>
          ) : (
            <div className="user-profile-empty">
              <p>No repositories found.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default UserProfile;
