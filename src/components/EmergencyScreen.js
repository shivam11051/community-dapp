import { useState, useEffect } from "react";
import { formatEther, parseEther } from "ethers";

export default function EmergencyScreen({
  contract, account, myGroupId, activeGroupId,
  groupCache, txPending, actions, views, navigate, addNotif
}) {
  const gid = activeGroupId || myGroupId;

  const [group,        setGroup]        = useState(null);
  const [requests,     setRequests]     = useState([]);
  const [activeReqId,  setActiveReqId]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [amount,       setAmount]       = useState("");
  const [reason,       setReason]       = useState("");
  const [myActiveReq,  setMyActiveReq]  = useState(0);

  useEffect(() => { if (contract && gid) load(); }, [contract, gid]);

  async function load() {
    setLoading(true);
    try {
      const g       = await contract.groups(gid);
      const members = await contract.getMembers(gid);
      setGroup({ ...g, members, status: Number(g.status), emergencyCount: Number(g.emergencyCount) });

      const myActive = await contract.activeEmergencyGroup(account);
      setMyActiveReq(Number(myActive));

      const allReqs = [];
      for (let i = 1; i <= Number(g.emergencyCount); i++) {
        const r = await contract.emergencyRequests(gid, i);
        const hasV = await contract.emergencyVoted(gid, i, account);
        allReqs.push({
          id:        Number(r.id),
          requester: r.requester,
          amount:    r.amount,
          reason:    r.reason,
          endTime:   Number(r.endTime),
          yesVotes:  Number(r.yesVotes),
          noVotes:   Number(r.noVotes),
          resolved:  r.resolved,
          approved:  r.approved,
          repaid:    r.repaid,
          repayBy:   Number(r.repayBy),
          hasVoted:  hasV,
        });
      }
      setRequests(allReqs.reverse());
    } catch (err) {
      console.error("EmergencyScreen load:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRaise() {
    if (!amount || parseFloat(amount) <= 0) return addNotif("Enter a valid amount", "error");
    if (!reason.trim()) return addNotif("Reason is required", "error");
    await actions.raiseEmergency(gid, amount, reason);
    setShowForm(false);
    setAmount(""); setReason("");
    await load();
  }

  async function handleVote(rid, support) {
    await actions.voteEmergency(gid, rid, support);
    await load();
  }

  async function handleResolve(rid) {
    await actions.resolveEmergency(gid, rid);
    await load();
  }

  async function handleRepay(rid, amount) {
    const interest = parseFloat(formatEther(amount)) * 0.03;
    const total    = (parseFloat(formatEther(amount)) + interest).toFixed(6);
    await actions.repayEmergency(gid, rid, total);
    await load();
  }

  function timeLeft(endTime) {
    const diff = endTime * 1000 - Date.now();
    if (diff <= 0) return "Closed";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s left`;
  }

  function fmt(raw) {
    return formatEther(raw);
  }

  const isMe = (addr) => addr?.toLowerCase() === account.toLowerCase();
  const memberCount = group?.members?.length || 1;
  const majority    = Math.floor(memberCount / 2) + 1;

  if (loading) return <div className="empty-state"><div className="empty-icon">⟳</div><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">🚨 Emergency Funding</div>
            <div className="page-sub">Request urgent funds — group votes to approve or reject</div>
          </div>
          {!showForm && myActiveReq === 0 && (
            <button className="btn-danger" onClick={() => setShowForm(true)}>
              + Raise Emergency
            </button>
          )}
        </div>
      </div>

      {/* ── Raise Form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--red)" }}>
          <div className="card-title" style={{ marginBottom: 14, color: "var(--red)" }}>🚨 New Emergency Request</div>
          <div className="warn-box">
            Maximum allowed: 50% of current pool balance. Members will vote yes/no within 5 minutes.
            If approved, funds are sent immediately. Repay with 3% interest within the loan tenure.
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount needed (ETH) *</label>
              <input
                type="number" step="0.001" min="0.001"
                placeholder="e.g. 0.005"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <input
                placeholder="Medical emergency, urgent bill..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-danger" onClick={handleRaise} disabled={txPending || !amount || !reason}>
              {txPending ? "Submitting..." : "Submit Emergency Request"}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Active Emergency notice ────────────────────────────── */}
      {myActiveReq > 0 && (
        <div className="warn-box" style={{ marginBottom: 16 }}>
          You have an active emergency request (ID #{myActiveReq}). Repay it before raising a new one.
        </div>
      )}

      {/* ── Requests list ──────────────────────────────────────── */}
      {requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🟢</div>
          <p>No emergency requests. Everyone is doing well!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {requests.map(r => (
            <div key={r.id} className="card" style={{
              borderColor: r.resolved
                ? (r.approved ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.3)")
                : "var(--amber)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15, marginBottom: 4 }}>
                    Emergency #{r.id} — {fmt(r.amount)} ETH
                    {" "}<span style={{ fontSize: 12, color: "var(--text2)" }}>≈ ₹{(parseFloat(fmt(r.amount))*500000).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
                    &quot;{r.reason}&quot;
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    By: {r.requester.slice(0,8)}...{r.requester.slice(-4)}
                    {isMe(r.requester) && " (you)"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {!r.resolved && (
                    <div style={{ fontSize: 13, color: "var(--amber)", marginBottom: 4 }}>{timeLeft(r.endTime)}</div>
                  )}
                  {r.resolved && (
                    <span className={`badge ${r.approved ? "badge-active" : "badge-closed"}`}>
                      {r.approved ? "APPROVED" : "REJECTED"}
                    </span>
                  )}
                  {r.approved && !r.repaid && (
                    <div><span className="badge badge-pending" style={{ marginTop: 4 }}>REPAYMENT DUE</span></div>
                  )}
                  {r.repaid && (
                    <div><span className="badge badge-paid" style={{ marginTop: 4 }}>REPAID</span></div>
                  )}
                </div>
              </div>

              {/* Vote progress */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                  <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--green)", borderRadius: 4, width: `${Math.round(r.yesVotes/Math.max(memberCount,1)*100)}%` }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)" }}>
                  <span style={{ color: "var(--green)" }}>✓ Yes: {r.yesVotes}</span>
                  <span style={{ color: "var(--text3)" }}>Need {majority} to approve</span>
                  <span style={{ color: "var(--red)" }}>✗ No: {r.noVotes}</span>
                </div>
              </div>

              {/* Actions */}
              {!r.resolved && !isMe(r.requester) && !r.hasVoted && Date.now() / 1000 <= r.endTime && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-success" style={{ flex: 1 }} onClick={() => handleVote(r.id, true)} disabled={txPending}>
                    ✓ Vote YES
                  </button>
                  <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleVote(r.id, false)} disabled={txPending}>
                    ✗ Vote NO
                  </button>
                </div>
              )}

              {!r.resolved && r.hasVoted && (
                <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>You have voted on this request.</div>
              )}

              {!r.resolved && Date.now() / 1000 > r.endTime && (
                <button className="btn-primary" style={{ width: "100%" }} onClick={() => handleResolve(r.id)} disabled={txPending}>
                  Resolve Vote
                </button>
              )}

              {r.approved && !r.repaid && isMe(r.requester) && (
                <button
                  className="btn-gold"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() => handleRepay(r.id, r.amount)}
                  disabled={txPending}
                >
                  Repay {(parseFloat(fmt(r.amount)) * 1.03).toFixed(6)} ETH (+3% interest)
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}