import React from "react";
import { Link } from "react-router-dom";
import "./navbar.css";
import VcsLogo from "../assets/VcsLogo.png";

const Navbar = () => {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={VcsLogo} alt="VCS Logo" />
        <h3>Version Control System</h3>
      </Link>

      <div className="navbar-links">
        <Link to="/create">Create a Repository</Link>

        <Link to="/profile">Profile</Link>
      </div>
    </nav>
  );
};

export default Navbar;
