const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const Repository = require("../models/repoModel");
const { s3, S3_BUCKET } = require("../config/aws-config");

const VCS_ROOT = path.resolve(process.cwd(), ".vcsRepos");

const REMOTE_PREFIX = "repositories";
const VCS_SCHEMA_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

function getRepoRoot(repoId) {
  return path.join(VCS_ROOT, String(repoId));
}

function getWorkspacePath(repoId) {
  return path.join(getRepoRoot(repoId), "workspace");
}

function getCommitsPath(repoId) {
  return path.join(getRepoRoot(repoId), "commits");
}

function getLocalHeadPath(repoId) {
  return path.join(getRepoRoot(repoId), "HEAD");
}

/* -------------------------------------------------------------------------- */
/* S3 keys                                                                    */
/* -------------------------------------------------------------------------- */

function getRemotePrefix(repoId) {
  return `${REMOTE_PREFIX}/${repoId}`;
}

function getRemoteCommitsPrefix(repoId) {
  return `${getRemotePrefix(repoId)}/commits/`;
}

function getRemoteHeadKey(repoId) {
  return `${getRemotePrefix(repoId)}/HEAD`;
}

function getRemoteMetadataKey(repoId) {
  return `${getRemotePrefix(repoId)}/metadata.json`;
}

function getRemoteCommitPrefix(repoId, commitId) {
  return `${getRemoteCommitsPrefix(repoId)}${commitId}/`;
}

function getRemoteCommitKey(repoId, commitId, fileName) {
  return `${getRemoteCommitPrefix(repoId, commitId)}${fileName}`;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

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

function createHttpError(message, status) {
  const error = new Error(message);

  error.status = status;

  return error;
}

/* -------------------------------------------------------------------------- */
/* Local filesystem                                                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Repository authorization                                                   */
/* -------------------------------------------------------------------------- */

async function getRepository(repoId) {
  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return null;
  }

  return Repository.findById(repoId).select("name owner visibility");
}

async function ensureRepositoryExists(repoId) {
  const repository = await getRepository(repoId);

  if (!repository) {
    throw createHttpError("Repository not found!", 404);
  }

  await ensureRepoDirs(repoId);

  return repository;
}

async function ensureOwner(req, repository) {
  const userId = req.user?._id;

  if (!userId) {
    throw createHttpError("Authentication required for this operation.", 401);
  }

  if (
    !mongoose.Types.ObjectId.isValid(String(userId)) ||
    String(repository.owner) !== String(userId)
  ) {
    throw createHttpError(
      "Only the repository owner can perform this operation.",
      403,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Local HEAD                                                                 */
/* -------------------------------------------------------------------------- */

async function getLocalHead(repoId) {
  try {
    const value = await fs.readFile(getLocalHeadPath(repoId), "utf8");

    const head = value.trim();

    return head && isValidCommitId(head) ? head : null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeLocalHead(repoId, commitId) {
  await fs.mkdir(getRepoRoot(repoId), {
    recursive: true,
  });

  if (!commitId) {
    await fs.rm(getLocalHeadPath(repoId), {
      force: true,
    });

    return;
  }

  await fs.writeFile(getLocalHeadPath(repoId), `${commitId}\n`, "utf8");
}

async function getLocalCommitIds(repoId) {
  const commitsPath = getCommitsPath(repoId);

  await fs.mkdir(commitsPath, {
    recursive: true,
  });

  const entries = await fs.readdir(commitsPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory() && isValidCommitId(entry.name))
    .map((entry) => entry.name);
}

async function readLocalCommitMetadata(repoId, commitId) {
  const metadataPath = path.join(
    getCommitsPath(repoId),
    commitId,
    "commit.json",
  );

  return JSON.parse(await fs.readFile(metadataPath, "utf8"));
}

/* -------------------------------------------------------------------------- */
/* S3 helpers                                                                 */
/* -------------------------------------------------------------------------- */

async function getS3Text(key) {
  try {
    const response = await s3
      .getObject({
        Bucket: S3_BUCKET,
        Key: key,
      })
      .promise();

    return response.Body.toString("utf8");
  } catch (error) {
    if (
      error.code === "NoSuchKey" ||
      error.code === "NotFound" ||
      error.statusCode === 404
    ) {
      return null;
    }

    throw error;
  }
}

async function putS3Text(key, value, contentType = "text/plain") {
  await s3
    .putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: Buffer.from(value, "utf8"),
      ContentType: contentType,
    })
    .promise();
}

async function listRemoteObjects(repoId) {
  const objects = [];

  let continuationToken;

  do {
    const response = await s3
      .listObjectsV2({
        Bucket: S3_BUCKET,

        Prefix: getRemoteCommitsPrefix(repoId),

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

/* -------------------------------------------------------------------------- */
/* Remote commit parsing                                                      */
/* -------------------------------------------------------------------------- */

function parseRemoteCommitId(key, repoId) {
  const prefix = getRemoteCommitsPrefix(repoId);

  if (!key.startsWith(prefix)) {
    return null;
  }

  const remainder = key.slice(prefix.length);

  const commitId = remainder.split("/")[0];

  return isValidCommitId(commitId) ? commitId : null;
}

function parseRemoteCommitFile(key, repoId) {
  const prefix = getRemoteCommitsPrefix(repoId);

  if (!key.startsWith(prefix)) {
    return null;
  }

  const remainder = key.slice(prefix.length);

  const [commitId, ...fileParts] = remainder.split("/");

  if (!isValidCommitId(commitId)) {
    return null;
  }

  const relativeFile = fileParts.join("/");

  if (!relativeFile) {
    return null;
  }

  return {
    commitId,
    relativeFile,
  };
}

/* -------------------------------------------------------------------------- */
/* Remote state                                                               */
/* -------------------------------------------------------------------------- */

async function inferRemoteHead(repoId, remoteCommitIds) {
  const commitDetails = [];

  for (const commitId of remoteCommitIds) {
    const metadataText = await getS3Text(
      getRemoteCommitKey(repoId, commitId, "commit.json"),
    );

    if (!metadataText) {
      continue;
    }

    try {
      const metadata = JSON.parse(metadataText);

      commitDetails.push({
        commitId,
        date: metadata.date || null,
      });
    } catch {
      // Ignore malformed legacy metadata.
    }
  }

  commitDetails.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return commitDetails[0]?.commitId || null;
}

async function getRemoteState(repoId) {
  const objects = await listRemoteObjects(repoId);

  const remoteCommitIds = [
    ...new Set(
      objects
        .map((object) => parseRemoteCommitId(object.Key, repoId))
        .filter(Boolean),
    ),
  ];

  let head = null;

  let metadata = null;

  const headText = await getS3Text(getRemoteHeadKey(repoId));

  if (headText && isValidCommitId(headText.trim())) {
    head = headText.trim();
  }

  const metadataText = await getS3Text(getRemoteMetadataKey(repoId));

  if (metadataText) {
    try {
      metadata = JSON.parse(metadataText);
    } catch {
      metadata = null;
    }
  }

  if (
    !head &&
    metadata?.latestCommitId &&
    remoteCommitIds.includes(metadata.latestCommitId)
  ) {
    head = metadata.latestCommitId;
  }

  /*
    Migration support:
    if commits already exist but HEAD doesn't,
    infer the latest commit.
  */
  if (!head && remoteCommitIds.length > 0) {
    head = await inferRemoteHead(repoId, remoteCommitIds);
  }

  return {
    head,
    commitIds: remoteCommitIds,
    metadata,
    objects,
  };
}

async function ensureRemoteMetadata(repoId, remoteState) {
  if (!remoteState.head) {
    return remoteState;
  }

  await putS3Text(
    getRemoteHeadKey(repoId),
    `${remoteState.head}\n`,
    "text/plain",
  );

  const metadata = {
    schemaVersion: VCS_SCHEMA_VERSION,

    repositoryId: String(repoId),

    latestCommitId: remoteState.head,

    commitCount: remoteState.commitIds.length,

    updatedAt: new Date().toISOString(),
  };

  await putS3Text(
    getRemoteMetadataKey(repoId),
    JSON.stringify(metadata, null, 2),
    "application/json",
  );

  return {
    ...remoteState,
    metadata,
  };
}

/* -------------------------------------------------------------------------- */
/* Remote → local synchronization                                             */
/* -------------------------------------------------------------------------- */

async function downloadRemoteCommit(repoId, commitId, objects) {
  const matchingObjects = objects.filter((object) => {
    const parsed = parseRemoteCommitFile(object.Key, repoId);

    return parsed?.commitId === commitId;
  });

  if (matchingObjects.length === 0) {
    throw createHttpError(`Remote commit ${commitId} was not found.`, 404);
  }

  const localCommitDirectory = path.join(getCommitsPath(repoId), commitId);

  await fs.mkdir(localCommitDirectory, {
    recursive: true,
  });

  for (const object of matchingObjects) {
    const parsed = parseRemoteCommitFile(object.Key, repoId);

    if (!parsed) {
      continue;
    }

    const { relativeFile } = parsed;

    let localPath;

    if (relativeFile === "commit.json") {
      localPath = path.join(localCommitDirectory, "commit.json");
    } else {
      const safeFile = normalizeRelativePath(relativeFile);

      if (!safeFile) {
        continue;
      }

      localPath = path.join(localCommitDirectory, ...safeFile.split("/"));
    }

    const s3Object = await s3
      .getObject({
        Bucket: S3_BUCKET,
        Key: object.Key,
      })
      .promise();

    await fs.mkdir(path.dirname(localPath), {
      recursive: true,
    });

    await fs.writeFile(localPath, s3Object.Body);
  }
}

async function syncMissingRemoteCommits(repoId, remoteState) {
  const localCommitIds = new Set(await getLocalCommitIds(repoId));

  const missing = remoteState.commitIds.filter(
    (commitId) => !localCommitIds.has(commitId),
  );

  for (const commitId of missing) {
    await downloadRemoteCommit(repoId, commitId, remoteState.objects);
  }

  return missing;
}

async function restoreWorkspaceFromCommit(repoId, commitId) {
  if (!commitId) {
    return [];
  }

  const commitPath = path.join(getCommitsPath(repoId), commitId);

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

  return commitFiles;
}

async function prepareLocalState(repoId, remoteState) {
  const localHead = await getLocalHead(repoId);

  /*
    Fresh server / empty local VCS:
    rebuild it from S3.
  */
  if (!localHead && remoteState.head) {
    await syncMissingRemoteCommits(repoId, remoteState);

    await writeLocalHead(repoId, remoteState.head);

    await restoreWorkspaceFromCommit(repoId, remoteState.head);

    return remoteState.head;
  }

  /*
    Local state exists. Make sure any missing
    remote commits are cached locally.
  */
  if (
    localHead &&
    remoteState.head &&
    remoteState.commitIds.includes(localHead)
  ) {
    await syncMissingRemoteCommits(repoId, remoteState);
  }

  return localHead;
}

/* -------------------------------------------------------------------------- */
/* Commit creation                                                            */
/* -------------------------------------------------------------------------- */

async function createLocalCommit(
  repoId,
  repository,
  { message, files, parent, reverts = null },
) {
  const preparedFiles = files.map((file) => {
    const name = normalizeRelativePath(file?.name);

    if (!name) {
      throw createHttpError(`Invalid file name: ${file?.name}`, 400);
    }

    return {
      name,
      content: String(file?.content ?? ""),
    };
  });

  const uniqueNames = new Set(preparedFiles.map((file) => file.name));

  if (uniqueNames.size !== preparedFiles.length) {
    throw createHttpError("Duplicate file names are not allowed.", 400);
  }

  const commitId = uuidv4();

  const commitsPath = getCommitsPath(repoId);

  const workspacePath = getWorkspacePath(repoId);

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
    schemaVersion: VCS_SCHEMA_VERSION,

    commitId,

    repository: String(repoId),

    parent: parent || null,

    reverts: reverts || null,

    message: String(message).trim(),

    date: new Date().toISOString(),

    files: preparedFiles.map((file) => file.name),
  };

  await fs.writeFile(
    path.join(commitPath, "commit.json"),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );

  await writeLocalHead(repoId, commitId);

  await Repository.findByIdAndUpdate(repoId, {
    $addToSet: {
      content: {
        $each: preparedFiles.map((file) => file.name),
      },
    },
  });

  return {
    ...metadata,
    fileCount: preparedFiles.length,
    repositoryName: repository.name,
    pushed: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                  */
/* -------------------------------------------------------------------------- */

async function getWorkspace(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    const remoteState = await getRemoteState(repoId);

    const localHead = await prepareLocalState(repoId, remoteState);

    const files = await readFilesRecursively(getWorkspacePath(repoId));

    const localCommitIds = await getLocalCommitIds(repoId);

    res.json({
      repository: {
        _id: repository._id,
        name: repository.name,
      },

      files,

      head: {
        local: localHead,
        remote: remoteState.head,
      },

      status: {
        ahead: localCommitIds.filter(
          (commitId) => !remoteState.commitIds.includes(commitId),
        ).length,

        behind: remoteState.commitIds.filter(
          (commitId) => !localCommitIds.includes(commitId),
        ).length,
      },
    });
  } catch (error) {
    console.error("Error during workspace fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* VCS status                                                                 */
/* -------------------------------------------------------------------------- */

async function getVcsStatus(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    let remoteState = await getRemoteState(repoId);

    /*
      Automatically create HEAD and
      metadata for older repositories
      that already have commits.
    */
    if (remoteState.head) {
      remoteState = await ensureRemoteMetadata(repoId, remoteState);
    }

    const localHead = await getLocalHead(repoId);

    const localCommitIds = await getLocalCommitIds(repoId);

    const aheadCommitIds = localCommitIds.filter(
      (commitId) => !remoteState.commitIds.includes(commitId),
    );

    const behindCommitIds = remoteState.commitIds.filter(
      (commitId) => !localCommitIds.includes(commitId),
    );

    const synchronized =
      Boolean(
        localHead &&
        remoteState.head &&
        localHead === remoteState.head &&
        aheadCommitIds.length === 0 &&
        behindCommitIds.length === 0,
      ) ||
      (!localHead && !remoteState.head);

    res.json({
      repositoryId: String(repoId),

      localHead,

      remoteHead: remoteState.head,

      ahead: aheadCommitIds.length,

      behind: behindCommitIds.length,

      aheadCommitIds,

      behindCommitIds,

      synchronized,

      remoteCommitCount: remoteState.commitIds.length,

      metadata: remoteState.metadata || null,
    });
  } catch (error) {
    console.error("Error during VCS status fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Commit                                                                     */
/* -------------------------------------------------------------------------- */

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

    const remoteState = await getRemoteState(repoId);

    const localHead = await getLocalHead(repoId);

    /*
      If this is a fresh server, restore
      the remote repository first.
    */
    if (!localHead && remoteState.head) {
      await prepareLocalState(repoId, remoteState);
    }

    const preparedLocalHead = (await getLocalHead(repoId)) || null;

    /*
      Don't allow a commit on an older
      remote state.
    */
    if (
      preparedLocalHead &&
      remoteState.head &&
      preparedLocalHead !== remoteState.head &&
      remoteState.commitIds.includes(preparedLocalHead)
    ) {
      return res.status(409).json({
        message:
          "Your local workspace is behind the remote repository. Pull the latest changes before creating a new commit.",
      });
    }

    const parent = preparedLocalHead || remoteState.head || null;

    const commit = await createLocalCommit(repoId, repository, {
      message,
      files,
      parent,
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

/* -------------------------------------------------------------------------- */
/* Commit history                                                             */
/* -------------------------------------------------------------------------- */

async function getCommitHistory(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    const remoteState = await getRemoteState(repoId);

    await syncMissingRemoteCommits(repoId, remoteState);

    const localCommitIds = await getLocalCommitIds(repoId);

    const commits = [];

    for (const commitId of localCommitIds) {
      try {
        const metadata = await readLocalCommitMetadata(repoId, commitId);

        const commitFiles = await readFilesRecursively(
          path.join(getCommitsPath(repoId), commitId),
        );

        const files = commitFiles.filter((file) => file.name !== "commit.json");

        commits.push({
          commitId,

          message: metadata.message || "",

          date: metadata.date || null,

          parent: metadata.parent || null,

          reverts: metadata.reverts || null,

          files: files.map((file) => file.name),

          fileCount: files.length,

          pushed: remoteState.commitIds.includes(commitId),
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
      repository: {
        _id: repository._id,
        name: repository.name,
      },

      commits,

      remoteHead: remoteState.head,
    });
  } catch (error) {
    console.error("Error during commit history fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Commit details                                                             */
/* -------------------------------------------------------------------------- */

async function getCommitDetails(req, res) {
  const { repoId, commitId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    if (!isValidCommitId(commitId)) {
      return res.status(400).json({
        message: "Invalid commit ID!",
      });
    }

    const localCommitIds = await getLocalCommitIds(repoId);

    const remoteState = await getRemoteState(repoId);

    if (
      !localCommitIds.includes(commitId) &&
      remoteState.commitIds.includes(commitId)
    ) {
      await downloadRemoteCommit(repoId, commitId, remoteState.objects);
    }

    const finalLocalIds = await getLocalCommitIds(repoId);

    if (!finalLocalIds.includes(commitId)) {
      return res.status(404).json({
        message: "Commit not found!",
      });
    }

    const metadata = await readLocalCommitMetadata(repoId, commitId);

    const files = (
      await readFilesRecursively(path.join(getCommitsPath(repoId), commitId))
    ).filter((file) => file.name !== "commit.json");

    res.json({
      repository: {
        _id: repository._id,
        name: repository.name,
      },

      commit: {
        commitId,

        message: metadata.message || "",

        date: metadata.date || null,

        parent: metadata.parent || null,

        reverts: metadata.reverts || null,

        files,

        pushed: remoteState.commitIds.includes(commitId),
      },
    });
  } catch (error) {
    console.error("Error during commit details fetching:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Push                                                                       */
/* -------------------------------------------------------------------------- */

async function uploadLocalCommit(repoId, commitId) {
  const commitDirectory = path.join(getCommitsPath(repoId), commitId);

  const files = await readFilesRecursively(commitDirectory);

  let uploadedFiles = 0;

  for (const file of files) {
    const params = {
      Bucket: S3_BUCKET,

      Key: getRemoteCommitKey(repoId, commitId, file.name),

      Body: Buffer.from(file.content, "utf8"),
    };

    await s3.upload(params).promise();

    uploadedFiles += 1;
  }

  return uploadedFiles;
}

async function isLocalHeadBasedOnRemoteHead(repoId, localHead, remoteHead) {
  if (!localHead || !remoteHead) {
    return true;
  }

  if (localHead === remoteHead) {
    return true;
  }

  const visited = new Set();

  let current = localHead;

  while (current && !visited.has(current)) {
    visited.add(current);

    if (current === remoteHead) {
      return true;
    }

    try {
      const metadata = await readLocalCommitMetadata(repoId, current);

      current = metadata.parent || null;
    } catch {
      return false;
    }
  }

  return false;
}

async function pushRepository(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    const localCommitIds = await getLocalCommitIds(repoId);

    const localHead = await getLocalHead(repoId);

    if (!localHead || localCommitIds.length === 0) {
      return res.status(400).json({
        message: "There are no local commits to push.",
      });
    }

    let remoteState = await getRemoteState(repoId);

    /*
      Cache existing remote commits
      before checking ancestry.
    */
    if (remoteState.head) {
      await syncMissingRemoteCommits(repoId, remoteState);
    }

    remoteState = await getRemoteState(repoId);

    const remoteHasLocalHead = remoteState.commitIds.includes(localHead);

    if (remoteState.head && !remoteHasLocalHead) {
      const basedOnRemote = await isLocalHeadBasedOnRemoteHead(
        repoId,
        localHead,
        remoteState.head,
      );

      if (!basedOnRemote) {
        return res.status(409).json({
          message:
            "Push rejected because the local history has diverged from the remote repository. Pull or reconcile the histories before pushing.",

          remoteHead: remoteState.head,

          localHead,
        });
      }
    }

    const commitsToPush = localCommitIds.filter(
      (commitId) => !remoteState.commitIds.includes(commitId),
    );

    /*
      Topological order:
      parents before children.
    */
    const orderedCommits = [];

    const remaining = new Set(commitsToPush);

    while (remaining.size > 0) {
      let progress = false;

      for (const commitId of [...remaining]) {
        const metadata = await readLocalCommitMetadata(repoId, commitId);

        if (!metadata.parent || !remaining.has(metadata.parent)) {
          orderedCommits.push(commitId);

          remaining.delete(commitId);

          progress = true;
        }
      }

      if (!progress) {
        throw createHttpError(
          "Local commit history contains a cycle or missing parent.",
          409,
        );
      }
    }

    let uploadedFiles = 0;

    for (const commitId of orderedCommits) {
      uploadedFiles += await uploadLocalCommit(repoId, commitId);
    }

    const updatedRemoteIds = [
      ...new Set([...remoteState.commitIds, ...orderedCommits]),
    ];

    /*
      Update remote HEAD.
    */
    await putS3Text(getRemoteHeadKey(repoId), `${localHead}\n`, "text/plain");

    /*
      Update repository metadata.
    */
    const metadata = {
      schemaVersion: VCS_SCHEMA_VERSION,

      repositoryId: String(repoId),

      latestCommitId: localHead,

      commitCount: updatedRemoteIds.length,

      updatedAt: new Date().toISOString(),
    };

    await putS3Text(
      getRemoteMetadataKey(repoId),
      JSON.stringify(metadata, null, 2),
      "application/json",
    );

    res.json({
      message:
        orderedCommits.length > 0
          ? "Local commits pushed to S3 successfully."
          : "Remote repository is already up to date.",

      pushedCommitCount: orderedCommits.length,

      uploadedFiles,

      localHead,

      remoteHead: localHead,

      bucket: S3_BUCKET,

      prefix: getRemoteCommitsPrefix(repoId),

      metadataKey: getRemoteMetadataKey(repoId),

      headKey: getRemoteHeadKey(repoId),
    });
  } catch (error) {
    console.error("Error during pushing repository:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Pull                                                                       */
/* -------------------------------------------------------------------------- */

async function pullRepository(req, res) {
  const { repoId } = req.params;

  try {
    const repository = await ensureRepositoryExists(repoId);

    await ensureOwner(req, repository);

    let remoteState = await getRemoteState(repoId);

    if (!remoteState.head) {
      return res.status(404).json({
        message: "No remote commits found in S3 for this repository.",
      });
    }

    remoteState = await ensureRemoteMetadata(repoId, remoteState);

    const localHead = await getLocalHead(repoId);

    /*
      Don't silently destroy unpushed work.
    */
    if (localHead && !remoteState.commitIds.includes(localHead)) {
      return res.status(409).json({
        message:
          "The local repository contains unpushed commits. Push them before pulling remote changes.",

        localHead,

        remoteHead: remoteState.head,
      });
    }

    const missing = await syncMissingRemoteCommits(repoId, remoteState);

    await writeLocalHead(repoId, remoteState.head);

    const latestFiles = await restoreWorkspaceFromCommit(
      repoId,
      remoteState.head,
    );

    res.json({
      message: "Remote repository pulled successfully.",

      downloadedCommitCount: missing.length,

      latestCommitId: remoteState.head,

      localHead: remoteState.head,

      remoteHead: remoteState.head,

      workspaceFileCount: latestFiles.length,

      bucket: S3_BUCKET,

      prefix: getRemoteCommitsPrefix(repoId),
    });
  } catch (error) {
    console.error("Error during pulling repository:", error.message);

    res.status(error.status || 500).json({
      message: error.message || "Server error",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Proper revert                                                              */
/* -------------------------------------------------------------------------- */

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

    const remoteState = await getRemoteState(repoId);

    const localIds = await getLocalCommitIds(repoId);

    /*
      Download the target commit from S3
      if it isn't currently cached locally.
    */
    if (
      !localIds.includes(commitId) &&
      remoteState.commitIds.includes(commitId)
    ) {
      await downloadRemoteCommit(repoId, commitId, remoteState.objects);
    }

    const availableIds = await getLocalCommitIds(repoId);

    if (!availableIds.includes(commitId)) {
      return res.status(404).json({
        message: "Commit not found!",
      });
    }

    const localHead = await getLocalHead(repoId);

    /*
      Don't create a revert on an older
      remote state.
    */
    if (
      localHead &&
      remoteState.head &&
      localHead !== remoteState.head &&
      remoteState.commitIds.includes(localHead)
    ) {
      return res.status(409).json({
        message:
          "Your local workspace is behind the remote repository. Pull the latest changes before creating a revert commit.",
      });
    }

    const targetCommitPath = path.join(getCommitsPath(repoId), commitId);

    const targetFiles = (await readFilesRecursively(targetCommitPath)).filter(
      (file) => file.name !== "commit.json",
    );

    const parent = localHead || remoteState.head || null;

    const targetMetadata = await readLocalCommitMetadata(repoId, commitId);

    /*
      Revert is now a NEW commit
      whose snapshot equals the target
      commit and whose parent is the
      current HEAD.
    */
    const revertCommit = await createLocalCommit(repoId, repository, {
      message: `Revert to ${commitId.slice(0, 8)}: ${
        targetMetadata.message || "commit"
      }`,

      files: targetFiles,

      parent,

      reverts: commitId,
    });

    res.status(201).json({
      message:
        "Revert commit created locally. Push it to synchronize the reverted state with S3.",

      commit: revertCommit,

      revertedCommitId: commitId,
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
  getVcsStatus,
  createCommit,
  getCommitHistory,
  getCommitDetails,
  pushRepository,
  pullRepository,
  revertRepository,
};
