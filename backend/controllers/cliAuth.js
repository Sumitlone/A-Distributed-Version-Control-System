const readline = require("readline");
const {
  authenticateUser,
  createAuthToken,
} = require("../services/authService");

const {
  saveCliUser,
  clearCliContext,
  loadCliContext,
} = require("../utils/cliVcsContext");

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHiddenQuestion(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return askQuestion(question);
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    let password = "";

    stdout.write(question);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (character) => {
      if (character === "\r" || character === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);

        stdout.write("\n");
        resolve(password);

        return;
      }

      if (character === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);

        stdout.write("\n");

        reject(new Error("Login cancelled."));

        return;
      }

      if (character === "\u007f") {
        password = password.slice(0, -1);

        return;
      }

      password += character;
    };

    stdin.on("data", onData);
  });
}

async function loginCli() {
  const email = await askQuestion("Email: ");

  const password = await askHiddenQuestion("Password: ");

  const user = await authenticateUser(email, password);

  const token = createAuthToken(user._id);

  await saveCliUser({
    token,
    userId: user._id,
    username: user.username,
    email: user.email,
  });

  console.log("");
  console.log("Login successful!");
  console.log(`User: ${user.username}`);
  console.log(`Email: ${user.email}`);
  console.log("");
  console.log('Run "node index.js init <repoName>" to select a repository.');
}

async function logoutCli() {
  await clearCliContext();

  console.log("CLI logout successful.");
}

async function whoamiCli() {
  const context = await loadCliContext({
    requireRepository: false,
  });

  console.log(`Username: ${context.username}`);

  console.log(`Email: ${context.email}`);

  console.log(`User ID: ${context.userId}`);

  if (context.repositoryId) {
    console.log(`Repository: ${context.repositoryName}`);

    console.log(`Repository ID: ${context.repositoryId}`);
  } else {
    console.log("Repository: none selected");
  }
}

module.exports = {
  loginCli,
  logoutCli,
  whoamiCli,
};
