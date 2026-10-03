import React, { useMemo, useState } from "react";
import "./vcsFileTree.css";

function buildTree(files) {
  const root = {
    type: "folder",
    name: "root",
    children: new Map(),
  };

  files.forEach((file) => {
    const parts = file.name.split("/").filter(Boolean);

    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          type: isFile ? "file" : "folder",
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          children: isFile ? undefined : new Map(),
        });
      }

      current = current.children.get(part);
    });
  });

  return root;
}

const TreeNode = ({ node, depth, selectedPath, onSelect }) => {
  const [expanded, setExpanded] = useState(true);

  const children = useMemo(() => {
    if (!node.children) return [];

    return [...node.children.values()].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [node]);

  if (node.name !== "root") {
    return (
      <div>
        <button
          type="button"
          className={`vcs-tree-node ${
            selectedPath === node.path ? "selected" : ""
          }`}
          style={{
            paddingLeft: `${10 + depth * 14}px`,
          }}
          onClick={() => {
            if (node.type === "folder") {
              setExpanded((value) => !value);
            } else {
              onSelect(node.path);
            }
          }}
        >
          <span className="vcs-tree-icon">
            {node.type === "folder" ? (expanded ? "▾" : "▸") : "•"}
          </span>

          <span>{node.name}</span>
        </button>

        {node.type === "folder" && expanded && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

const VcsFileTree = ({ files, selectedPath, onSelect }) => {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="vcs-tree">
      {files.length ? (
        <TreeNode
          node={tree}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ) : (
        <p className="vcs-tree-empty">No files yet.</p>
      )}
    </div>
  );
};

export default VcsFileTree;
