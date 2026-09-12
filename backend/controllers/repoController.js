const createRepository = (req, res) => {
  res.send("Repository Created");
};

const getAllRepositories = (req, res) => {
  res.send("All Repository fetched");
};

const fetchRepositoryById = (req, res) => {
  res.send("Repo details fetched");
};

const fetchRepositoryByName = (req, res) => {
  res.send("Repo details fetched");
};

const fetchRepositoriesForCurrentUser = (req, res) => {
  res.send("Repo for logged in user fetched");
};

const updateRepositoryById = (req, res) => {
  res.send("Repo updated");
};

const toggleVisibilityById = (req, res) => {
  res.send("visibility toggled");
};

const deleteRepositoryById = (req, res) => {
  res.send("Repo deleted");
};

module.exports = {
  createRepository,
  getAllRepositories,
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchRepositoriesForCurrentUser,
  updateRepositoryById,
  toggleVisibilityById,
  deleteRepositoryById,
};
