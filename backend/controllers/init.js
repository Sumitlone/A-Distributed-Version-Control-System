const vcsService = require("../services/vcsService");
const {
  loadCliContext,
  selectCliRepository,
} = require("../utils/cliVcsContext");

async function initRepo(repoName) {
  try {
    if (!repoName || !String(repoName).trim()) {
      throw new Error(
        "Repository name is required. Usage: node index.js init <repoName>",
      );
    }

    const { userId } = await loadCliContext({
      requireRepository: false,
    });

    const repository = await vcsService.resolveRepositoryByName(
      repoName,
      userId,
    );

    const result = await vcsService.initRepository(repository._id, userId);

    await selectCliRepository({
      repositoryId: repository._id,
      repositoryName: repository.name,
    });

    console.log("Repository selected and initialized successfully!");

    console.log(`User: ${userId}`);

    console.log(`Repository: ${repository.name}`);

    console.log(`Repository ID: ${repository._id}`);

    console.log(`Local VCS path: ${result.localPath}`);

    console.log(`S3 prefix: ${result.remotePrefix}/`);
  } catch (error) {
    console.error("Error initializing repository:", error.message);

    throw error;
  }
}

module.exports = {
  initRepo,
};
