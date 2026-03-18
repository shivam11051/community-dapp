import { useState } from "react";
import { parseEther } from "ethers";

export default function CreateGroup({
  account, myGroupId, currency, txPending, actions, navigate, addNotif
}) {
  const [name,              setName]              = useState("");
  const [maxSize,           setMaxSize]           = useState(3);
  const [tenure,            setTenure]            = useState(6);
  const [ethAmount,         setEthAmount]         = useState("0.01");
  const [submitted,         setSubmitted]         = useState(false);
  const [isPrivate,         setIsPrivate]         = useState(false);
  const [inviteAddresses,   setInviteAddresses]   = useState("");

  const inrAmount = (parseFloat(ethAmount || 0) * 500000).toLocaleString();
  const totalPool = (parseFloat(ethAmount || 0) * maxSize * 500000).toLocaleString();

  async function handleCreate() {
    if (!name.trim())             return addNotif("Group name is required", "error");
    if (!ethAmount || parseFloat(ethAmount) <= 0) return addNotif("Contribution must be > 0", "error");
    if (maxSize < 2 || maxSize > 40) return addNotif("Size must be 2–40", "error");
    if (tenure < 1  || tenure > 24)  return addNotif("Tenure must be 1–24 months", "error");

    // Validate private group invites
    if (isPrivate) {
      const invites = inviteAddresses
        .split(/[,\n]/)
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);
      
      if (invites.length === 0) {
        return addNotif("Private groups must have at least one invited member", "error");
      }

      // Basic Ethereum address validation
      const invalidAddrs = invites.filter(addr => !addr.match(/^0x[a-fA-F0-9]{40}$/));
      if (invalidAddrs.length > 0) {
        return addNotif(`Invalid addresses: ${invalidAddrs.join(", ")}`, "error");
      }
    }

    const ok = await actions.createGroup(
      name.trim(),
      maxSize,
      tenure,
      ethAmount,
      isPrivate,
      isPrivate ? inviteAddresses.split(/[,\n]/).map(a => a.trim()).filter(a => a) : []
    );
    if (ok) setSubmitted(true);
  }

  if (myGroupId > 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">Create Group</div>
        </div>
        <div className="warn-box">
          You are already in Group #{myGroupId}. You must leave or complete your current group before creating a new one.
        </div>
        <button className="btn-primary" onClick={() => navigate("dashboard", myGroupId)}>
          Go to My Group
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">Group Submitted!</div>
        </div>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "40px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ color: "var(--purple)", marginBottom: 10, fontSize: 20 }}>Group Created!</h2>
          <p style={{ color: "var(--text2)", marginBottom: 20, lineHeight: 1.6 }}>
            Your {isPrivate ? "private" : "public"} group{" "}
            <strong style={{ color: "var(--text)" }}>&quot;{name}&quot;</strong> has been submitted
            and is waiting for admin approval. You will be notified once it&apos;s approved and open for others to join.
          </p>
          <div className="info-box" style={{ textAlign: "left", marginBottom: 20 }}>
            <strong>What happens next:</strong><br />
            1. Admin reviews and approves your group<br />
            2. Group becomes OPEN &mdash; {isPrivate ? "invited members" : "others"} can join<br />
            3. Once full, you can start voting for borrower
          </div>
          <button className="btn-primary" style={{ width: "100%" }} onClick={() => navigate("dashboard")}>
            Go to My Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Create a Group</div>
        <div className="page-sub">Set your group&apos;s rules — members will see these before joining</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

        {/* ── Form ──────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Group Details</div>
          </div>

          {/* ── GROUP TYPE TOGGLE ─────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Group Type</label>
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <button
                className={`btn-toggle ${!isPrivate ? "active" : ""}`}
                onClick={() => setIsPrivate(false)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: !isPrivate ? "2px solid var(--purple)" : "1px solid var(--border)",
                  background: !isPrivate ? "var(--purple-dim)" : "transparent",
                  color: !isPrivate ? "var(--purple)" : "var(--text2)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                🌐 Public
              </button>
              <button
                className={`btn-toggle ${isPrivate ? "active" : ""}`}
                onClick={() => setIsPrivate(true)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: isPrivate ? "2px solid var(--purple)" : "1px solid var(--border)",
                  background: isPrivate ? "var(--purple-dim)" : "transparent",
                  color: isPrivate ? "var(--purple)" : "var(--text2)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                🔒 Private
              </button>
            </div>
            <div className="form-hint">
              {isPrivate 
                ? "Only invited members can join this group" 
                : "Anyone can discover and join this group"}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input
              placeholder="e.g. Bennett CS Pool 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
            />
            <div className="form-hint">{name.length}/50 characters</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Max Members (2–40)</label>
              <input
                type="number" min={2} max={40}
                value={maxSize}
                onChange={e => setMaxSize(Number(e.target.value))}
              />
              <div className="form-hint">How many people can join</div>
            </div>
            <div className="form-group">
              <label className="form-label">Tenure / Months (1–24)</label>
              <input
                type="number" min={1} max={24}
                value={tenure}
                onChange={e => setTenure(Number(e.target.value))}
              />
              <div className="form-hint">Loan repayment period</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Contribution (ETH) *</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0.01"
              value={ethAmount}
              onChange={e => setEthAmount(e.target.value)}
            />
            <div className="form-hint">
              Each member pays this amount per cycle.
              {ethAmount && ` ≈ ₹${(parseFloat(ethAmount) * 500000).toLocaleString()} INR`}
            </div>
          </div>

          {/* ── PRIVATE GROUP INVITES ─────────────────────────── */}
          {isPrivate && (
            <div className="form-group">
              <label className="form-label">Invite Wallet Addresses *</label>
              <textarea
                placeholder={"Paste wallet addresses (one per line or comma-separated)\n0x742d35Cc6634C0532925a3b844Bc9e7595f...\n0x8ba1f109551bD432803012645Ac136ddd64..."}
                value={inviteAddresses}
                onChange={e => setInviteAddresses(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical"
                }}
              />
              <div className="form-hint">
                ✓ Comma-separated or one per line. Format: 0x...
              </div>
            </div>
          )}

          <div className="warn-box">
            ⚠ Your contribution of <strong>{ethAmount} ETH</strong> will be charged from your wallet
            immediately when you click Create. This is your first cycle payment.
          </div>

          <div className="form-actions">
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={handleCreate}
              disabled={txPending || !name.trim() || !ethAmount || (isPrivate && !inviteAddresses.trim())}
            >
              {txPending ? "Creating..." : "Create Group"}
            </button>
            <button className="btn-secondary" onClick={() => navigate("discovery")}>
              Cancel
            </button>
          </div>
        </div>

        {/* ── Preview ───────────────────────────────────────────── */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <div className="card-title">Group Preview</div>
            </div>

            <div className="group-card" style={{ border: "1px solid var(--purple-mid)", marginBottom: 0 }}>
              <div className="group-card-header">
                <div>
                  <div className="group-card-name">{name || "Your Group Name"}</div>
                  <div className="group-card-id">Proposed by you</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="badge" style={{
                    background: isPrivate ? "rgba(167,139,250,.12)" : "rgba(34,197,94,.10)",
                    color: isPrivate ? "var(--purple)" : "var(--green)",
                    border: isPrivate ? "1px solid rgba(167,139,250,.25)" : "1px solid rgba(34,197,94,.2)"
                  }}>
                    {isPrivate ? "🔒 PRIVATE" : "🌐 PUBLIC"}
                  </div>
                  <div className="badge badge-pending">PENDING</div>
                </div>
              </div>

              <div className="group-meta">
                <div className="group-meta-item">
                  💰 {currency === "INR" ? `₹${inrAmount}` : `${ethAmount} ETH`}/month
                </div>
                <div className="group-meta-item">📅 {tenure} months</div>
                <div className="group-meta-item">👥 1/{maxSize}</div>
              </div>

              <div className="progress-wrap">
                <div className="progress-label">
                  <span>Members</span>
                  <span>{Math.round(1/maxSize*100)}% full</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.round(1/maxSize*100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Summary numbers */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Pool Summary</div>
            {[
              { lbl: "Your contribution now", val: currency === "INR" ? `₹${inrAmount}` : `${ethAmount} ETH` },
              { lbl: "Total pool when full",  val: currency === "INR" ? `₹${totalPool}` : `${(parseFloat(ethAmount||0)*maxSize).toFixed(4)} ETH` },
              { lbl: "Monthly interest (5%)", val: currency === "INR" ? `₹${(parseFloat(ethAmount||0)*maxSize*0.05*500000).toLocaleString()}` : `${(parseFloat(ethAmount||0)*maxSize*0.05).toFixed(4)} ETH` },
              { lbl: "Repayment period",       val: `${tenure} months` },
              { lbl: "Max members",            val: maxSize },
              { lbl: "Group type",             val: isPrivate ? "Private (Invite only)" : "Public (Open)" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(30,58,95,.5)", fontSize: 13 }}>
                <span style={{ color: "var(--text2)" }}>{r.lbl}</span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}