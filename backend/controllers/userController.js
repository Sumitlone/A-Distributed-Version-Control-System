const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const dotenv = require("dotenv");
const Repository = require("../models/repoModel");
const mongoose = require("mongoose");

// const { MongoClient, ReturnDocument } = require("mongodb");
// var ObjectId = require("mongodb").ObjectId;

dotenv.config();

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
    const users = await User.find({});

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
    const user = await User.findById(currentID);

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

    res.json(user);
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

    res.json({
      starredRepositories: user.starRepos || [],
    });
  } catch (error) {
    console.error("Error during fetching starred repositories:", error.message);

    res.status(500).send("Server error!");
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
    const user = await User.findByIdAndDelete(currentID);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User Profile Deleted!",
    });
  } catch (error) {
    console.error("Error during deleting:", error.message);
    res.status(500).send("Server error!");
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
