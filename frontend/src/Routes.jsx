import React, { useEffect } from "react";
import { useRoutes, useNavigate } from "react-router-dom";

//Pages List
import Dashboard from "./components/dashboard/Dashboard";
import Profile from "./components/user/Profile";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Sigup";
import RepositoryDetails from "./components/repo/RepositoryDetails";
import CreateRepository from "./components/repo/CreateRepository";

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
      path: "/create",
      element: <CreateRepository />,
    },
    {
      path: "/repo/:id",
      element: <RepositoryDetails />,
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
