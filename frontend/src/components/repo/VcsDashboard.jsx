import React, { useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import api from "../../api/apiClient";
import Navbar from "../Navbar";
import "./vcs.css";
import VcsFileTree from "./VcsFileTree";
import CodeEditor from "./CodeEditor";

import { useConfirm } from "../common/ConfirmContext";

const createFileName = (files) => {
  let index = files.length + 1;

  let name = `file${index}.txt`;

  while (files.some((file) => file.name === name)) {
    index += 1;
    name = `file${index}.txt`;
  }

  return name;
};

const shortCommitId = (commitId) => (commitId ? commitId.slice(0, 8) : "none");

const VcsDashboard = () => {
  const { confirm } = useConfirm();

  const { id } = useParams();

  const userId = localStorage.getItem("userId");

  const [repository, setRepository] = useState(null);

  const [files, setFiles] = useState([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [message, setMessage] = useState("");

  const [notice, setNotice] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  const [status, setStatus] = useState(null);

  const ownerId = useMemo(() => {
    if (!repository?.owner) {
      return null;
    }

    return typeof repository.owner === "object"
      ? String(repository.owner._id)
      : String(repository.owner);
  }, [repository]);

  const isOwner = Boolean(userId && ownerId === String(userId));

  const selectedFile = files[selectedIndex] || null;

  const fetchStatus = async () => {
    if (!isOwner) {
      return;
    }

    try {
      const response = await api.get(`/vcs/${id}/status`);

      setStatus(response.data);
    } catch (err) {
      console.error("Cannot fetch VCS status:", err);
    }
  };

  const fetchWorkspace = async () => {
    if (!isOwner) {
      setFiles([]);
      setWorkspaceLoading(false);

      return;
    }

    try {
      setWorkspaceLoading(true);

      const response = await api.get(`/vcs/${id}/workspace`);

      const workspaceFiles = response.data.files || [];

      setFiles(workspaceFiles);

      setSelectedIndex((current) =>
        workspaceFiles.length === 0
          ? 0
          : Math.min(current, workspaceFiles.length - 1),
      );
    } catch (err) {
      console.error("Cannot fetch workspace:", err);

      setError(
        err.response?.data?.message || "Unable to load repository workspace.",
      );
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/repo/${id}`);

        setRepository(response.data.repository || response.data);
      } catch (err) {
        console.error("Cannot fetch repository:", err);

        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Unable to load repository.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  useEffect(() => {
    if (!repository) {
      return;
    }

    fetchWorkspace();
    fetchStatus();
  }, [repository, isOwner, id]);

  const updateFile = (field, value) => {
    setFiles((current) =>
      current.map((file, index) =>
        index === selectedIndex
          ? {
              ...file,
              [field]: value,
            }
          : file,
      ),
    );
  };

  const handleAddFile = () => {
    const newFile = {
      name: createFileName(files),
      content: "",
    };

    setFiles((current) => [...current, newFile]);

    setSelectedIndex(files.length);

    setNotice("");
    setError("");
  };

  const handleDeleteFile = async () => {
    if (!selectedFile) {
      return;
    }

    const confirmed = await confirm({
      title: "Remove file",

      message: `Remove ${selectedFile.name} from the workspace?`,

      confirmText: "Remove file",

      cancelText: "Cancel",

      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const nextFiles = files.filter((_, index) => index !== selectedIndex);

    setFiles(nextFiles);

    setSelectedIndex((current) =>
      nextFiles.length === 0
        ? 0
        : Math.max(0, Math.min(current - 1, nextFiles.length - 1)),
    );
  };

  const handleCommit = async (event) => {
    event.preventDefault();

    if (!isOwner) {
      return;
    }

    if (!message.trim()) {
      setError("Commit message is required.");

      return;
    }

    if (files.length === 0) {
      setError("Add at least one file before committing.");

      return;
    }

    const names = files.map((file) => file.name.trim());

    if (names.some((name) => !name)) {
      setError("Every file must have a name.");

      return;
    }

    if (new Set(names).size !== names.length) {
      setError("File names must be unique.");

      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      const response = await api.post(`/vcs/${id}/commits`, {
        message: message.trim(),

        files: files.map((file) => ({
          name: file.name.trim(),
          content: file.content,
        })),
      });

      const commit = response.data.commit;

      setMessage("");

      setNotice(
        `Commit ${shortCommitId(
          commit?.commitId,
        )} created locally. Push it to synchronize with S3.`,
      );

      await fetchStatus();
    } catch (err) {
      console.error("Cannot create commit:", err);

      setError(err.response?.data?.message || "Unable to create commit.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    if (!isOwner) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      const response = await api.post(`/vcs/${id}/push`, {});

      const pushedCount = response.data.pushedCommitCount ?? 0;

      setNotice(
        pushedCount > 0
          ? `${pushedCount} commit${
              pushedCount === 1 ? "" : "s"
            } pushed to S3 successfully. Remote HEAD: ${shortCommitId(
              response.data.remoteHead,
            )}.`
          : "S3 is already up to date.",
      );

      await fetchStatus();
    } catch (err) {
      console.error("Cannot push repository:", err);

      setError(
        err.response?.data?.message || "Unable to push repository to S3.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePull = async () => {
    if (!isOwner) {
      return;
    }

    if (files.length > 0) {
      const confirmed = await confirm({
        title: "Pull from S3",

        message:
          "Pulling from S3 will replace the current workspace with the remote HEAD. Continue?",

        confirmText: "Pull changes",

        cancelText: "Cancel",

        danger: true,
      });

      if (!confirmed) {
        return;
      }
    }

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      const response = await api.post(`/vcs/${id}/pull`, {});

      const downloadedCount = response.data.downloadedCommitCount ?? 0;

      setNotice(
        `Pull completed. ${downloadedCount} new commit${
          downloadedCount === 1 ? "" : "s"
        } downloaded. Remote HEAD: ${shortCommitId(response.data.remoteHead)}.`,
      );

      await fetchWorkspace();
      await fetchStatus();
    } catch (err) {
      console.error("Cannot pull repository:", err);

      setError(
        err.response?.data?.message || "Unable to pull repository from S3.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-message">Loading repository...</p>
        </main>
      </>
    );
  }

  if (error && !repository) {
    return (
      <>
        <Navbar />

        <main className="vcs-page">
          <p className="vcs-error">{error}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="vcs-page">
        <div className="vcs-breadcrumb">
          <Link to="/">Repositories</Link>

          <span>/</span>

          <Link to={`/repo/${id}`}>{repository.name}</Link>

          <span>/</span>

          <span>Version Control</span>
        </div>

        <div className="vcs-header">
          <div>
            <h1>{repository.name} — Version Control</h1>

            <p>
              Work locally, commit snapshots, and synchronize the repository
              with its S3 remote.
            </p>
          </div>

          <Link to={`/repo/${id}/vcs/history`} className="vcs-secondary-btn">
            Commit history
          </Link>
        </div>

        {!isOwner && (
          <div className="vcs-readonly-notice">
            You can view commit history and commit details, but only the
            repository owner can modify, push, pull, or revert this repository.
          </div>
        )}

        {notice && <div className="vcs-success">{notice}</div>}

        {error && <div className="vcs-error">{error}</div>}

        {isOwner && status && (
          <section className="vcs-status-card">
            <div className="vcs-status-item">
              <span>Local HEAD</span>

              <strong>{shortCommitId(status.localHead)}</strong>
            </div>

            <div className="vcs-status-item">
              <span>Remote HEAD</span>

              <strong>{shortCommitId(status.remoteHead)}</strong>
            </div>

            <div className="vcs-status-item">
              <span>Sync state</span>

              <strong
                className={
                  status.synchronized
                    ? "vcs-sync-good"
                    : status.ahead > 0 && status.behind > 0
                      ? "vcs-sync-conflict"
                      : "vcs-sync-pending"
                }
              >
                {status.synchronized
                  ? "Up to date"
                  : status.ahead > 0 && status.behind > 0
                    ? "Diverged"
                    : status.ahead > 0
                      ? `${status.ahead} unpushed`
                      : `${status.behind} behind`}
              </strong>
            </div>

            <div className="vcs-status-item">
              <span>Remote commits</span>

              <strong>{status.remoteCommitCount}</strong>
            </div>
          </section>
        )}

        <section className="vcs-toolbar">
          <div className="vcs-toolbar-info">
            <strong>Remote</strong>

            <span>AWS S3 · repositories/{id}/commits/</span>
          </div>

          <div className="vcs-toolbar-actions">
            <button
              type="button"
              className="vcs-secondary-btn"
              onClick={handlePull}
              disabled={!isOwner || actionLoading}
            >
              Pull
            </button>

            <button
              type="button"
              className="vcs-secondary-btn"
              onClick={handlePush}
              disabled={!isOwner || actionLoading}
            >
              Push
            </button>
          </div>
        </section>

        <section className="vcs-editor-card">
          <div className="vcs-editor-heading">
            <div>
              <h2>Commit changes</h2>

              <p>
                Edit workspace files and create a new snapshot commit. Every
                commit records its parent so the history remains connected.
              </p>
            </div>

            <button
              type="button"
              className="vcs-secondary-btn"
              onClick={handleAddFile}
              disabled={!isOwner || actionLoading}
            >
              + Add file
            </button>
          </div>

          {workspaceLoading ? (
            <p className="vcs-message">Loading workspace...</p>
          ) : (
            <div className="vcs-workspace">
              <aside className="vcs-file-panel">
                <div className="vcs-file-panel-heading">
                  <span>Files</span>

                  <span>{files.length}</span>
                </div>

                <VcsFileTree
                  files={files}
                  selectedPath={selectedFile?.name || ""}
                  onSelect={(filePath) => {
                    const index = files.findIndex(
                      (file) => file.name === filePath,
                    );

                    if (index >= 0) {
                      setSelectedIndex(index);
                    }
                  }}
                />
              </aside>

              <div className="vcs-editor-panel">
                {selectedFile ? (
                  <>
                    <div className="vcs-file-header">
                      <input
                        type="text"
                        value={selectedFile.name}
                        onChange={(event) =>
                          updateFile("name", event.target.value)
                        }
                        disabled={!isOwner || actionLoading}
                        aria-label="File name"
                      />

                      <button
                        type="button"
                        className="vcs-delete-file-btn"
                        onClick={handleDeleteFile}
                        disabled={!isOwner || actionLoading}
                      >
                        Remove
                      </button>
                    </div>

                    <CodeEditor
                      fileName={selectedFile.name}
                      value={selectedFile.content}
                      onChange={(value) => updateFile("content", value)}
                      disabled={!isOwner || actionLoading}
                    />
                  </>
                ) : (
                  <div className="vcs-no-file-selected">
                    <h3>No file selected</h3>

                    <p>Add a file to create your first commit.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <form className="vcs-commit-form" onSubmit={handleCommit}>
          <div>
            <label htmlFor="commit-message">Commit message</label>

            <input
              id="commit-message"
              type="text"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);

                setError("");
              }}
              placeholder="Describe the changes"
              disabled={!isOwner || actionLoading}
              required
            />
          </div>

          <button
            type="submit"
            className="vcs-primary-btn"
            disabled={!isOwner || actionLoading}
          >
            {actionLoading ? "Working..." : "Commit changes"}
          </button>
        </form>
      </main>
    </>
  );
};

export default VcsDashboard;
