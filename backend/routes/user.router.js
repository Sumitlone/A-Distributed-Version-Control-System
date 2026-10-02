const express = require("express");
const userController = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");
const { authorizeUser } = require("../middleware/authorizeMiddleware");

const userRouter = express.Router();

/* Public authentication routes */
userRouter.post("/signup", userController.signup);
userRouter.post("/login", userController.login);

/* Everything below requires JWT */
userRouter.use(authMiddleware);
userRouter.get("/allUsers", userController.getAllUsers);
userRouter.get("/userProfile/:id", userController.getUserProfile);
userRouter.put(
  "/updateProfile/:id",
  authorizeUser,
  userController.updateUserProfile,
);
userRouter.delete(
  "/deleteProfile/:id",
  authorizeUser,
  userController.deleteUserProfile,
);
userRouter.get(
  "/userProfile/:id/starred",
  userController.getStarredRepositories,
);

userRouter.patch(
  "/userProfile/:userId/star/:repoId",
  authorizeUser,
  userController.toggleStarRepository,
);

userRouter.patch(
  "/userProfile/:userId/follow/:targetUserId",
  authorizeUser,
  userController.toggleFollowUser,
);

userRouter.get("/userProfile/:id/followers", userController.getFollowers);

userRouter.get("/userProfile/:id/following", userController.getFollowing);

module.exports = userRouter;
