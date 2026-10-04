const vcsService = require("../services/vcsService");
const { loadCliContext } = require("../utils/cliVcsContext");

async function commitRepo(message) {
  const { repositoryId, userId } = await loadCliContext();

  const commit = await vcsService.createCommit(repositoryId, userId, {
    message,
  });

  console.log(`Commit ${commit.commitId} created successfully!`);

  console.log(`Message: ${commit.message}`);
  console.log(`Files: ${commit.fileCount}`);
  console.log(`Parent: ${commit.parent || "none"}`);
}

module.exports = { commitRepo };
