const express = require("express");
const vcsController = require("../controllers/vcsController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  authorizeRepositoryOwner,
  authorizeRepositoryViewer,
} = require("../middleware/authorizeMiddleware");

const vcsRouter = express.Router();

vcsRouter.use(authMiddleware);

/* Repository initialization */

vcsRouter.post(
  "/vcs/:repoId/init",
  authorizeRepositoryOwner,
  vcsController.initRepository,
);

/* Staging */

vcsRouter.post(
  "/vcs/:repoId/add",
  authorizeRepositoryOwner,
  vcsController.addFiles,
);

/* VCS status */

vcsRouter.get(
  "/vcs/:repoId/status",
  authorizeRepositoryOwner,
  vcsController.getVcsStatus,
);

/* Workspace */

vcsRouter.get(
  "/vcs/:repoId/workspace",
  authorizeRepositoryOwner,
  vcsController.getWorkspace,
);

/* Commits */

vcsRouter.post(
  "/vcs/:repoId/commits",
  authorizeRepositoryOwner,
  vcsController.createCommit,
);

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

/* Remote synchronization */

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

/* Revert creates a new commit */

vcsRouter.post(
  "/vcs/:repoId/revert/:commitId",
  authorizeRepositoryOwner,
  vcsController.revertRepository,
);

module.exports = vcsRouter;
