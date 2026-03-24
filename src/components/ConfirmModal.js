
 

export default function ConfirmModal({
    title,
    body,
    confirmLabel = "Confirm",
    cancelLabel  = "Cancel",
    danger       = false,
    onConfirm,
    onClose,
    txPending    = false,
  }) {
    function handleConfirm() {
      onConfirm();
      onClose();
    }
  
    return (
      // Backdrop
      <div
        style={{
          position:        "fixed",
          inset:           0,
          background:      "rgba(0,0,0,0.6)",
          backdropFilter:  "blur(4px)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          zIndex:          9990,
          padding:         "0 16px",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Dialog */}
        <div
          style={{
            background:   "var(--bg2)",
            border:       `1px solid ${danger ? "rgba(255,92,122,.4)" : "var(--border)"}`,
            borderRadius: "var(--radius)",
            padding:      "28px 28px 24px",
            maxWidth:     460,
            width:        "100%",
            boxShadow:    "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Icon + Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{
              width:        36,
              height:       36,
              borderRadius: "50%",
              background:   danger ? "rgba(255,92,122,.12)" : "var(--purple-dim)",
              border:       `1px solid ${danger ? "rgba(255,92,122,.3)" : "var(--purple-mid)"}`,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontSize:     16,
              flexShrink:   0,
            }}>
              {danger ? "⚠️" : "❓"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: danger ? "var(--red)" : "var(--text)" }}>
              {title}
            </div>
          </div>
  
          {/* Body */}
          {body && (
            <div style={{
              fontSize:    13,
              color:       "var(--text2)",
              lineHeight:  1.6,
              marginBottom: 22,
              paddingLeft:  48, // align with title text
            }}>
              {body}
            </div>
          )}
  
          {/* On-chain warning */}
          <div style={{
            background:   danger ? "rgba(255,92,122,.06)" : "var(--purple-dim)",
            border:       `1px solid ${danger ? "rgba(255,92,122,.2)" : "var(--purple-mid)"}`,
            borderRadius: "var(--radius-sm)",
            padding:      "10px 14px",
            fontSize:     12,
            color:        danger ? "var(--red)" : "var(--purple)",
            marginBottom: 22,
          }}>
            This action is recorded on the blockchain and <strong>cannot be undone</strong>.
            You will need to confirm it in MetaMask.
          </div>
  
          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={txPending}
              style={{ padding: "9px 20px" }}
            >
              {cancelLabel}
            </button>
            <button
              className={danger ? "btn-danger" : "btn-primary"}
              onClick={handleConfirm}
              disabled={txPending}
              style={{
                padding:    "9px 20px",
                fontWeight: 700,
                // Override btn-danger to be solid for a confirm dialog
                ...(danger ? {
                  background: "var(--red)",
                  color:      "#fff",
                  border:     "none",
                } : {}),
              }}
            >
              {txPending ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }