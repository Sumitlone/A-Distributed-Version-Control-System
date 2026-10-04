const fs = require("fs").promises;
const path = require("path");

const User = require("../models/userModel");
const { verifyAuthToken } = require("../services/authService");

const CLI_ROOT = path.resolve(process.cwd(), ".vcs");

const CLI_CONTEXT_PATH = path.join(CLI_ROOT, "config.json");

async function readConfig() {
  try {
    const raw = await fs.readFile(CLI_CONTEXT_PATH, "utf8");

    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new Error("CLI configuration is not valid JSON.");
    }

    throw error;
  }
}

async function writeConfig(config) {
  await fs.mkdir(CLI_ROOT, {
    recursive: true,
  });

  await fs.writeFile(CLI_CONTEXT_PATH, JSON.stringify(config, null, 2), "utf8");
}

async function saveCliUser({ token, userId, username, email }) {
  await writeConfig({
    token,
    user: {
      id: String(userId),
      username,
      email,
    },
    repository: null,
  });
}

async function selectCliRepository({ repositoryId, repositoryName }) {
  const config = await readConfig();

  if (!config.token || !config.user?.id) {
    throw new Error('You are not logged in. Run "node index.js login" first.');
  }

  await writeConfig({
    ...config,
    repository: {
      id: String(repositoryId),
      name: String(repositoryName),
    },
  });
}

async function clearCliContext() {
  try {
    await fs.rm(CLI_CONTEXT_PATH, {
      force: true,
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function loadCliContext({ requireRepository = true } = {}) {
  const config = await readConfig();

  if (!config.token || !config.user?.id) {
    throw new Error('You are not logged in. Run "node index.js login" first.');
  }

  const decoded = verifyAuthToken(config.token);

  if (!decoded?.id || String(decoded.id) !== String(config.user.id)) {
    throw new Error("CLI authentication context is invalid.");
  }

  const user = await User.findById(decoded.id).select("_id username email");

  if (!user) {
    throw new Error("The logged-in user no longer exists.");
  }

  if (requireRepository && !config.repository?.id) {
    throw new Error(
      'No repository is selected. Run "node index.js init <repoName>" first.',
    );
  }

  return {
    userId: String(user._id),
    username: user.username,
    email: user.email,
    repositoryId: config.repository?.id || null,
    repositoryName: config.repository?.name || null,
  };
}

module.exports = {
  CLI_ROOT,
  CLI_CONTEXT_PATH,
  saveCliUser,
  selectCliRepository,
  clearCliContext,
  loadCliContext,
};
