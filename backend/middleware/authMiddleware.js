const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  if (!process.env.JWT_SECRET_KEY) {
    console.error("JWT_SECRET_KEY is not configured.");

    return res.status(500).json({
      message: "Authentication service is not configured.",
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      message: "Authentication token is missing.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!decoded?.id) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(decoded.id).select("_id username email");

    if (!user) {
      return res.status(401).json({
        message: "The user associated with this token no longer exists.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication failed:", error.message);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

module.exports = authMiddleware;
