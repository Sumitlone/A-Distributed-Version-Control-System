const vcsService = require("../services/vcsService");

async function initRepository(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.initRepository(repoId, req.user?._id);

    res.status(201).json({
      message: "VCS repository initialized successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Error during VCS initialization:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function addFiles(req, res) {
  const { repoId } = req.params;
  const { files } = req.body;

  try {
    const result = await vcsService.addFiles(repoId, req.user?._id, files, {
      replace: true,
    });
    
    res.status(201).json({
      message: "Files added to the staging area successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Error during VCS staging:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function getWorkspace(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.getWorkspace(repoId, req.user?._id);
    res.json(result);
  } catch (error) {
    console.error("Error during workspace fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function getVcsStatus(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.getVcsStatus(repoId, req.user?._id);
    res.json(result);
  } catch (error) {
    console.error("Error during VCS status fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function createCommit(req, res) {
  const { repoId } = req.params;
  const { message } = req.body;

  try {
    const commit = await vcsService.createCommit(repoId, req.user?._id, {
      message,
    });

    res.status(201).json({
      message: "Commit created locally. Push it to synchronize with S3.",
      commit,
    });
  } catch (error) {
    console.error("Error during commit creation:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function getCommitHistory(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.getCommitHistory(repoId, req.user?._id);

    res.json(result);
  } catch (error) {
    console.error("Error during commit history fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function getCommitDetails(req, res) {
  const { repoId, commitId } = req.params;

  try {
    const result = await vcsService.getCommitDetails(
      repoId,
      req.user?._id,
      commitId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error during commit details fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function pushRepository(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.pushRepository(repoId, req.user?._id);

    res.json(result);
  } catch (error) {
    console.error("Error during pushing repository:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function pullRepository(req, res) {
  const { repoId } = req.params;

  try {
    const result = await vcsService.pullRepository(repoId, req.user?._id);

    res.json(result);
  } catch (error) {
    console.error("Error during pulling repository:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function revertRepository(req, res) {
  const { repoId, commitId } = req.params;

  try {
    const result = await vcsService.revertRepository(
      repoId,
      req.user?._id,
      commitId,
    );

    res.status(201).json(result);
  } catch (error) {
    console.error("Error during repository revert:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

module.exports = {
  initRepository,
  addFiles,
  getWorkspace,
  getVcsStatus,
  createCommit,
  getCommitHistory,
  getCommitDetails,
  pushRepository,
  pullRepository,
  revertRepository,
};
