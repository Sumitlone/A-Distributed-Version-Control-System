const mongoose = require("mongoose");
const Repository = require("../models/repoModel");
const Issue = require("../models/issueModel");

function isRepositoryOwner(repository, userId) {
  return repository && userId && String(repository.owner) === String(userId);
}

async function ensureCanViewRepository(req, repository) {
  if (!repository) {
    const error = new Error("Repository not found!");

    error.status = 404;

    throw error;
  }

  if (!repository.visibility && !isRepositoryOwner(repository, req.user?._id)) {
    const error = new Error(
      "This repository is private and can only be viewed by its owner.",
    );

    error.status = 403;

    throw error;
  }
}

async function createIssue(req, res) {
  const { title, description } = req.body;
  const { id } = req.params;

  try {
    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required!",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid repository ID!",
      });
    }

    const repository = await Repository.findById(id);

    if (!repository) {
      return res.status(404).json({
        error: "Repository not found!",
      });
    }

    const issue = new Issue({
      title: title.trim(),
      description: description.trim(),
      repository: id,
    });

    await issue.save();

    repository.issues.push(issue._id);
    await repository.save();

    const populatedIssue = await Issue.findById(issue._id).populate({
      path: "repository",
      select: "name owner visibility",
      populate: {
        path: "owner",
        select: "username",
      },
    });

    res.status(201).json({
      message: "Issue created successfully!",
      issue: populatedIssue,
    });
  } catch (error) {
    console.error("Error during issue creation:", error.message);

    res.status(500).send("Server error");
  }
}

async function upadteIssueById(req, res) {
  const { id } = req.params;
  const { title, description, status } = req.body;

  try {
    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        error: "Issue not found!",
      });
    }

    if (title !== undefined) {
      issue.title = title.trim();
    }

    if (description !== undefined) {
      issue.description = description.trim();
    }

    if (status !== undefined && ["open", "closed"].includes(status)) {
      issue.status = status;
    }

    await issue.save();

    const updatedIssue = await Issue.findById(issue._id).populate({
      path: "repository",
      select: "name owner visibility",
      populate: {
        path: "owner",
        select: "username",
      },
    });

    res.json({
      message: "Issue updated successfully!",
      issue: updatedIssue,
    });
  } catch (error) {
    console.error("Error during issue updation:", error.message);

    res.status(500).send("Server error");
  }
}

async function deleteIssueById(req, res) {
  const { id } = req.params;

  try {
    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        error: "Issue not found!",
      });
    }

    await Repository.findByIdAndUpdate(issue.repository, {
      $pull: {
        issues: issue._id,
      },
    });

    await Issue.findByIdAndDelete(id);

    res.json({
      message: "Issue deleted successfully!",
    });
  } catch (error) {
    console.error("Error during issue deletion:", error.message);

    res.status(500).send("Server error");
  }
}

async function getAllIssues(req, res) {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid repository ID!",
      });
    }

    const repository = await Repository.findById(id);

    if (!repository) {
      return res.status(404).json({
        error: "Repository not found!",
      });
    }

    await ensureCanViewRepository(req, repository);

    const issues = await Issue.find({
      repository: id,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(issues);
  } catch (err) {
    console.error("Error during issue fetching:", err.message);

    res.status(err.status || 500).json({
      message: err.message || "Server error",
    });
  }
}

async function getIssueById(req, res) {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid issue ID!",
      });
    }

    const issue = await Issue.findById(id).populate({
      path: "repository",
      select: "name owner visibility",
      populate: {
        path: "owner",
        select: "username",
      },
    });

    if (!issue) {
      return res.status(404).json({
        error: "Issue not found!",
      });
    }

    await ensureCanViewRepository(req, issue.repository);

    res.json(issue);
  } catch (err) {
    console.error("Error during issue fetching:", err.message);

    res.status(err.status || 500).json({
      message: err.message || "Server error",
    });
  }
}

module.exports = {
  createIssue,
  upadteIssueById,
  deleteIssueById,
  getAllIssues,
  getIssueById,
};
