import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import "./repositoryTabs.css";

const RepositoryTabs = () => {
  const { id } = useParams();
  const location = useLocation();

  const tabs = [
    {
      label: "Code",
      to: `/repo/${id}`,
      active: location.pathname === `/repo/${id}`,
    },
    {
      label: "Issues",
      to: `/repo/${id}/issues`,
      active: location.pathname.startsWith(`/repo/${id}/issues`),
    },
    {
      label: "VCS",
      to: `/repo/${id}/vcs`,
      active: location.pathname.startsWith(`/repo/${id}/vcs`),
    },
    {
      label: "Settings",
      to: `/repo/${id}/settings`,
      active: location.pathname.startsWith(`/repo/${id}/settings`),
    },
  ];

  return (
    <nav className="repository-tabs" aria-label="Repository navigation">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          to={tab.to}
          className={tab.active ? "repository-tab active" : "repository-tab"}
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};

export default RepositoryTabs;
