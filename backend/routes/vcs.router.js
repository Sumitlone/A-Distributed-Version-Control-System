const express = require("express");
const vcsController = require("../controllers/vcsController");

const vcsRouter = express.Router();

vcsRouter.get("/vcs/:repoId/workspace", vcsController.getWorkspace);
vcsRouter.post("/vcs/:repoId/commit", vcsController.createCommit);
vcsRouter.get("/vcs/:repoId/commits", vcsController.getCommitHistory);
vcsRouter.get("/vcs/:repoId/commits/:commitId", vcsController.getCommitDetails);
vcsRouter.post("/vcs/:repoId/push", vcsController.pushRepository);
vcsRouter.post("/vcs/:repoId/pull", vcsController.pullRepository);
vcsRouter.post("/vcs/:repoId/revert/:commitId", vcsController.revertRepository);

module.exports = vcsRouter;
