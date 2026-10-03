const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");

const dashboardRouter = express.Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get("/dashboard/stats", dashboardController.getDashboardStats);

module.exports = dashboardRouter;
