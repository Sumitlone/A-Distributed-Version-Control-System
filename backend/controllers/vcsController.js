const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const Repository = require("../models/repoModel");
const { s3, S3_BUCKET } = require("../config/aws-config");

const VCS_ROOT = path.resolve(process.cwd(), ".vcsRepos");

const REMOTE_PREFIX = "repositories";

function getRepoRoot(repoId) {
  return path.join(VCS_ROOT, String(repoId));
}

function getWorkspacePath(repoId) {
  return path.join(getRepoRoot(repoId), "workspace");
}

function getCommitsPath(repoId) {
  return path.join(getRepoRoot(repoId), "commits");
}

function normalizeRelativePath(fileName) {
  if (typeof fileName !== "string") {
    return null;
  }

  const normalized = fileName
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");

  if (
    !normalized ||
    normalized === "commit.json" ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..")
  ) {
    return null;
  }

  return normalized;
}

function isValidCommitId(commitId) {
  return /^[a-f0-9-]{36}$/i.test(String(commitId));
}

async function ensureRepoDirs(repoId) {
  await fs.mkdir(getWorkspacePath(repoId), {
    recursive: true,
  });

  await fs.mkdir(getCommitsPath(repoId), {
    recursive: true,
  });
}

async function readFilesRecursively(directory, baseDirectory = directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await readFilesRecursively(fullPath, baseDirectory)));

      continue;
    }

    const relativePath = path
      .relative(baseDirectory, fullPath)
      .split(path.sep)
      .join("/");

    files.push({
      name: relativePath,
      content: await fs.readFile(fullPath, "utf8"),
    });
  }

  return files;
}

async function writeFiles(directory, files) {
  await fs.mkdir(directory, {
    recursive: true,
  });

  for (const file of files) {
    const safeName = normalizeRelativePath(file.name);

    if (!safeName) {
      throw new Error(`Invalid file name: ${file.name}`);
    }

    const filePath = path.join(directory, ...safeName.split("/"));

    const relativeCheck = path.relative(directory, filePath);

    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      throw new Error(`Invalid file path: ${file.name}`);
    }

    await fs.mkdir(path.dirname(filePath), {
      recursive: true,
    });

    await fs.writeFile(filePath, String(file.content ?? ""), "utf8");
  }
}

async function getRepository(repoId) {
  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return null;
  }

  return Repository.findById(repoId).select("name owner visibility");
}

async function ensureRepositoryExists(repoId) {
  const repository = await getRepository(repoId);

  if (!repository) {
    const error = new Error("Repository not found!");

    error.status = 404;

    throw error;
  }

  await ensureRepoDirs(repoId);

  return repository;
}

async function ensureOwner(req, repository) {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    const error = new Error("User ID is required for this operation.");

    error.status = 401;

    throw error;
  }

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    String(repository.owner) !== String(userId)
  ) {
    const error = new Error(
      "Only the repository owner can perform this operation.",
    );

    error.status = 403;

    throw error;
  }
}

async function getWorkspace(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    const files = await readFilesRecursively(getWorkspacePath(repoId));

    res.json({
      repository: {
        _id: repository._id,
        name: repository.name,
      },
      files,
    });
  } catch (error) {
    console.error("Error during workspace fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function createCommit(req, res) {
  const { repoId } = req.params;

  const { message, files } = req.body;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        message: "Commit message is required!",
      });
    }

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        message: "At least one file is required to create a commit!",
      });
    }

    const preparedFiles = files.map((file) => {
      const name = normalizeRelativePath(file?.name);

      if (!name) {
        throw new Error(`Invalid file name: ${file?.name}`);
      }

      return {
        name,
        content: String(file?.content ?? ""),
      };
    });

    const uniqueNames = new Set(preparedFiles.map((file) => file.name));

    if (uniqueNames.size !== preparedFiles.length) {
      return res.status(400).json({
        message: "Duplicate file names are not allowed.",
      });
    }

    const workspacePath = getWorkspacePath(repoId);

    const commitsPath = getCommitsPath(repoId);

    const commitId = uuidv4();

    const commitPath = path.join(commitsPath, commitId);

    await fs.rm(workspacePath, {
      recursive: true,
      force: true,
    });

    await fs.mkdir(workspacePath, {
      recursive: true,
    });

    await writeFiles(workspacePath, preparedFiles);

    await fs.mkdir(commitPath, {
      recursive: true,
    });

    await writeFiles(commitPath, preparedFiles);

    const metadata = {
      message: String(message).trim(),

      date: new Date().toISOString(),

      repository: String(repoId),

      files: preparedFiles.map((file) => file.name),
    };

    await fs.writeFile(
      path.join(commitPath, "commit.json"),
      JSON.stringify(metadata, null, 2),
      "utf8",
    );

    const contentNames = preparedFiles.map((file) => file.name);

    await Repository.findByIdAndUpdate(repoId, {
      $addToSet: {
        content: {
          $each: contentNames,
        },
      },
    });

    res.status(201).json({
      message: "Commit created successfully!",

      commit: {
        commitId,
        ...metadata,
        fileCount: preparedFiles.length,
      },

      files: preparedFiles,
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
    await ensureRepositoryExists(repoId);

    const commitsPath = getCommitsPath(repoId);

    const entries = await fs.readdir(commitsPath, {
      withFileTypes: true,
    });

    const commits = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const commitId = entry.name;

      if (!isValidCommitId(commitId)) {
        continue;
      }

      const metadataPath = path.join(commitsPath, commitId, "commit.json");

      try {
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

        const commitFiles = await readFilesRecursively(
          path.join(commitsPath, commitId),
        );

        const files = commitFiles.filter((file) => file.name !== "commit.json");

        commits.push({
          commitId,
          message: metadata.message || "",
          date: metadata.date || null,
          files: files.map((file) => file.name),
          fileCount: files.length,
        });
      } catch (commitError) {
        console.error(
          `Unable to read commit ${commitId}:`,
          commitError.message,
        );
      }
    }

    commits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.json({
      commits,
    });
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
    await ensureRepositoryExists(repoId);

    if (!isValidCommitId(commitId)) {
      return res.status(400).json({
        message: "Invalid commit ID!",
      });
    }

    const commitPath = path.join(getCommitsPath(repoId), commitId);

    const metadataPath = path.join(commitPath, "commit.json");

    try {
      await fs.access(metadataPath);
    } catch {
      return res.status(404).json({
        message: "Commit not found!",
      });
    }

    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

    const files = (await readFilesRecursively(commitPath)).filter(
      (file) => file.name !== "commit.json",
    );

    res.json({
      commit: {
        commitId,
        message: metadata.message || "",
        date: metadata.date || null,
        files,
      },
    });
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
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    const commitsPath = getCommitsPath(repoId);

    const entries = await fs.readdir(commitsPath, {
      withFileTypes: true,
    });

    const commitIds = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => isValidCommitId(entry.name))
      .map((entry) => entry.name);

    let uploadedFiles = 0;

    for (const commitId of commitIds) {
      const commitDirectory = path.join(commitsPath, commitId);

      const files = await readFilesRecursively(commitDirectory);

      for (const file of files) {
        const params = {
          Bucket: S3_BUCKET,

          Key: `${REMOTE_PREFIX}/${repoId}/commits/${commitId}/${file.name}`,

          Body: Buffer.from(file.content, "utf8"),
        };

        const uploadResult = await s3.upload(params).promise();

        uploadedFiles += 1;

        console.log("Uploaded to S3:", uploadResult.Key);
      }
    }

    res.json({
      message:
        commitIds.length > 0
          ? "All local commits pushed to S3 successfully!"
          : "There are no local commits to push.",

      commitCount: commitIds.length,

      uploadedFiles,

      bucket: S3_BUCKET,

      prefix: `${REMOTE_PREFIX}/${repoId}/commits/`,
      structure: `${REMOTE_PREFIX}/${repoId}/commits/<commitId>/<file>`,
      uploadedPath: `${REMOTE_PREFIX}/${repoId}/commits/<commitId>/<file>`,

      note: "Web VCS commits are stored under repositories/<repositoryId>/commits/<commitId>/",
    });
  } catch (error) {
    console.error("Error during pushing repository:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

async function listRemoteObjects(repoId) {
  const objects = [];

  let continuationToken;

  do {
    const response = await s3
      .listObjectsV2({
        Bucket: S3_BUCKET,

        Prefix: `${REMOTE_PREFIX}/${repoId}/commits/`,

        ...(continuationToken
          ? {
              ContinuationToken: continuationToken,
            }
          : {}),
      })
      .promise();

    objects.push(...(response.Contents || []));

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

async function pullRepository(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    const objects = await listRemoteObjects(repoId);

    if (objects.length === 0) {
      return res.status(404).json({
        message: "No remote commits found in S3 for this repository.",
      });
    }

    const commitsPath = getCommitsPath(repoId);

    const remoteCommitIds = new Set();

    for (const object of objects) {
      const keyParts = object.Key.split("/");

      const repositoryIndex = keyParts.indexOf(REMOTE_PREFIX);

      const commitsIndex = keyParts.indexOf("commits");

      const commitId =
        repositoryIndex >= 0 && commitsIndex === repositoryIndex + 2
          ? keyParts[repositoryIndex + 3]
          : null;

      const relativeFile =
        repositoryIndex >= 0 && commitsIndex === repositoryIndex + 2
          ? keyParts.slice(repositoryIndex + 4).join("/")
          : null;

      if (!commitId || !relativeFile || !isValidCommitId(commitId)) {
        continue;
      }

      remoteCommitIds.add(commitId);

      const localCommitDirectory = path.join(commitsPath, commitId);

      await fs.mkdir(localCommitDirectory, {
        recursive: true,
      });

      const s3Object = await s3
        .getObject({
          Bucket: S3_BUCKET,
          Key: object.Key,
        })
        .promise();

      let localPath;

      if (relativeFile === "commit.json") {
        /*
            commit.json is internal VCS metadata,
            so do not pass it through the normal
            user-file validation.
        */
        localPath = path.join(localCommitDirectory, "commit.json");
      } else {
        const safeFile = normalizeRelativePath(relativeFile);

        if (!safeFile) {
          continue;
        }

        localPath = path.join(localCommitDirectory, ...safeFile.split("/"));
      }

      await fs.mkdir(path.dirname(localPath), {
        recursive: true,
      });

      await fs.writeFile(localPath, s3Object.Body);

      await fs.mkdir(path.dirname(localPath), {
        recursive: true,
      });

      await fs.writeFile(localPath, s3Object.Body);
    }

    const historyEntries = await fs.readdir(commitsPath, {
      withFileTypes: true,
    });

    const commits = [];

    for (const entry of historyEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (!remoteCommitIds.has(entry.name)) {
        continue;
      }

      const metadataPath = path.join(commitsPath, entry.name, "commit.json");

      try {
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

        commits.push({
          commitId: entry.name,

          date: metadata.date || null,
        });
      } catch {
        // Ignore malformed metadata.
      }
    }

    commits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (commits.length > 0) {
      const latestCommitId = commits[0].commitId;

      const latestCommitPath = path.join(commitsPath, latestCommitId);

      const latestFiles = (await readFilesRecursively(latestCommitPath)).filter(
        (file) => file.name !== "commit.json",
      );

      const workspacePath = getWorkspacePath(repoId);

      await fs.rm(workspacePath, {
        recursive: true,
        force: true,
      });

      await fs.mkdir(workspacePath, {
        recursive: true,
      });

      await writeFiles(workspacePath, latestFiles);
    }

    res.json({
      message: "All remote commits pulled from S3 successfully!",

      commitCount: remoteCommitIds.size,

      latestCommitId: commits.length > 0 ? commits[0].commitId : null,

      bucket: S3_BUCKET,

      prefix: `${REMOTE_PREFIX}/${repoId}/commits/`,
    });
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
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    if (!isValidCommitId(commitId)) {
      return res.status(400).json({
        message: "Invalid commit ID!",
      });
    }

    const commitPath = path.join(getCommitsPath(repoId), commitId);

    try {
      await fs.access(path.join(commitPath, "commit.json"));
    } catch {
      return res.status(404).json({
        message: "Commit not found!",
      });
    }

    const commitFiles = (await readFilesRecursively(commitPath)).filter(
      (file) => file.name !== "commit.json",
    );

    const workspacePath = getWorkspacePath(repoId);

    await fs.rm(workspacePath, {
      recursive: true,
      force: true,
    });

    await fs.mkdir(workspacePath, {
      recursive: true,
    });

    await writeFiles(workspacePath, commitFiles);

    res.json({
      message: `Repository workspace reverted to commit ${commitId}.`,

      commitId,

      files: commitFiles,
    });
  } catch (error) {
    console.error("Error during repository revert:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

module.exports = {
  getWorkspace,
  createCommit,
  getCommitHistory,
  getCommitDetails,
  pushRepository,
  pullRepository,
  revertRepository,
};
