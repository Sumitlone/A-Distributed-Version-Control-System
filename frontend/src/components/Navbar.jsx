import React from "react";
import { Link } from "react-router-dom";
import "./navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img
          src="https://www.github.com/images/modules/logos_page/GitHub-Mark.png"
          alt="GitHub Logo"
        />
        <h3>GitHub</h3>
      </Link>

      <div className="navbar-links">
        <Link to="/create">Create a Repository</Link>

        <Link to="/profile">Profile</Link>
      </div>
    </nav>
  );
};

export default Navbar;