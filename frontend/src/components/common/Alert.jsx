import React from "react";
import "./feedback.css";

const icons = {
  error: "!",
  success: "✓",
  warning: "!",
  info: "i",
};

const Alert = ({ type = "info", children, onClose }) => {
  return (
    <div className={`app-alert ${type}`} role="alert">
      <span className="app-alert-icon">{icons[type] || icons.info}</span>

      <span className="app-alert-message">{children}</span>

      {onClose && (
        <button
          type="button"
          className="app-alert-close"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
