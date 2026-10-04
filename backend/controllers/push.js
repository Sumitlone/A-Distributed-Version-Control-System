const vcsService = require("../services/vcsService");
const { loadCliContext } = require("../utils/cliVcsContext");

async function pushRepo() {
  const { repositoryId, userId } = await loadCliContext();

  const result = await vcsService.pushRepository(repositoryId, userId);

  console.log(result.message);
  console.log(`Pushed commits: ${result.pushedCommitCount}`);
  console.log(`Uploaded files: ${result.uploadedFiles}`);
  console.log(`Remote HEAD: ${result.remoteHead}`);
}

module.exports = { pushRepo };
