const fs = require("fs").promises;
const path = require("path");

async function addRepo(filePath) {
  const repoPath = path.resolve(process.cwd(), ".initFold");
  const stagedPath = path.join(repoPath, "staging");

  try {
    await fs.mkdir(stagedPath, { recursive: true });
    const fileName = path.basename(filePath);
    await fs.copyFile(filePath, path.join(stagedPath, fileName));
    console.log(`File ${fileName} added to the staging area!`);
  } catch (err) {
    console.error("Error adding file", err);
  }
}

module.exports = { addRepo };
