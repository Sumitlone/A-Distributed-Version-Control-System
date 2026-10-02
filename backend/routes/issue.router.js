const express = require("express");
const issueController = require("../controllers/issueController");

const authMiddleware = require("../middleware/authMiddleware");

const {
  authorizeRepositoryOwner,
  authorizeIssueRepositoryOwner,
} = require("../middleware/authorizeMiddleware");

const issueRouter = express.Router();

issueRouter.use(authMiddleware);
issueRouter.post(
  "/issue/create/:id",
  authorizeRepositoryOwner,
  issueController.createIssue,
);
issueRouter.put(
  "/issue/update/:id",
  authorizeIssueRepositoryOwner,
  issueController.upadteIssueById,
);
issueRouter.delete(
  "/issue/delete/:id",
  authorizeIssueRepositoryOwner,
  issueController.deleteIssueById,
);
issueRouter.get("/issue/all/:id", issueController.getAllIssues);
issueRouter.get("/issue/:id", issueController.getIssueById);

module.exports = issueRouter;
