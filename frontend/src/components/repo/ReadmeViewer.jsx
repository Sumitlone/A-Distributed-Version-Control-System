import React, { useEffect, useState } from "react";
import api from "../../api/apiClient";
import "./readmeViewer.css";

const inlineMarkdown = (value) => {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
};

const renderMarkdown = (markdown) => {
  const lines = String(markdown || "").split("\n");
  const output = [];
  let listItems = [];
  let codeLines = [];
  let inCode = false;

  const flushList = () => {
    if (!listItems.length) return;

    output.push(
      <ul key={`list-${output.length}`}>
        {listItems.map((item, index) => (
          <li
            key={index}
            dangerouslySetInnerHTML={{
              __html: inlineMarkdown(item),
            }}
          />
        ))}
      </ul>,
    );

    listItems = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;

    output.push(
      <pre key={`code-${output.length}`}>
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );

    codeLines = [];
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      flushList();

      if (inCode) {
        flushCode();
      }

      inCode = !inCode;
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);

    if (heading) {
      flushList();

      const level = heading[1].length;
      const Tag = `h${level}`;

      output.push(
        <Tag
          key={`heading-${index}`}
          dangerouslySetInnerHTML={{
            __html: inlineMarkdown(heading[2]),
          }}
        />,
      );

      return;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);

    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();

    output.push(
      <p
        key={`paragraph-${index}`}
        dangerouslySetInnerHTML={{
          __html: inlineMarkdown(trimmed),
        }}
      />,
    );
  });

  flushList();
  flushCode();

  return output;
};

const ReadmeViewer = ({ repoId }) => {
  const [readme, setReadme] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReadme = async () => {
      try {
        setLoading(true);
        setError("");

        const historyResponse = await api.get(`/vcs/${repoId}/commits`);

        const commits = historyResponse.data.commits || [];

        if (!commits.length) {
          setReadme("");
          return;
        }

        const latestCommit = commits[0];

        const detailsResponse = await api.get(
          `/vcs/${repoId}/commits/${latestCommit.commitId}`,
        );

        const files = detailsResponse.data.commit?.files || [];

        const readmeFile = files.find(
          (file) => file.name.toLowerCase() === "readme.md",
        );

        setReadme(readmeFile?.content || "");
      } catch (err) {
        console.error("Cannot fetch README:", err);

        setError(err.response?.data?.message || "Unable to load README.md.");
      } finally {
        setLoading(false);
      }
    };

    fetchReadme();
  }, [repoId]);

  return (
    <section className="readme-card">
      <div className="readme-heading">
        <div>
          <h2>README.md</h2>
          <p>Latest README from the repository HEAD.</p>
        </div>
      </div>

      {loading ? (
        <div className="readme-skeleton" />
      ) : error ? (
        <div className="readme-error">{error}</div>
      ) : !readme ? (
        <div className="readme-empty">
          No README.md found in the current repository history.
        </div>
      ) : (
        <article className="readme-content">{renderMarkdown(readme)}</article>
      )}
    </section>
  );
};

export default ReadmeViewer;
