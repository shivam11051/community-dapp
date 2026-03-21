/**
 * ERROR BOUNDARY COMPONENT
 * 
 * Catches React errors and prevents white-screen-of-death
 * Shows user-friendly error message instead
 * 
 * USAGE:
 * ──────────────────────────────────────────
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * 
 * Now if ANY error happens inside <App />,
 * the ErrorBoundary will catch it and show
 * a nice error UI instead of crashing.
 */

import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,        // Is there an error?
      error: null,            // The error object
      errorInfo: null,        // Component stack trace
      errorCount: 0,          // How many errors so far?
    };
  }

  /**
   * Update state when an error is caught
   * This is called during render phase
   */
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  /**
   * Log error details
   * This is called after error is caught
   */
  componentDidCatch(error, errorInfo) {
    console.error("🚨 ERROR BOUNDARY CAUGHT AN ERROR:");
    console.error("Error:", error);
    console.error("Component Stack:", errorInfo.componentStack);

    this.setState(prev => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Optional: Send to error tracking service (Sentry, LogRocket, etc.)
    // trackError(error, errorInfo);
  }

  /**
   * Reset error state and try again
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    // If there's an error, show error UI
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === "development";

      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg1)",
          fontFamily: "inherit",
          padding: 20,
        }}>
          {/* ERROR CARD */}
          <div style={{
            background: "var(--bg2)",
            border: "2px solid var(--red)",
            borderRadius: "var(--radius)",
            padding: "40px 30px",
            maxWidth: 500,
            textAlign: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          }}>

            {/* 🚨 ERROR ICON */}
            <div style={{
              fontSize: 64,
              marginBottom: 16,
              animation: "pulse 2s infinite",
            }}>
              🚨
            </div>

            {/* ERROR TITLE */}
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--red)",
              marginBottom: 12,
            }}>
              Oops! Something went wrong
            </div>

            {/* ERROR MESSAGE */}
            <div style={{
              fontSize: 14,
              color: "var(--text2)",
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              The app encountered an unexpected error and needs to restart.
              <br />
              <span style={{ 
                marginTop: 8, 
                display: "block",
                fontSize: 12,
                color: "var(--text3)"
              }}>
                Error count: <strong>{this.state.errorCount}</strong>
              </span>
            </div>

            {/* DEV ERROR DETAILS */}
            {isDev && this.state.error && (
              <div style={{
                background: "rgba(255, 92, 122, 0.1)",
                border: "1px solid rgba(255, 92, 122, 0.3)",
                borderRadius: "var(--radius-sm)",
                padding: 12,
                marginBottom: 20,
                textAlign: "left",
                maxHeight: 250,
                overflowY: "auto",
              }}>
                {/* ERROR MESSAGE */}
                <div style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "var(--red)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginBottom: 12,
                  borderBottom: "1px solid rgba(255, 92, 122, 0.2)",
                  paddingBottom: 12,
                }}>
                  <strong>Error:</strong>
                  <br />
                  {this.state.error.toString()}
                </div>

                {/* COMPONENT STACK */}
                <div style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--text3)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  <strong>Component Stack:</strong>
                  <br />
                  {this.state.errorInfo?.componentStack}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}>
              {/* TRY AGAIN BUTTON */}
              <button
                onClick={this.resetError}
                style={{
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--purple)",
                  color: "white",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "var(--purple-bright)";
                  e.target.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--purple)";
                  e.target.style.transform = "scale(1)";
                }}
              >
                🔄 Try Again
              </button>

              {/* GO HOME BUTTON */}
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  color: "var(--text2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "var(--bg3)";
                  e.target.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "var(--text2)";
                }}
              >
                🏠 Go Home
              </button>
            </div>

            {/* SUPPORT MESSAGE */}
            <div style={{
              fontSize: 12,
              color: "var(--text3)",
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid var(--border)",
            }}>
              If the problem persists, please:
              <br />
              1. Refresh the page (F5)
              <br />
              2. Clear cache (Ctrl+Shift+Delete)
              <br />
              3. Check console for details (F12)
            </div>
          </div>

          {/* PULSE ANIMATION */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          `}</style>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;