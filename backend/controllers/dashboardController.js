const mongoose = require("mongoose");
const User = require("../models/userModel");
const Repository = require("../models/repoModel");
const Issue = require("../models/issueModel");

async function getDashboardStats(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const [user, repositories] = await Promise.all([
      User.findById(userId).select("followedUsers starRepos"),
      Repository.find({ owner: userId }).select("_id visibility"),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const repositoryIds = repositories.map((repo) => repo._id);

    const [openIssues, starsReceived] = await Promise.all([
      repositoryIds.length
        ? Issue.countDocuments({
            repository: {
              $in: repositoryIds,
            },
            status: "open",
          })
        : 0,

      repositoryIds.length
        ? User.aggregate([
            { $unwind: "$starRepos" },
            {
              $match: {
                starRepos: {
                  $in: repositoryIds,
                },
              },
            },
            { $count: "count" },
          ])
        : [],
    ]);

    const publicRepositories = repositories.filter((repo) =>
      Boolean(repo.visibility),
    ).length;

    const privateRepositories = repositories.length - publicRepositories;

    res.json({
      repositories: repositories.length,
      publicRepositories,
      privateRepositories,
      openIssues,
      starredRepositories: user.starRepos?.length || 0,
      followers: await User.countDocuments({
        followedUsers: userId,
      }),
      following: user.followedUsers?.length || 0,
      starsReceived: starsReceived[0]?.count || 0,
    });
  } catch (error) {
    console.error("Error during dashboard stats fetching:", error.message);

    res.status(500).json({
      message: "Server error.",
    });
  }
}

module.exports = {
  getDashboardStats,
};
