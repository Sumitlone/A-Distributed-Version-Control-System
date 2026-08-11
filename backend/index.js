const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const { initRepo } = require("./controllers/init");
const { addRepo } = require("./controllers/add");
const { commitRepo } = require("./controllers/commit");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

yargs(hideBin(process.argv))
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
    revertRepo, //controller
  )
  .demandCommand(1, "You need at least one command")
  .help().argv;
