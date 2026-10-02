const express = require("express");
const userRouter = require("./user.router");
const repoRouter = require("./repo.router");
const issueRouter = require("./issue.router");
const vcsRouter = require("./vcs.router");

const mainRouter = express.Router();

mainRouter.use(userRouter);
mainRouter.use(repoRouter);
mainRouter.use(issueRouter);
mainRouter.use(vcsRouter);

// mainRouter.get("/", (req, res) => {
//   res.send("Welcome");
// });

module.exports = mainRouter;
