import React from "react";
import "./errorBoundary.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled frontend error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary-page">
          <section className="error-boundary-card">
            <span className="error-boundary-icon">!</span>

            <h1>Something went wrong</h1>

            <p>
              The application hit an unexpected error. Reload the page and try
              again.
            </p>

            <button type="button" onClick={this.handleReload}>
              Reload application
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
