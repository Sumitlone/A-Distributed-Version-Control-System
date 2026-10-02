const mongoose = require("mongoose");
const Repository = require("../models/repoModel");
const Issue = require("../models/issueModel");

function authorizeUser(req, res, next) {
  const targetUserId = req.params.userId || req.params.id;

  if (!targetUserId || !req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({
      message: "Invalid user ID.",
    });
  }

  if (String(req.user._id) !== String(targetUserId)) {
    return res.status(403).json({
      message: "You are not authorized to modify this user.",
    });
  }

  next();
}

async function authorizeRepositoryOwner(req, res, next) {
  const repositoryId = req.params.repoId || req.params.id;

  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (!repositoryId || !mongoose.Types.ObjectId.isValid(repositoryId)) {
    return res.status(400).json({
      message: "Invalid repository ID.",
    });
  }

  try {
    const repository = await Repository.findById(repositoryId);

    if (!repository) {
      return res.status(404).json({
        message: "Repository not found.",
      });
    }

    if (String(repository.owner) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Only the repository owner can perform this action.",
      });
    }

    req.repository = repository;

    next();
  } catch (error) {
    console.error("Repository authorization failed:", error.message);

    return res.status(500).json({
      message: "Server error.",
    });
  }
}

async function authorizeIssueRepositoryOwner(req, res, next) {
  const issueId = req.params.id;

  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (!issueId || !mongoose.Types.ObjectId.isValid(issueId)) {
    return res.status(400).json({
      message: "Invalid issue ID.",
    });
  }

  try {
    const issue = await Issue.findById(issueId).populate({
      path: "repository",
      select: "name owner visibility",
    });

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found.",
      });
    }

    if (!issue.repository) {
      return res.status(404).json({
        message: "Repository associated with this issue was not found.",
      });
    }

    if (String(issue.repository.owner) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Only the repository owner can modify this issue.",
      });
    }

    req.issue = issue;
    req.repository = issue.repository;

    next();
  } catch (error) {
    console.error("Issue authorization failed:", error.message);

    return res.status(500).json({
      message: "Server error.",
    });
  }
}

async function authorizeRepositoryViewer(req, res, next) {
  const repositoryId = req.params.repoId || req.params.id;

  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (!repositoryId || !mongoose.Types.ObjectId.isValid(repositoryId)) {
    return res.status(400).json({
      message: "Invalid repository ID.",
    });
  }

  try {
    const repository = await Repository.findById(repositoryId);

    if (!repository) {
      return res.status(404).json({
        message: "Repository not found.",
      });
    }

    const isOwner = String(repository.owner) === String(req.user._id);

    if (!repository.visibility && !isOwner) {
      return res.status(403).json({
        message: "This repository is private.",
      });
    }

    req.repository = repository;

    next();
  } catch (error) {
    console.error("Repository viewer authorization failed:", error.message);

    return res.status(500).json({
      message: "Server error.",
    });
  }
}

module.exports = {
  authorizeUser,
  authorizeRepositoryOwner,
  authorizeIssueRepositoryOwner,
  authorizeRepositoryViewer,
};
