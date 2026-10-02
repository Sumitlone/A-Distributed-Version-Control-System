const express = require("express");
const vcsController = require("../controllers/vcsController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  authorizeRepositoryOwner,
  authorizeRepositoryViewer,
} = require("../middleware/authorizeMiddleware");

const vcsRouter = express.Router();

vcsRouter.use(authMiddleware);

/* Workspace modifications */

vcsRouter.get(
  "/vcs/:repoId/workspace",
  authorizeRepositoryOwner,
  vcsController.getWorkspace,
);
vcsRouter.post(
  "/vcs/:repoId/commit",
  authorizeRepositoryOwner,
  vcsController.createCommit,
);

/* Commit history can be viewed by authenticated users */

vcsRouter.get(
  "/vcs/:repoId/commits",
  authorizeRepositoryViewer,
  vcsController.getCommitHistory,
);
vcsRouter.get(
  "/vcs/:repoId/commits/:commitId",
  authorizeRepositoryViewer,
  vcsController.getCommitDetails,
);

/* Remote/local modifications */

vcsRouter.post(
  "/vcs/:repoId/push",
  authorizeRepositoryOwner,
  vcsController.pushRepository,
);
vcsRouter.post(
  "/vcs/:repoId/pull",
  authorizeRepositoryOwner,
  vcsController.pullRepository,
);
vcsRouter.post(
  "/vcs/:repoId/revert/:commitId",
  authorizeRepositoryOwner,
  vcsController.revertRepository,
);

module.exports = vcsRouter;
