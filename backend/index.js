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

const { loginCli, logoutCli, whoamiCli } = require("./controllers/cliAuth");
const {
  connectCliDatabase,
  disconnectCliDatabase,
} = require("./utils/cliDatabase");

dotenv.config();

async function runCliDatabaseCommand(handler, ...args) {
  await connectCliDatabase();

  try {
    await handler(...args);
  } finally {
    await disconnectCliDatabase();
  }
}

yargs(hideBin(process.argv))
  .command("start", "Starts a new server", {}, startServer)
  .command("login", "Login to the VCS CLI", {}, async () => {
    await runCliDatabaseCommand(loginCli);
  })
  .command("logout", "Logout from the VCS CLI", {}, async () => {
    await logoutCli();
  })
  .command("whoami", "Show the current VCS CLI user", {}, async () => {
    await runCliDatabaseCommand(whoamiCli);
  })
  .command(
    "init <repoName>",
    "Select and initialize a repository using its name",
    (command) => {
      command.positional("repoName", {
        describe: "MongoDB repository name",
        type: "string",
      });
    },
    async (argv) => {
      await runCliDatabaseCommand(initRepo, argv.repoName);
    },
  )
  .command(
    "add <file>",
    "Stage a file or directory in the selected repository",
    (command) => {
      command.positional("file", {
        describe: "File or directory to stage",
        type: "string",
      });
    },
    async (argv) => {
      await runCliDatabaseCommand(addRepo, argv.file);
    },
  )
  .command(
    "commit <message>",
    "Create a commit from staged files",
    (command) => {
      command.positional("message", {
        describe: "Commit message",
        type: "string",
      });
    },
    async (argv) => {
      await runCliDatabaseCommand(commitRepo, argv.message);
    },
  )
  .command("push", "Push selected repository commits to S3", {}, async () => {
    await runCliDatabaseCommand(pushRepo);
  })
  .command("pull", "Pull selected repository commits from S3", {}, async () => {
    await runCliDatabaseCommand(pullRepo);
  })
  .command(
    "revert <commitID>",
    "Create a new revert commit",
    (command) => {
      command.positional("commitID", {
        describe: "Commit ID to revert",
        type: "string",
      });
    },
    async (argv) => {
      await runCliDatabaseCommand(revertRepo, argv.commitID);
    },
  )
  .demandCommand(1, "You need at least one command")
  .help()
  .strict()
  .parseAsync()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });

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
