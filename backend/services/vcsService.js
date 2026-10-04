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
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

function createVcsError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

function getRepoRoot(repoId) {
  return path.join(VCS_ROOT, String(repoId));
}

function getWorkspacePath(repoId) {
  return path.join(getRepoRoot(repoId), "workspace");
}

function getStagingPath(repoId) {
  return path.join(getRepoRoot(repoId), "staging");
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

function assertValidRepoId(repoId) {
  if (!mongoose.Types.ObjectId.isValid(String(repoId))) {
    throw createVcsError("Invalid Repository ID!", 400);
  }
}

/* -------------------------------------------------------------------------- */
/* Repository access                                                          */
/* -------------------------------------------------------------------------- */

async function getRepository(repoId) {
  assertValidRepoId(repoId);

  return Repository.findById(repoId).select("name owner visibility content");
}

async function resolveRepositoryByName(repoName, userId) {
  const normalizedName = String(repoName || "").trim();

  if (!normalizedName) {
    throw createVcsError("Repository name is required.", 400);
  }

  if (!userId) {
    throw createVcsError("Authentication required.", 401);
  }

  const repository = await Repository.findOne({
    name: normalizedName,
    owner: userId,
  }).select("name owner visibility");

  if (!repository) {
    throw createVcsError(
      `Repository "${normalizedName}" was not found among your repositories.`,
      404,
    );
  }

  return repository;
}

async function ensureRepositoryExists(repoId) {
  const repository = await getRepository(repoId);

  if (!repository) {
    throw createVcsError("Repository not found!", 404);
  }

  await ensureRepoDirs(repoId);

  return repository;
}

async function ensureOwner(repoId, userId, repository = null) {
  if (!userId) {
    throw createVcsError("Authentication required for this operation.", 401);
  }

  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw createVcsError("Invalid User ID!", 400);
  }

  const repo = repository || (await ensureRepositoryExists(repoId));

  if (String(repo.owner) !== String(userId)) {
    throw createVcsError(
      "Only the repository owner can perform this operation.",
      403,
    );
  }

  return repo;
}

async function ensureViewer(repoId, userId, repository = null) {
  if (!userId) {
    throw createVcsError("Authentication required for this operation.", 401);
  }

  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw createVcsError("Invalid User ID!", 400);
  }

  const repo = repository || (await ensureRepositoryExists(repoId));

  const isOwner = String(repo.owner) === String(userId);

  if (!repo.visibility && !isOwner) {
    throw createVcsError(
      "This repository is private and can only be viewed by its owner.",
      403,
    );
  }

  return repo;
}

/* -------------------------------------------------------------------------- */
/* Local filesystem                                                           */
/* -------------------------------------------------------------------------- */

async function ensureRepoDirs(repoId) {
  await fs.mkdir(getWorkspacePath(repoId), { recursive: true });
  await fs.mkdir(getStagingPath(repoId), { recursive: true });
  await fs.mkdir(getCommitsPath(repoId), { recursive: true });
}

async function initRepository(repoId, userId) {
  const repository = await ensureOwner(repoId, userId);

  await ensureRepoDirs(repoId);

  const remoteState = await getRemoteState(repoId);

  if (
    !remoteState.head &&
    remoteState.commitIds.length === 0 &&
    !remoteState.metadata
  ) {
    await putS3Text(getRemoteHeadKey(repoId), "\n", "text/plain");

    await putS3Text(
      getRemoteMetadataKey(repoId),
      JSON.stringify(
        {
          schemaVersion: VCS_SCHEMA_VERSION,
          repositoryId: String(repoId),
          latestCommitId: null,
          commitCount: 0,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  return {
    repository: {
      _id: repository._id,
      name: repository.name,
    },
    localPath: getRepoRoot(repoId),
    remotePrefix: getRemotePrefix(repoId),
  };
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
  await fs.mkdir(directory, { recursive: true });

  for (const file of files) {
    const safeName = normalizeRelativePath(file.name);

    if (!safeName) {
      throw createVcsError(`Invalid file name: ${file.name}`, 400);
    }

    const filePath = path.join(directory, ...safeName.split("/"));
    const relativeCheck = path.relative(directory, filePath);

    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      throw createVcsError(`Invalid file path: ${file.name}`, 400);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, String(file.content ?? ""), "utf8");
  }
}

async function clearDirectory(directory) {
  await fs.rm(directory, {
    recursive: true,
    force: true,
  });

  await fs.mkdir(directory, {
    recursive: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Local HEAD / commits                                                       */
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
  await fs.mkdir(getRepoRoot(repoId), { recursive: true });

  if (!commitId) {
    await fs.rm(getLocalHeadPath(repoId), { force: true });
    return;
  }

  await fs.writeFile(getLocalHeadPath(repoId), `${commitId}\n`, "utf8");
}

async function getLocalCommitIds(repoId) {
  const commitsPath = getCommitsPath(repoId);

  await fs.mkdir(commitsPath, { recursive: true });

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
/* Staging                                                                    */
/* -------------------------------------------------------------------------- */

async function prepareFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw createVcsError("At least one file is required.", 400);
  }

  const preparedFiles = files.map((file) => {
    const name = normalizeRelativePath(file?.name);

    if (!name) {
      throw createVcsError(`Invalid file name: ${file?.name}`, 400);
    }

    return {
      name,
      content: String(file?.content ?? ""),
    };
  });

  const uniqueNames = new Set(preparedFiles.map((file) => file.name));

  if (uniqueNames.size !== preparedFiles.length) {
    throw createVcsError("Duplicate file names are not allowed.", 400);
  }

  return preparedFiles;
}

async function addFiles(repoId, userId, files, { replace = false } = {}) {
  const repository = await ensureOwner(repoId, userId);

  const preparedFiles = await prepareFiles(files);

  const stagingPath = getStagingPath(repoId);

  if (replace) {
    await clearDirectory(stagingPath);
  }

  await fs.mkdir(stagingPath, {
    recursive: true,
  });

  await writeFiles(stagingPath, preparedFiles);

  const stagedFiles = await getStagedFiles(repoId);

  return {
    repository: {
      _id: repository._id,
      name: repository.name,
    },
    files: preparedFiles,
    fileCount: stagedFiles.length,
    stagedFiles,
  };
}

async function getStagedFiles(repoId) {
  const stagingPath = getStagingPath(repoId);

  await fs.mkdir(stagingPath, { recursive: true });

  return readFilesRecursively(stagingPath);
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
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
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
      // Ignore malformed metadata.
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
    throw createVcsError(`Remote commit ${commitId} was not found.`, 404);
  }

  const localCommitDirectory = path.join(getCommitsPath(repoId), commitId);

  await fs.mkdir(localCommitDirectory, { recursive: true });

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

    await fs.mkdir(path.dirname(localPath), { recursive: true });
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

  await clearDirectory(workspacePath);
  await writeFiles(workspacePath, commitFiles);

  return commitFiles;
}

async function prepareLocalState(repoId, remoteState) {
  const localHead = await getLocalHead(repoId);

  if (!localHead && remoteState.head) {
    await syncMissingRemoteCommits(repoId, remoteState);
    await writeLocalHead(repoId, remoteState.head);
    await restoreWorkspaceFromCommit(repoId, remoteState.head);

    return remoteState.head;
  }

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
  if (!message || !String(message).trim()) {
    throw createVcsError("Commit message is required!", 400);
  }

  const preparedFiles = await prepareFiles(files);
  const commitId = uuidv4();
  const commitsPath = getCommitsPath(repoId);
  const workspacePath = getWorkspacePath(repoId);
  const commitPath = path.join(commitsPath, commitId);

  await clearDirectory(workspacePath);
  await writeFiles(workspacePath, preparedFiles);

  await fs.mkdir(commitPath, { recursive: true });
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

  await clearDirectory(getStagingPath(repoId));

  return {
    ...metadata,
    fileCount: preparedFiles.length,
    repositoryName: repository.name,
    pushed: false,
  };
}

async function createCommit(repoId, userId, { message } = {}) {
  const repository = await ensureOwner(repoId, userId);

  const remoteState = await getRemoteState(repoId);
  const localHead = await getLocalHead(repoId);

  if (!localHead && remoteState.head) {
    await prepareLocalState(repoId, remoteState);
  }

  const preparedLocalHead = (await getLocalHead(repoId)) || null;

  if (
    preparedLocalHead &&
    remoteState.head &&
    preparedLocalHead !== remoteState.head &&
    remoteState.commitIds.includes(preparedLocalHead)
  ) {
    throw createVcsError(
      "Your local workspace is behind the remote repository. Pull the latest changes before creating a new commit.",
      409,
    );
  }

  const stagedFiles = await getStagedFiles(repoId);

  if (!Array.isArray(stagedFiles) || stagedFiles.length === 0) {
    throw createVcsError(
      "At least one staged file is required to create a commit! Run add/stage first.",
      400,
    );
  }

  const parent = preparedLocalHead || remoteState.head || null;

  return createLocalCommit(repoId, repository, {
    message,
    files: stagedFiles,
    parent,
  });
}

/* -------------------------------------------------------------------------- */
/* Workspace / status                                                         */
/* -------------------------------------------------------------------------- */

async function getWorkspace(repoId, userId) {
  const repository = await ensureOwner(repoId, userId);
  const remoteState = await getRemoteState(repoId);
  const localHead = await prepareLocalState(repoId, remoteState);
  const files = await readFilesRecursively(getWorkspacePath(repoId));
  const localCommitIds = await getLocalCommitIds(repoId);

  return {
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
  };
}

async function getVcsStatus(repoId, userId) {
  const repository = await ensureOwner(repoId, userId);
  let remoteState = await getRemoteState(repoId);

  if (remoteState.head) {
    remoteState = await ensureRemoteMetadata(repoId, remoteState);
  }

  const localHead = await getLocalHead(repoId);
  const localCommitIds = await getLocalCommitIds(repoId);
  const stagedFiles = await getStagedFiles(repoId);

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

  return {
    repositoryId: String(repoId),
    localHead,
    remoteHead: remoteState.head,
    ahead: aheadCommitIds.length,
    behind: behindCommitIds.length,
    aheadCommitIds,
    behindCommitIds,
    synchronized,
    remoteCommitCount: remoteState.commitIds.length,
    stagedFileCount: stagedFiles.length,
    stagedFiles: stagedFiles.map((file) => file.name),
    metadata: remoteState.metadata || null,
    repository,
  };
}

/* -------------------------------------------------------------------------- */
/* Commit history / details                                                   */
/* -------------------------------------------------------------------------- */

async function getCommitHistory(repoId, userId) {
  const repository = await ensureViewer(repoId, userId);
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
      console.error(`Unable to read commit ${commitId}:`, commitError.message);
    }
  }

  commits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    repository: {
      _id: repository._id,
      name: repository.name,
    },
    commits,
    remoteHead: remoteState.head,
  };
}

async function getCommitDetails(repoId, userId, commitId) {
  const repository = await ensureViewer(repoId, userId);

  if (!isValidCommitId(commitId)) {
    throw createVcsError("Invalid commit ID!", 400);
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
    throw createVcsError("Commit not found!", 404);
  }

  const metadata = await readLocalCommitMetadata(repoId, commitId);

  const files = (
    await readFilesRecursively(path.join(getCommitsPath(repoId), commitId))
  ).filter((file) => file.name !== "commit.json");

  return {
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
  };
}

/* -------------------------------------------------------------------------- */
/* Push                                                                       */
/* -------------------------------------------------------------------------- */

async function uploadLocalCommit(repoId, commitId) {
  const commitDirectory = path.join(getCommitsPath(repoId), commitId);
  const files = await readFilesRecursively(commitDirectory);
  let uploadedFiles = 0;

  for (const file of files) {
    await s3
      .upload({
        Bucket: S3_BUCKET,
        Key: getRemoteCommitKey(repoId, commitId, file.name),
        Body: Buffer.from(file.content, "utf8"),
      })
      .promise();

    uploadedFiles += 1;
  }

  return uploadedFiles;
}

async function isLocalHeadBasedOnRemoteHead(repoId, localHead, remoteHead) {
  if (!localHead || !remoteHead || localHead === remoteHead) {
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

async function pushRepository(repoId, userId) {
  await ensureOwner(repoId, userId);

  const localCommitIds = await getLocalCommitIds(repoId);
  const localHead = await getLocalHead(repoId);

  if (!localHead || localCommitIds.length === 0) {
    throw createVcsError("There are no local commits to push.", 400);
  }

  let remoteState = await getRemoteState(repoId);

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
      throw createVcsError(
        "Push rejected because the local history has diverged from the remote repository. Pull or reconcile the histories before pushing.",
        409,
      );
    }
  }

  const commitsToPush = localCommitIds.filter(
    (commitId) => !remoteState.commitIds.includes(commitId),
  );

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
      throw createVcsError(
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

  await putS3Text(getRemoteHeadKey(repoId), `${localHead}\n`, "text/plain");

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

  return {
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
  };
}

/* -------------------------------------------------------------------------- */
/* Pull                                                                       */
/* -------------------------------------------------------------------------- */

async function pullRepository(repoId, userId) {
  await ensureOwner(repoId, userId);

  let remoteState = await getRemoteState(repoId);

  if (!remoteState.head) {
    throw createVcsError(
      "No remote commits found in S3 for this repository.",
      404,
    );
  }

  remoteState = await ensureRemoteMetadata(repoId, remoteState);

  const localHead = await getLocalHead(repoId);

  if (localHead && !remoteState.commitIds.includes(localHead)) {
    throw createVcsError(
      "The local repository contains unpushed commits. Push them before pulling remote changes.",
      409,
    );
  }

  const missing = await syncMissingRemoteCommits(repoId, remoteState);
  await writeLocalHead(repoId, remoteState.head);
  await clearDirectory(getStagingPath(repoId));

  const latestFiles = await restoreWorkspaceFromCommit(
    repoId,
    remoteState.head,
  );

  return {
    message: "Remote repository pulled successfully.",
    downloadedCommitCount: missing.length,
    latestCommitId: remoteState.head,
    localHead: remoteState.head,
    remoteHead: remoteState.head,
    workspaceFileCount: latestFiles.length,
    bucket: S3_BUCKET,
    prefix: getRemoteCommitsPrefix(repoId),
  };
}

/* -------------------------------------------------------------------------- */
/* Revert                                                                     */
/* -------------------------------------------------------------------------- */

async function revertRepository(repoId, userId, commitId) {
  const repository = await ensureOwner(repoId, userId);

  if (!isValidCommitId(commitId)) {
    throw createVcsError("Invalid commit ID!", 400);
  }

  const remoteState = await getRemoteState(repoId);
  const localIds = await getLocalCommitIds(repoId);

  if (
    !localIds.includes(commitId) &&
    remoteState.commitIds.includes(commitId)
  ) {
    await downloadRemoteCommit(repoId, commitId, remoteState.objects);
  }

  const availableIds = await getLocalCommitIds(repoId);

  if (!availableIds.includes(commitId)) {
    throw createVcsError("Commit not found!", 404);
  }

  const localHead = await getLocalHead(repoId);

  if (
    localHead &&
    remoteState.head &&
    localHead !== remoteState.head &&
    remoteState.commitIds.includes(localHead)
  ) {
    throw createVcsError(
      "Your local workspace is behind the remote repository. Pull the latest changes before creating a revert commit.",
      409,
    );
  }

  const targetCommitPath = path.join(getCommitsPath(repoId), commitId);
  const targetFiles = (await readFilesRecursively(targetCommitPath)).filter(
    (file) => file.name !== "commit.json",
  );

  const parent = localHead || remoteState.head || null;
  const targetMetadata = await readLocalCommitMetadata(repoId, commitId);

  const revertCommit = await createLocalCommit(repoId, repository, {
    message: `Revert to ${commitId.slice(0, 8)}: ${
      targetMetadata.message || "commit"
    }`,
    files: targetFiles,
    parent,
    reverts: commitId,
  });

  return {
    message:
      "Revert commit created locally. Push it to synchronize the reverted state with S3.",
    commit: revertCommit,
    revertedCommitId: commitId,
  };
}

module.exports = {
  initRepository,
  resolveRepositoryByName,
  addFiles,
  createCommit,
  getWorkspace,
  getVcsStatus,
  getCommitHistory,
  getCommitDetails,
  pushRepository,
  pullRepository,
  revertRepository,
  getRemotePrefix,
  getRemoteCommitsPrefix,
  getRemoteHeadKey,
  getRemoteMetadataKey,
};
