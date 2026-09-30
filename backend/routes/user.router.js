const express = require("express");
const userController = require("../controllers/userController");

const userRouter = express.Router();

userRouter.get("/allUsers", userController.getAllUsers);
userRouter.post("/signup", userController.signup);
userRouter.post("/login", userController.login);
userRouter.get("/userProfile/:id", userController.getUserProfile);
userRouter.put("/updateProfile/:id", userController.updateUserProfile);
userRouter.delete("/deleteProfile/:id", userController.deleteUserProfile);
userRouter.get(
  "/userProfile/:id/starred",
  userController.getStarredRepositories,
);

userRouter.patch(
  "/userProfile/:userId/star/:repoId",
  userController.toggleStarRepository,
);

module.exports = userRouter;
