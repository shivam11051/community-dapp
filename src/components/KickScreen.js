import { useState, useEffect } from "react";

export default function KickScreen({
  contract, account, myGroupId, activeGroupId,
  groupCache, txPending, actions, navigate, addNotif
}) {
  const gid = activeGroupId || myGroupId;

  const [group,       setGroup]       = useState(null);
  const [members,     setMembers]     = useState([]);
  const [kicks,       setKicks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [target,      setTarget]      = useState("");
  const [activeKicks, setActiveKicks] = useState({}); // addr => kickId

  useEffect(() => { if (contract && gid) load(); }, [contract, gid]);

  async function load() {
    setLoading(true);
    try {
      const g       = await contract.groups(gid);
      const mems    = await contract.getMembers(gid);
      const kickCnt = Number(g.kickCount);

      setGroup({ ...g, status: Number(g.status), kickCount: kickCnt });
      setMembers(mems);

      // Load all kick requests
      const all = [];
      for (let i = 1; i <= kickCnt; i++) {
        try {
          const k = await contract.kickRequests(gid, i);
          all.push({
            id:       Number(k.id),
            target:   k.target,
            raisedBy: k.raisedBy,
            endTime:  Number(k.endTime),
            yesVotes: Number(k.yesVotes),
            noVotes:  Number(k.noVotes),
            resolved: k.resolved,
            approved: k.approved,
          });
        } catch (e) { /* skip broken */ }
      }
      all.reverse();
      setKicks(all);

      // Track who has active kicks against them
      const activeMap = {};
      for (const addr of mems) {
        try {
          const kid = Number(await contract.activeKick(gid, addr));
          if (kid > 0) activeMap[addr.toLowerCase()] = kid;
        } catch (e) { /* skip */ }
      }
      setActiveKicks(activeMap);
    } catch (err) {
      console.error("KickScreen load:", err);
      addNotif("Failed to load kick data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRaiseKick() {
    if (!target) return addNotif("Select a member to kick", "error");
    if (target.toLowerCase() === account.toLowerCase())
      return addNotif("You cannot raise a kick against yourself", "error");
    await actions.raiseKick(gid, target);
    setShowForm(false);
    setTarget("");
    await load();
  }

  async function handleVoteKick(kid, support) {
    await actions.voteKick(gid, kid, support);
    await load();
  }

  async function handleResolveKick(kid) {
    await actions.resolveKick(gid, kid);
    await load();
  }

  // Renamed to mins/secs to avoid shadowing the outer map callback variable 'm'
  function timeLeft(endTime) {
    const diff = endTime * 1000 - Date.now();
    if (diff <= 0) return "Closed";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  const isMe        = (addr) => addr?.toLowerCase() === account.toLowerCase();
  const memberCount = members.length || 1;
  const majority    = Math.floor(memberCount / 2) + 1;
  const myActiveKid = kicks.find(k => !k.resolved && k.raisedBy.toLowerCase() === account.toLowerCase());

  const openKicks     = kicks.filter(k => !k.resolved);
  const resolvedKicks = kicks.filter(k => k.resolved);

  if (!gid) return (
    <div className="empty-state">
      <div className="empty-icon">⚠️</div>
      <p>Join a group to access kick voting.</p>
    </div>
  );

  if (loading) return (
    <div className="empty-state">
      <div className="empty-icon">⟳</div>
      <p>Loading kick requests...</p>
    </div>
  );

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">⚠️ Member Kick Voting</div>
            <div className="page-sub">
              Group #{gid} · {memberCount} members · Democratic removal process
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={load}>↻ Refresh</button>
            {!showForm && !myActiveKid && openKicks.length === 0 && (
              <button
                className="btn-danger"
                onClick={() => setShowForm(true)}
                disabled={memberCount < 2}
              >
                ⚠ Raise Kick
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Info box ─────────────────────────────────────────────── */}
      <div className="info-box" style={{ marginBottom: 20 }}>
        <strong>How kick voting works:</strong>&nbsp; Any member can raise a kick request against
        another. Members vote YES/NO within the voting window. If a majority votes YES, the member
        is removed and their contribution is redistributed. Only one active kick per group at a time.
      </div>

      {/* ── Raise Kick Form ──────────────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--red)" }}>
          <div className="card-title" style={{ marginBottom: 14, color: "var(--red)" }}>
            ⚠️ Raise Kick Request
          </div>
          <div className="warn-box" style={{ marginBottom: 14 }}>
            This action is irreversible once submitted. A majority vote is needed to remove a member.
            Misuse of this feature may affect your credit score.
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Select member to kick *</label>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--bg3)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 13,
              }}
            >
              <option value="">— Choose a member —</option>
              {members
                .filter(addr => addr.toLowerCase() !== account.toLowerCase())
                .map((addr, idx) => (
                  <option key={idx} value={addr}>
                    {addr.slice(0, 10)}...{addr.slice(-6)}
                    {activeKicks[addr.toLowerCase()] ? " (kick pending)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-actions">
            <button
              className="btn-danger"
              onClick={handleRaiseKick}
              disabled={txPending || !target}
            >
              {txPending ? "Submitting..." : "Submit Kick Request"}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setTarget(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Active Kick against me ────────────────────────────────── */}
      {kicks.some(k => !k.resolved && isMe(k.target)) && (
        <div style={{
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.4)",
          borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20,
        }}>
          <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            🚨 A kick request has been raised against you!
          </div>
          <div style={{ color: "var(--text2)", fontSize: 13 }}>
            Members are currently voting on your removal. If majority votes YES, you will be
            removed from the group and your contribution will be redistributed.
          </div>
        </div>
      )}

      {/* ── Open Kick Requests ────────────────────────────────────── */}
      {openKicks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Active Requests ({openKicks.length})
          </div>
          {openKicks.map(k => {
            const tLeft      = timeLeft(k.endTime);
            const closed     = tLeft === "Closed";
            const allVoted   = k.yesVotes + k.noVotes >= memberCount - 1;
            const canResolve = closed || allVoted;
            const pctYes     = Math.round(k.yesVotes / Math.max(memberCount - 1, 1) * 100);

            return (
              <div key={k.id} className="card" style={{ marginBottom: 14, borderColor: "rgba(239,68,68,.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15, marginBottom: 4 }}>
                      Kick Request #{k.id}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
                      Target:{" "}
                      <span style={{ fontFamily: "monospace", color: isMe(k.target) ? "var(--red)" : "var(--gold)" }}>
                        {k.target.slice(0, 10)}...{k.target.slice(-6)}
                        {isMe(k.target) && " (you)"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>
                      Raised by:{" "}
                      <span style={{ fontFamily: "monospace" }}>
                        {k.raisedBy.slice(0, 8)}...{k.raisedBy.slice(-4)}
                        {isMe(k.raisedBy) && " (you)"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: closed ? "var(--red)" : "var(--gold)" }}>
                      {closed ? "⏰ Closed" : `⏱ ${tLeft}`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>remaining</div>
                  </div>
                </div>

                {/* Vote progress bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--green)" }}>✓ Yes: {k.yesVotes}</span>
                    <span style={{ color: "var(--text3)" }}>Need {majority}</span>
                    <span style={{ color: "var(--red)" }}>✗ No: {k.noVotes}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      background: pctYes >= 50 ? "var(--green)" : "var(--red)",
                      width: `${pctYes}%`,
                      transition: "width .3s",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                    {k.yesVotes + k.noVotes} / {memberCount - 1} votes cast · Need {majority} YES to remove
                  </div>
                </div>

                {/* Vote buttons */}
                {!isMe(k.target) && !isMe(k.raisedBy) && !closed && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-success"
                      style={{ flex: 1 }}
                      onClick={() => handleVoteKick(k.id, true)}
                      disabled={txPending}
                    >
                      ✓ Vote YES — Remove Member
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => handleVoteKick(k.id, false)}
                      disabled={txPending}
                    >
                      ✗ Vote NO — Keep Member
                    </button>
                  </div>
                )}

                {isMe(k.target) && !closed && (
                  <div style={{ fontSize: 13, color: "var(--red)", textAlign: "center", padding: "8px 0" }}>
                    You cannot vote in a kick request against yourself.
                  </div>
                )}

                {canResolve && (
                  <button
                    className="btn-primary"
                    style={{ width: "100%", marginTop: 8 }}
                    onClick={() => handleResolveKick(k.id)}
                    disabled={txPending}
                  >
                    ⚖️ Resolve Kick Vote
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Members Overview ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>
          👥 Members ({memberCount}/{Number(group?.maxSize || 0)})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((addr, idx) => {
            const hasActiveKick = !!activeKicks[addr.toLowerCase()];
            const isSelf = isMe(addr);
            return (
              <div key={idx} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--bg3)", borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                border: hasActiveKick ? "1px solid rgba(239,68,68,.4)" : "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isSelf ? "var(--purple-dim)" : "var(--bg2)",
                    border: `1px solid ${isSelf ? "var(--purple-mid)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600,
                    color: isSelf ? "var(--purple)" : "var(--text3)",
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: isSelf ? "var(--purple)" : "var(--text)" }}>
                    {addr.slice(0, 10)}...{addr.slice(-6)}
                    {isSelf && " (you)"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {hasActiveKick && (
                    <span className="badge badge-pending" style={{ fontSize: 10 }}>Kick Pending</span>
                  )}
                  {!isSelf && !hasActiveKick && openKicks.length === 0 && (
                    <button
                      style={{
                        background: "var(--red-dim)", color: "var(--red)",
                        border: "1px solid rgba(239,68,68,.3)",
                        borderRadius: "var(--radius-sm)",
                        padding: "3px 10px", fontSize: 11, cursor: "pointer",
                      }}
                      onClick={() => { setTarget(addr); setShowForm(true); }}
                      disabled={txPending}
                    >
                      Raise Kick
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resolved Kick History ────────────────────────────────── */}
      {resolvedKicks.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Resolved ({resolvedKicks.length})
          </div>
          {resolvedKicks.map(k => (
            <div key={k.id} className="card" style={{
              marginBottom: 10,
              borderColor: k.approved ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.3)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    Kick #{k.id}{" "}
                    <span style={{ color: k.approved ? "var(--red)" : "var(--green)", fontSize: 12 }}>
                      {k.approved ? "— Member Removed ✓" : "— Member Kept ✓"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "monospace" }}>
                    Target: {k.target.slice(0, 10)}...{k.target.slice(-6)}
                    {isMe(k.target) && " (you)"}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--text3)" }}>
                  <div>YES: {k.yesVotes}</div>
                  <div>NO: {k.noVotes}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {kicks.length === 0 && !showForm && (
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <p>No kick requests. All members are in good standing!</p>
        </div>
      )}
    </div>
  );
}