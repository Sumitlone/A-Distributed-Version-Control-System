const createIssue = (req, res) => {
  res.send("Issue Created");
};

const upadteIssueById = (req, res) => {
  res.send("Issue updated");
};

const deleteIssueById = (req, res) => {
  res.send("Issue deleted");
};

const getAllIssues = (req, res) => {
  res.send("All Issue fetched");
};

const getIssueById = (req, res) => {
  res.send("Issue deatils fetched");
};

module.exports = {
  createIssue,
  upadteIssueById,
  deleteIssueById,
  getAllIssues,
  getIssueById,
};
