import React, { useEffect } from "react";
import { useRoutes, useNavigate, useLocation } from "react-router-dom";

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

import ProtectedRoute from "./components/common/ProtectedRoute";

const ProjectRoutes = () => {
  const navigate = useNavigate();

  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token && ["/auth", "/signup"].includes(location.pathname)) {
      navigate("/", {
        replace: true,
      });
    }
  }, [location.pathname, navigate]);

  const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return useRoutes([
    {
      path: "/",
      element: protect(<Dashboard />),
    },
    {
      path: "/auth",
      element: <Login />,
    },
    {
      path: "/signup",
      element: <Signup />,
    },
    {
      path: "/profile",
      element: protect(<Profile />),
    },
    {
      path: "/user/:id",
      element: protect(<UserProfile />),
    },
    {
      path: "/settings",
      element: protect(<Settings />),
    },
    {
      path: "/create",
      element: protect(<CreateRepository />),
    },
    {
      path: "/repo/:id",
      element: protect(<RepositoryDetails />),
    },
    {
      path: "/repo/:id/vcs",
      element: protect(<VcsDashboard />),
    },
    {
      path: "/repo/:id/vcs/history",
      element: protect(<CommitHistory />),
    },
    {
      path: "/repo/:id/vcs/commits/:commitId",
      element: protect(<CommitDetails />),
    },
    {
      path: "/repo/:id/issues",
      element: protect(<IssueList />),
    },
    {
      path: "/repo/:id/issues/new",
      element: protect(<CreateIssue />),
    },
    {
      path: "/repo/:id/issues/:issueId",
      element: protect(<IssueDetails />),
    },
  ]);
};

export default ProjectRoutes;
