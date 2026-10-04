const vcsService = require("../services/vcsService");
const { loadCliContext } = require("../utils/cliVcsContext");

async function revertRepo(commitID) {
  try {
    if (!commitID) {
      throw new Error(
        "Commit ID is required. Usage: node index.js revert <commitID>",
      );
    }

    const { repositoryId, userId } = await loadCliContext();

    const result = await vcsService.revertRepository(
      repositoryId,
      userId,
      commitID,
    );

    console.log(result.message);
    console.log(`Reverted commit: ${result.revertedCommitId}`);
    console.log(`New commit: ${result.commit.commitId}`);
  } catch (error) {
    console.error("Unable to revert repository:", error.message);

    throw error;
  }
}

module.exports = { revertRepo };
