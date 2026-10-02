import React, { useState, useEffect } from "react";
import api from "../../api/apiClient";
import { useAuth } from "../../authContext";
import Alert from "../common/Alert";

import { Button } from "@primer/react";
import "./auth.css";

import logo from "../../assets/VcsLogo.png";
import { Link } from "react-router-dom";

const Login = () => {
  // useEffect(() => {
  //   localStorage.removeItem("token");
  //   localStorage.removeItem("userId");
  //   setCurrentUser(null);
  // });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const authMessage = sessionStorage.getItem("authMessage");

    if (authMessage) {
      setError(authMessage);

      sessionStorage.removeItem("authMessage");
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const res = await api.post("/login", {
        email,
        password,
      });

      login(res.data.token, res.data.userId);

      window.location.replace("/");
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-logo-container">
        <img className="logo-login" src={logo} alt="Logo" />
      </div>

      <div className="login-box-wrapper">
        <div className="login-heading">
          <h1>Sign In</h1>
        </div>
        <div className="login-box">
          {error && (
            <Alert type="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          <div>
            <label className="label">Email address</label>
            <input
              autoComplete="off"
              name="Email"
              id="Email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="div">
            <label className="label">Password</label>
            <input
              autoComplete="off"
              name="Password"
              id="Password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            className="login-btn"
            disabled={loading}
            onClick={handleLogin}
          >
            {loading ? "Loading..." : "Login"}
          </Button>
        </div>
        <div className="pass-box">
          <p>
            New to GitHub? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
