const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const dotenv = require("dotenv");
const Repository = require("../models/repoModel");
const Issue = require("../models/issueModel");
const mongoose = require("mongoose");

const fs = require("fs").promises;
const path = require("path");

const { s3, S3_BUCKET } = require("../config/aws-config");
// const { MongoClient, ReturnDocument } = require("mongodb");
// var ObjectId = require("mongodb").ObjectId;

dotenv.config();

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

// const uri = process.env.MONGODB_URI;

// let client;

// async function connectClient() {
//   if (!client) {
//     client = new MongoClient(uri);
//     await client.connect();
//   }
// }
// Signup
async function signup(req, res) {
  const { username, password, email } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user) {
      return res.status(400).json({
        message: "User already exists!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      email,
      repositories: [],
      followedUsers: [],
      starRepos: [],
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "168h",
    });

    res.json({
      token,
      userId: newUser._id,
    });
  } catch (error) {
    console.error("Error during signup:", error.message);
    res.status(500).send("Server error");
  }
}

// Login
async function login(req, res) {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials!",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials!",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "168h",
    });

    res.json({
      token,
      userId: user._id,
    });
  } catch (error) {
    console.error("Error during login:", error.message);
    res.status(500).send("Server error!");
  }
}

// Get all users
async function getAllUsers(req, res) {
  try {
    const users = await User.find({}).select("-password");

    res.json(users);
  } catch (error) {
    console.error("Error during fetching:", error.message);
    res.status(500).send("Server error!");
  }
}

// Get user profile
async function getUserProfile(req, res) {
  const currentID = req.params.id;

  try {
    const user = await User.findById(currentID).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Error during fetching:", error.message);
    res.status(500).send("Server error!");
  }
}

// Update user profile
async function updateUserProfile(req, res) {
  const currentID = req.params.id;
  const { email, password } = req.body;

  try {
    const updateFields = {};

    if (email) {
      updateFields.email = email;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      updateFields.password = hashedPassword;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        message: "No profile changes were provided.",
      });
    }

    const user = await User.findByIdAndUpdate(
      currentID,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json(safeUser);
  } catch (error) {
    console.error("Error during updating:", error.message);
    res.status(500).send("Server error!");
  }
}

// Get starred repositories for a user
async function getStarredRepositories(req, res) {
  const { id } = req.params;

  try {
    const user = await User.findById(id).populate({
      path: "starRepos",
      populate: {
        path: "owner",
        select: "username",
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    const isOwnProfile = String(id) === String(req.user._id);

    const visibleRepositories = (user.starRepos || []).filter((repository) => {
      if (!repository) {
        return false;
      }

      if (isOwnProfile) {
        return true;
      }

      return Boolean(repository.visibility);
    });

    res.json({
      starredRepositories: visibleRepositories,
    });
  } catch (error) {
    console.error("Error during fetching starred repositories:", error.message);

    res.status(500).json({
      message: "Server error!",
    });
  }
}

// Star / unstar a repository
async function toggleStarRepository(req, res) {
  const { userId, repoId } = req.params;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(repoId)
    ) {
      return res.status(400).json({
        message: "Invalid user or repository ID!",
      });
    }

    const [user, repository] = await Promise.all([
      User.findById(userId),
      Repository.findById(repoId),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    if (!repository) {
      return res.status(404).json({
        message: "Repository not found!",
      });
    }

    const isOwner = String(repository.owner) === String(user._id);

    if (!repository.visibility && !isOwner) {
      return res.status(403).json({
        message: "Private repositories cannot be starred.",
      });
    }

    const alreadyStarred = user.starRepos.some(
      (repo) => repo.toString() === repoId,
    );

    if (alreadyStarred) {
      user.starRepos.pull(repoId);
    } else {
      user.starRepos.addToSet(repoId);
    }

    await user.save();

    res.json({
      message: alreadyStarred
        ? "Repository unstarred successfully!"
        : "Repository starred successfully!",

      starred: !alreadyStarred,
    });
  } catch (error) {
    console.error("Error during starring repository:", error.message);

    res.status(500).send("Server error!");
  }
}

// Delete user profile
async function deleteUserProfile(req, res) {
  const currentID = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(currentID)) {
      return res.status(400).json({
        message: "Invalid user ID!",
      });
    }

    /*
      Find the user first.
      Do NOT delete the user yet because
      we need their repository IDs.
    */
    const user = await User.findById(currentID);

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    /*
      Find every repository owned
      by this user.
    */
    const repositories = await Repository.find({
      owner: currentID,
    }).select("_id");

    const repositoryIds = repositories.map((repository) => repository._id);

    /*
      Remove remote and local VCS data
      for every owned repository.
    */
    for (const repositoryId of repositoryIds) {
      const repoId = String(repositoryId);

      /*
        Current web VCS structure:
        repositories/<repoId>/...
      */
      await deleteS3Prefix(`repositories/${repoId}/`);

      /*
        Older web VCS structure:
        commits/<repoId>/...
      */
      await deleteS3Prefix(`commits/${repoId}/`);

      /*
        Remove local server-side
        VCS workspace.
      */
      const localRepoPath = path.resolve(process.cwd(), ".vcsRepos", repoId);

      await fs.rm(localRepoPath, {
        recursive: true,
        force: true,
      });
    }

    /*
      Delete issues belonging to
      all repositories owned by user.
    */
    if (repositoryIds.length > 0) {
      await Issue.deleteMany({
        repository: {
          $in: repositoryIds,
        },
      });
    }

    /*
      Remove deleted repositories from
      users' repository/star references.
    */
    if (repositoryIds.length > 0) {
      await User.updateMany(
        {},
        {
          $pull: {
            repositories: {
              $in: repositoryIds,
            },

            starRepos: {
              $in: repositoryIds,
            },
          },
        },
      );
    }

    /*
      Delete the repository documents.
    */
    if (repositoryIds.length > 0) {
      await Repository.deleteMany({
        _id: {
          $in: repositoryIds,
        },
      });
    }

    /*
      Remove this user from everybody's
      following lists.
    */
    await User.updateMany(
      {
        _id: {
          $ne: currentID,
        },
      },
      {
        $pull: {
          followedUsers: currentID,
        },
      },
    );

    /*
      Finally delete the user.
    */
    await User.findByIdAndDelete(currentID);

    res.json({
      message:
        "Account, repositories, issues, and VCS data deleted successfully!",
    });
  } catch (error) {
    console.error("Error during account deletion:", error.message);

    /*
      If S3/local/database cleanup fails,
      do not claim the account was deleted.
    */
    res.status(500).json({
      message: "Account deletion failed. Your account was not deleted.",
      error: error.message,
    });
  }
}

// Follow / unfollow another user
async function toggleFollowUser(req, res) {
  const { userId, targetUserId } = req.params;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(targetUserId)
    ) {
      return res.status(400).json({
        message: "Invalid user ID!",
      });
    }

    if (String(userId) === String(targetUserId)) {
      return res.status(400).json({
        message: "You cannot follow yourself!",
      });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!currentUser) {
      return res.status(404).json({
        message: "Current user not found!",
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        message: "Target user not found!",
      });
    }

    const alreadyFollowing = currentUser.followedUsers.some(
      (user) => String(user) === String(targetUserId),
    );

    if (alreadyFollowing) {
      currentUser.followedUsers.pull(targetUserId);
    } else {
      currentUser.followedUsers.addToSet(targetUserId);
    }

    await currentUser.save();

    res.json({
      message: alreadyFollowing
        ? "User unfollowed successfully!"
        : "User followed successfully!",

      following: !alreadyFollowing,
    });
  } catch (error) {
    console.error("Error during follow/unfollow:", error.message);

    res.status(500).send("Server error!");
  }
}

// Get followers of a user
async function getFollowers(req, res) {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID!",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    const followers = await User.find({
      followedUsers: id,
    }).select("_id username");

    res.json({
      followers,
    });
  } catch (error) {
    console.error("Error during fetching followers:", error.message);

    res.status(500).send("Server error!");
  }
}

// Get users followed by a user
async function getFollowing(req, res) {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID!",
      });
    }

    const user = await User.findById(id).populate(
      "followedUsers",
      "_id username",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    res.json({
      following: user.followedUsers || [],
    });
  } catch (error) {
    console.error("Error during fetching following users:", error.message);

    res.status(500).send("Server error!");
  }
}

module.exports = {
  getAllUsers,
  signup,
  login,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
  getStarredRepositories,
  toggleStarRepository,
  toggleFollowUser,
  getFollowers,
  getFollowing,
};
