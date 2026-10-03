const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const mainRouter = require("./routes/main.router");

const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const { initRepo } = require("./controllers/init");
const { addRepo } = require("./controllers/add");
const { commitRepo } = require("./controllers/commit");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

dotenv.config();

yargs(hideBin(process.argv))
  .command("start", "Starts a new server", {}, startServer)
  .command(
    "init", //command name
    "Initialize a new repository", //description
    {}, //arguments
    initRepo, //controller
  )
  .command(
    "add <file>", //command name
    "Add a file to the repository", //description
    (yargs) => {
      yargs.positional("file", {
        describe: "File to add to the staging area",
        type: "string",
      });
    }, //arguments
    (argv) => {
      addRepo(argv.file);
    }, //controller
  )
  .command(
    "commit <message>", //command name
    "Commit the Staged files", //description
    (yargs) => {
      yargs.positional("message", {
        describe: "Commit Message",
        type: "string",
      });
    }, //arguments
    (argv) => {
      commitRepo(argv.message);
    }, //controller
  )
  .command(
    "push", //command name
    "Push commits to S3", //description
    {}, //arguments
    pushRepo, //controller
  )
  .command(
    "pull", //command name
    "Pull commits from S3", //description
    {}, //arguments
    pullRepo, //controller
  )
  .command(
    "revert <commitID>", //command name
    "Revert to a specific commit", //description
    (yargs) => {
      yargs.positional("commitID", {
        describe: "Comit ID to revert to",
        type: "string",
      });
    }, //arguments
    (argv) => {
      revertRepo(argv.commitID);
    }, //controller
  )
  .demandCommand(1, "You need at least one command")
  .help().argv;

function startServer() {
  const app = express();
  const port = process.env.PORT || 3002;

  app.use(bodyParser.json());
  app.use(express.json());

  const mongoURI = process.env.MONGODB_URI;
  mongoose
    .connect(mongoURI)
    .then(() => console.log("MongoDB conection successful"))
    .catch((err) => console.error("Unable to connect:", err));

  const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes("*") ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed."));
      },
      credentials: true,
    }),
  );

  app.use("/", mainRouter);

  let user = "test";
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinRoom", (userID) => {
      user = userID;
      console.log("======");
      console.log(user);
      console.log("======");
      socket.join(userID);
    });
  });

  const db = mongoose.connection;
  db.once("open", async () => {
    console.log("CRUD operations called");
    //CRUD operations
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on PORT ${port}`);
  });
}
