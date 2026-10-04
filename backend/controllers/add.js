const fs = require("fs").promises;
const path = require("path");

const vcsService = require("../services/vcsService");
const { loadCliContext } = require("../utils/cliVcsContext");

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".vcs",
  ".vcsRepos",
  ".initFold",
  "node_modules",
]);

const IGNORED_FILES = new Set([".env"]);

function toRepositoryRelativePath(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);

  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error("The file must be inside the current working directory.");
  }

  return relativePath.split(path.sep).join("/");
}

async function collectFiles(targetPath, files = []) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    const name = toRepositoryRelativePath(targetPath);

    if (path.basename(name) === ".env") {
      return files;
    }

    files.push({
      name,
      content: await fs.readFile(targetPath, "utf8"),
    });

    return files;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Unsupported path: ${targetPath}`);
  }

  const entries = await fs.readdir(targetPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    if (entry.isFile() && IGNORED_FILES.has(entry.name)) {
      continue;
    }

    await collectFiles(path.join(targetPath, entry.name), files);
  }

  return files;
}

async function addRepo(filePath) {
  const { repositoryId, userId } = await loadCliContext();

  const resolvedPath = path.resolve(process.cwd(), filePath);

  const files = await collectFiles(resolvedPath);

  const result = await vcsService.addFiles(repositoryId, userId, files);

  console.log(`Staged ${result.fileCount} file(s) successfully!`);
}

module.exports = { addRepo };
