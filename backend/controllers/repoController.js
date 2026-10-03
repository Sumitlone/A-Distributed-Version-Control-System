const mongoose = require("mongoose");
const fs = require("fs").promises;
const path = require("path");

const Repository = require("../models/repoModel");
const User = require("../models/userModel");
const Issue = require("../models/issueModel");

const { s3, S3_BUCKET } = require("../config/aws-config");

async function createRepository(req, res) {
  const { name, description, visibility } = req.body;
  const owner = req.user?._id;

  try {
    if (!name) {
      return res.status(400).json({ error: "Repository name is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ error: "Invalid User ID!" });
    }

    const newRepository = new Repository({
      name: String(name).trim(),

      description: description ? String(description).trim() : "",

      visibility: Boolean(visibility),

      owner,

      content: [],

      issues: [],
    });

    const result = await newRepository.save();

    res.status(201).json({
      message: "Repository created!",
      repositoryID: result._id,
    });
  } catch (error) {
    console.error("Error during repository creation : ", error.message);
    res.status(500).send("Server error");
  }
}

async function getAllRepositories(req, res) {
  try {
    const repositories = await Repository.find({
      $or: [
        {
          visibility: true,
        },
        {
          owner: req.user._id,
        },
      ],
    })
      .populate("owner", "username")
      .select("name description visibility owner createdAt")
      .sort({ createdAt: -1 })
      .limit(25);

    res.json(repositories);
  } catch (error) {
    console.error("Error during fetching repositories : ", error.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoryById(req, res) {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid Repository ID!",
      });
    }

    const repository = await Repository.findById(id)
      .populate("owner", "username")
      .populate("issues");

    if (!repository) {
      return res.status(404).json({
        error: "Repository not found!",
      });
    }

    if (
      !repository.visibility &&
      String(repository.owner._id || repository.owner) !== String(req.user._id)
    ) {
      return res.status(403).json({
        error:
          "This repository is private and can only be viewed by its owner.",
      });
    }

    res.json({
      repository,
    });
  } catch (error) {
    console.error("Error during fetching repository : ", error.message);
    res.status(500).send("Server error");
  }
}

async function searchRepositories(req, res) {
  const q = String(req.query.q || "").trim();

  try {
    if (!q) {
      return res.json([]);
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const repositories = await Repository.find({
      $and: [
        {
          $or: [{ name: regex }, { description: regex }],
        },
        {
          $or: [{ visibility: true }, { owner: req.user._id }],
        },
      ],
    })
      .populate("owner", "username")
      .select("name description visibility owner createdAt")
      .limit(25);

    res.json(repositories);
  } catch (error) {
    console.error("Error during repository search:", error.message);

    res.status(500).json({
      message: "Server error.",
    });
  }
}

async function fetchRepositoryByName(req, res) {
  const { name } = req.params;
  try {
    const repository = await Repository.find({
      name,
      $or: [
        {
          visibility: true,
        },
        {
          owner: req.user._id,
        },
      ],
    })
      .populate("owner", "username")
      .populate("issues");

    res.json(repository);
  } catch (error) {
    console.error("Error during fetching repository : ", error.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoriesForCurrentUser(req, res) {
  const { userID } = req.params;

  try {
    const repositories = await Repository.find({
      owner: userID,

      $or: [
        {
          visibility: true,
        },
        {
          owner: req.user._id,
        },
      ],
    });

    if (!repositories || repositories.length == 0) {
      return res.status(404).json({ error: "User Repositories not found!" });
    }

    res.json({ message: "Repositories found!", repositories });
  } catch (err) {
    console.error("Error during fetching user repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

async function updateRepositoryById(req, res) {
  const { id } = req.params;
  const { content, description } = req.body;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    if (description !== undefined) {
      repository.description = description;
    }

    if (
      content !== undefined &&
      content !== null &&
      String(content).trim() !== ""
    ) {
      repository.content.push(content);
    }

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository updated successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during updating repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function toggleVisibilityById(req, res) {
  const { id } = req.params;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    repository.visibility = !repository.visibility;

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository visibility toggled successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during toggling visibility : ", err.message);
    res.status(500).send("Server error");
  }
}

async function deleteS3Prefix(prefix) {
  let continuationToken;

  do {
    const response = await s3
      .listObjectsV2({
        Bucket: S3_BUCKET,
        Prefix: prefix,

        ...(continuationToken
          ? {
              ContinuationToken: continuationToken,
            }
          : {}),
      })
      .promise();

    const objects = response.Contents || [];

    if (objects.length > 0) {
      await s3
        .deleteObjects({
          Bucket: S3_BUCKET,
          Delete: {
            Objects: objects.map((object) => ({
              Key: object.Key,
            })),
          },
        })
        .promise();
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
}

async function deleteRepositoryById(req, res) {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid Repository ID!",
      });
    }

    const repository = await Repository.findById(id);

    if (!repository) {
      return res.status(404).json({
        error: "Repository not found!",
      });
    }

    /*
      Delete the current web VCS storage:
      repositories/<repoId>/commits/...
    */
    await deleteS3Prefix(`repositories/${id}/`);

    /*
      Also remove the old web-VCS layout
      if this repository was pushed before
      the S3 structure was changed.
    */
    await deleteS3Prefix(`commits/${id}/`);

    /*
      Remove local VCS workspace/cache.
      This is local server data, not the
      authoritative remote repository.
    */
    const localRepoPath = path.resolve(process.cwd(), ".vcsRepos", String(id));

    await fs.rm(localRepoPath, {
      recursive: true,
      force: true,
    });

    /*
      Delete issues belonging to the repository.
    */
    await Issue.deleteMany({
      repository: id,
    });

    /*
      Remove repository references from users:
      - repositories
      - starred repositories
    */
    await User.updateMany(
      {},
      {
        $pull: {
          repositories: id,
          starRepos: id,
        },
      },
    );

    /*
      Finally delete the repository document.
    */
    await Repository.findByIdAndDelete(id);

    res.json({
      message: "Repository and its remote/local VCS data deleted successfully!",
    });
  } catch (err) {
    console.error("Error during deleting repository:", err.message);

    res.status(500).json({
      message:
        "Repository deletion failed. The repository was not removed from MongoDB.",
      error: err.message,
    });
  }
}

module.exports = {
  createRepository,
  getAllRepositories,
  searchRepositories,
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchRepositoriesForCurrentUser,
  updateRepositoryById,
  toggleVisibilityById,
  deleteRepositoryById,
};
