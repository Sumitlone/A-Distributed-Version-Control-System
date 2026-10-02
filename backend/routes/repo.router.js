const express = require("express");
const repoController = require("../controllers/repoController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  authorizeRepositoryOwner,
  authorizeRepositoryViewer,
} = require("../middleware/authorizeMiddleware");

const repoRouter = express.Router();

repoRouter.use(authMiddleware);

repoRouter.post("/repo/create", repoController.createRepository);
repoRouter.get("/repo/all", repoController.getAllRepositories);
repoRouter.get("/repo/name/:name", repoController.fetchRepositoryByName);
repoRouter.get(
  "/repo/user/:userID",
  repoController.fetchRepositoriesForCurrentUser,
);
repoRouter.get(
  "/repo/:id",
  authorizeRepositoryViewer,
  repoController.fetchRepositoryById,
);
repoRouter.put(
  "/repo/update/:id",
  authorizeRepositoryOwner,
  repoController.updateRepositoryById,
);
repoRouter.delete(
  "/repo/delete/:id",
  authorizeRepositoryOwner,
  repoController.deleteRepositoryById,
);

repoRouter.patch(
  "/repo/toggle/:id",
  authorizeRepositoryOwner,
  repoController.toggleVisibilityById,
);

module.exports = repoRouter;
