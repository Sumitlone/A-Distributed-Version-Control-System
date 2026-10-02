import React, { createContext, useContext, useState } from "react";

import "./feedback.css";

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider.");
  }

  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);

  const confirm = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
  }) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmText,
        cancelText,
        danger,
        resolve,
      });
    });
  };

  const closeDialog = (result) => {
    if (!dialog) {
      return;
    }

    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider
      value={{
        confirm,
      }}
    >
      {children}

      {dialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog" role="dialog" aria-modal="true">
            <div className="confirm-dialog-header">
              <h2>{dialog.title}</h2>
            </div>

            <p className="confirm-dialog-message">{dialog.message}</p>

            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={() => closeDialog(false)}
              >
                {dialog.cancelText}
              </button>

              <button
                type="button"
                className={
                  dialog.danger
                    ? "confirm-submit-btn danger"
                    : "confirm-submit-btn"
                }
                onClick={() => closeDialog(true)}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
