import React, { useEffect } from "react";
import { useRoutes, useNavigate } from "react-router-dom";

//Pages List
import Dashboard from "./components/dashboard/Dashboard";
import Profile from "./components/user/Profile";
import UserProfile from "./components/user/UserProfile";
import Settings from "./components/user/Settings";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Sigup";
import RepositoryDetails from "./components/repo/RepositoryDetails";
import CreateRepository from "./components/repo/CreateRepository";

import VcsDashboard from "./components/repo/VcsDashboard";
import CommitHistory from "./components/repo/CommitHistory";
import CommitDetails from "./components/repo/CommitDetails";

import IssueList from "./components/issue/IssueList";
import CreateIssue from "./components/issue/CreateIssue";
import IssueDetails from "./components/issue/IssueDetails";

//Auth Context
import { useAuth } from "./authContext";

const ProjectRoutes = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const userIdFromStorage = localStorage.getItem("userId");

    if (userIdFromStorage && !currentUser) {
      setCurrentUser(userIdFromStorage);
    }

    if (
      !userIdFromStorage &&
      !["/auth", "/signup"].includes(window.location.pathname)
    ) {
      navigate("/auth"); //login
    }

    if (userIdFromStorage && window.location.pathname == "/auth") {
      navigate("/");
    }
  }, [currentUser, navigate, setCurrentUser]);

  let element = useRoutes([
    {
      path: "/",
      element: <Dashboard />,
    },
    {
      path: "/auth", //login
      element: <Login />,
    },
    {
      path: "/signup",
      element: <Signup />,
    },
    {
      path: "/profile",
      element: <Profile />,
    },
    {
      path: "/user/:id",
      element: <UserProfile />,
    },
    {
      path: "/settings",
      element: <Settings />,
    },
    {
      path: "/create",
      element: <CreateRepository />,
    },
    {
      path: "/repo/:id",
      element: <RepositoryDetails />,
    },
    {
      path: "/repo/:id/vcs",
      element: <VcsDashboard />,
    },
    {
      path: "/repo/:id/vcs/history",
      element: <CommitHistory />,
    },
    {
      path: "/repo/:id/vcs/commits/:commitId",
      element: <CommitDetails />,
    },
    {
      path: "/repo/:id/issues",
      element: <IssueList />,
    },
    {
      path: "/repo/:id/issues/new",
      element: <CreateIssue />,
    },
    {
      path: "/repo/:id/issues/:issueId",
      element: <IssueDetails />,
    },
  ]);

  return element;
};

export default ProjectRoutes;
