const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

function createAuthError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function authenticateUser(email, password) {
  const normalizedEmail = String(email || "").trim();

  if (!normalizedEmail || !password) {
    throw createAuthError("Email and password are required.", 400);
  }

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw createAuthError("Invalid credentials!", 400);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw createAuthError("Invalid credentials!", 400);
  }

  return user;
}

function createAuthToken(userId) {
  if (!process.env.JWT_SECRET_KEY) {
    throw createAuthError("JWT_SECRET_KEY is not configured.", 500);
  }

  return jwt.sign(
    {
      id: String(userId),
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: "168h",
    },
  );
}

function verifyAuthToken(token) {
  if (!process.env.JWT_SECRET_KEY) {
    throw createAuthError("JWT_SECRET_KEY is not configured.", 500);
  }

  try {
    return jwt.verify(String(token || ""), process.env.JWT_SECRET_KEY);
  } catch {
    throw createAuthError("Invalid or expired authentication token.", 401);
  }
}

module.exports = {
  authenticateUser,
  createAuthToken,
  verifyAuthToken,
};
