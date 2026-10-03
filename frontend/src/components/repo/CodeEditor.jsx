import React, { useEffect, useMemo, useRef, useState } from "react";
import "./codeEditor.css";

const extensionLanguage = (name) => {
  const lower = name.toLowerCase();

  if (lower.endsWith(".jsx")) return "JavaScript React";
  if (lower.endsWith(".js")) return "JavaScript";
  if (lower.endsWith(".ts")) return "TypeScript";
  if (lower.endsWith(".tsx")) return "TypeScript React";
  if (lower.endsWith(".html")) return "HTML";
  if (lower.endsWith(".css")) return "CSS";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".md")) return "Markdown";
  if (lower.endsWith(".py")) return "Python";
  if (lower.endsWith(".java")) return "Java";

  return "Plain Text";
};

const CodeEditor = ({ fileName, value, onChange, disabled }) => {
  const [language, setLanguage] = useState(extensionLanguage(fileName || ""));

  const lineNumbersRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setLanguage(extensionLanguage(fileName || ""));
  }, [fileName]);

  const lineCount = useMemo(
    () => Math.max(1, String(value || "").split("\n").length),
    [value],
  );

  const syncScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="code-editor">
      <div className="code-editor-toolbar">
        <span className="code-editor-file-name">{fileName || "untitled"}</span>

        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          disabled={disabled}
          aria-label="Code language"
        >
          <option>Plain Text</option>
          <option>JavaScript</option>
          <option>JavaScript React</option>
          <option>TypeScript</option>
          <option>TypeScript React</option>
          <option>HTML</option>
          <option>CSS</option>
          <option>JSON</option>
          <option>Markdown</option>
          <option>Python</option>
          <option>Java</option>
        </select>
      </div>

      <div className="code-editor-body">
        <div
          className="code-editor-line-numbers"
          ref={lineNumbersRef}
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          className="code-editor-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          disabled={disabled}
          spellCheck="false"
          wrap="off"
          aria-label="Code editor"
        />
      </div>
    </div>
  );
};

export default CodeEditor;
