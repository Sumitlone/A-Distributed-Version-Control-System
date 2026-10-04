const vcsService = require("../services/vcsService");
const { loadCliContext } = require("../utils/cliVcsContext");

async function pullRepo() {
  const { repositoryId, userId } = await loadCliContext();

  const result = await vcsService.pullRepository(repositoryId, userId);

  console.log(result.message);
  console.log(`Downloaded commits: ${result.downloadedCommitCount}`);
  console.log(`Remote HEAD: ${result.remoteHead}`);
  console.log(`Workspace files: ${result.workspaceFileCount}`);
}
module.exports = { pullRepo };
