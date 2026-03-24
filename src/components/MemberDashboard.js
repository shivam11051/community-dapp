import { useState, useEffect } from "react";
import { formatEther } from "ethers";

export default function MemberDashboard({
  contract, account, currency, myGroupId, activeGroupId,
  groupCache, txPending, actions, views, navigate, refreshGroup, addNotif
}) {
  const gid = activeGroupId || myGroupId;

  const [group,          setGroup]          = useState(null);
  const [memberInfo,     setMemberInfo]     = useState(null);
  const [profit,         setProfit]         = useState("0");
  const [emi,            setEmi]            = useState("0");
  const [lateFee,        setLateFee]        = useState("0");
  const [nextDue,        setNextDue]        = useState(0);
  const [remaining,      setRemaining]      = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [withdrawAmt,    setWithdrawAmt]    = useState("");
  const [inviteInput,    setInviteInput]    = useState("");
  const [inviteList,     setInviteList]     = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [countdown,      setCountdown]      = useState({ d:0, h:0, m:0, s:0 });

  useEffect(() => {
    if (contract && gid) {
      refreshGroup(gid); // force fresh cache before loading
      load();
    }
  }, [contract, gid]);

  // Countdown tick
  useEffect(() => {
    if (!nextDue) return;
    const interval = setInterval(() => {
      const diff = nextDue * 1000 - Date.now();
      if (diff <= 0) { setCountdown({ d:0, h:0, m:0, s:0 }); return; }
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000)  / 60000),
        s: Math.floor((diff % 60000)    / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [nextDue]);

  async function load() {
    setLoading(true);
    try {
      // Always fetch fresh data — cache may be stale after members join/leave
      const g = await loadGroupRaw();
      setGroup(g);

      const [score, missed, onTime, late] = await contract.getMemberInfo(gid, account);
      setMemberInfo({ score: Number(score), missed: Number(missed), onTime: Number(onTime), late: Number(late) });

      const profitRaw = await contract.getProfitBalance(gid, account);
      setProfit(formatEther(profitRaw));

      if (g.status === 2 && g.borrower !== "0x0000000000000000000000000000000000000000") {
        const emiRaw  = await contract.getEMI(gid);
        const lateRaw = await contract.getLateFee(gid);
        const due     = await contract.getNextDueTime(gid);
        const rem     = await contract.getRemainingMonths(gid);
        setEmi(formatEther(emiRaw));
        setLateFee(formatEther(lateRaw));
        setNextDue(Number(due));
        setRemaining(Number(rem));
      }

      // Load invite list if creator of private group
      if (g?.isPrivate && g?.creator?.toLowerCase() === account.toLowerCase()) {
        try {
          const invited = await contract.getInvitedList(gid);
          setInviteList(Array.from(invited));
        } catch (e) {
          console.error("Failed to load invite list:", e);
          setInviteList([]);
        }
      }
    } catch (err) {
      console.error("MemberDashboard load:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupRaw() {
    const g       = await contract.groups(gid);
    const members = await contract.getMembers(gid);

    // Fetch totalPool directly — getPoolBalance() is a clean single-uint call
    let totalPool = 0n;
    try { totalPool = await contract.getPoolBalance(gid); } catch (e) { /* skip */ }

    // Fetch profitPool with fallback
    let profitPool = 0n;
    try { profitPool = g.profitPool; } catch (e) { /* skip */ }

    console.log(`[Dashboard] gid=${gid} totalPool=${totalPool} status=${Number(g.status)} members=${members.length}`);

    return {
      id:           Number(g.id),
      name:         g.name,
      creator:      g.creator,
      status:       Number(g.status),
      contribution: g.contribution,
      maxSize:      Number(g.maxSize),
      tenure:       Number(g.tenure),
      borrower:     g.borrower,
      members,
      memberCount:  members.length,
      totalPool,
      profitPool,
      isPrivate:    g.isPrivate || false,
    };
  }

  function fmt(raw) {
    try {
      let eth;
      if (raw === null || raw === undefined) return currency === "INR" ? "₹0" : "0.0000 ETH";
      if (typeof raw === "string")       eth = parseFloat(raw);
      else if (typeof raw === "number")  eth = raw;
      else eth = parseFloat(formatEther(raw)); // BigInt from contract
      if (isNaN(eth)) return currency === "INR" ? "₹0" : "0.0000 ETH";
      if (currency === "INR") return `₹${(eth * 500000).toLocaleString()}`;
      return `${eth.toFixed(4)} ETH`;
    } catch (e) {
      return currency === "INR" ? "₹0" : "0.0000 ETH";
    }
  }

  function creditColor(score) {
    if (score >= 150) return "var(--green)";
    if (score >= 100) return "var(--purple)";
    if (score >= 60)  return "var(--amber)";
    return "var(--red)";
  }

  function creditLabel(score) {
    if (score >= 150) return "Excellent";
    if (score >= 100) return "Good";
    if (score >= 60)  return "Fair";
    return "Poor";
  }

  function creditClass(score) {
    if (score >= 150) return "credit-excellent";
    if (score >= 100) return "credit-good";
    if (score >= 60)  return "credit-fair";
    return "credit-poor";
  }

  const isUrgent    = countdown.d === 0 && countdown.h < 24;
  const isCreator   = group?.creator?.toLowerCase() === account.toLowerCase();
  const isPrivGroup = group?.isPrivate;
  const isBorrower  = group?.borrower?.toLowerCase() === account.toLowerCase();
  const statusLabel = ["PENDING", "OPEN", "ACTIVE", "CLOSED"];

  async function handleInvite() {
    const addr = inviteInput.trim();
    if (!addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      addNotif("Invalid Ethereum address", "error");
      return;
    }
    const ok = await actions.inviteMember(gid, addr);
    if (ok) {
      setInviteList(prev => [...prev, addr]);
      setInviteInput("");
    }
  }

  async function handleRevoke(addr) {
    const ok = await actions.revokeInvite(gid, addr);
    if (ok) setInviteList(prev => prev.filter(a => a !== addr));
  }

  // ── Not in group ──────────────────────────────────────────────
  if (!gid) {
    return (
      <div>
        <div className="page-header"><div className="page-title">My Dashboard</div></div>
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>You are not in any group yet.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("discovery")}>
            Browse Groups
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="empty-state"><div className="empty-icon">⟳</div><p>Loading your dashboard...</p></div>
  );

  // ── Pending approval screen ───────────────────────────────────
  if (group?.status === 0) return (
    <div>
      <div className="page-header">
        <div className="page-title">{group?.name || `Group #${gid}`}</div>
        <div className="page-sub">Group #{gid} · Waiting for admin approval</div>
      </div>
      <div style={{
        background: "rgba(255,179,71,.06)", border: "1px solid rgba(255,179,71,.2)",
        borderRadius: "var(--radius)", padding: "40px 32px", textAlign: "center", maxWidth: 480,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", color: "var(--gold)", fontSize: 20, marginBottom: 10, fontWeight: 700 }}>
          Pending Admin Approval
        </h2>
        <p style={{ color: "var(--text2)", lineHeight: 1.7, marginBottom: 20 }}>
          Your group <strong style={{ color: "var(--text)" }}>&ldquo;{group?.name}&rdquo;</strong> has been submitted
          and is waiting for admin review. You&apos;ll be notified once it&apos;s approved and open for others to join.
        </p>
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px", textAlign: "left", marginBottom: 20 }}>
          {[
            { lbl: "Contribution", val: `${formatEther(group?.contribution || "0")} ETH` },
            { lbl: "Max Members",  val: group?.maxSize },
            { lbl: "Tenure",       val: `${group?.tenure} months` },
            { lbl: "Type",         val: group?.isPrivate ? "Private (Invite only)" : "Public" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--text2)" }}>{r.lbl}</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{r.val}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text3)" }}>
          If you are the admin, go to the <strong style={{ color: "var(--gold)" }}>Admin Dashboard</strong> to approve this group.
        </p>
      </div>
    </div>
  );

  // ── Main dashboard ────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">{group?.name || `Group #${gid}`}</div>
            <div className="page-sub">
              Group #{gid} · {statusLabel[group?.status || 0]} · {group?.memberCount}/{group?.maxSize} members
            </div>
          </div>
          <button className="btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-lbl">My Contribution</div>
          <div className="stat-val">{fmt(group?.contribution ?? 0n)}</div>
          <div className="stat-sub">per cycle</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-lbl">Pool Balance</div>
          <div className="stat-val">{fmt(group?.totalPool ?? 0n)}</div>
          <div className="stat-sub">{group?.memberCount}/{group?.maxSize} members</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-lbl">My Profit</div>
          <div className="stat-val">{fmt(profit)}</div>
          <div className="stat-sub">available to withdraw</div>
        </div>
        <div className="stat-card" style={{ borderColor: creditColor(memberInfo?.score || 100) }}>
          <div className="stat-lbl">Credit Score</div>
          <div className="stat-val" style={{ color: creditColor(memberInfo?.score || 100) }}>
            {memberInfo?.score || 100}
          </div>
          <div className="stat-sub">{creditLabel(memberInfo?.score || 100)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* ── Credit Score Card ──────────────────────────────────── */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Credit Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: creditColor(memberInfo?.score || 100) }}>
              {memberInfo?.score || 100}
            </span>
            <span style={{ fontSize: 14, color: creditColor(memberInfo?.score || 100) }}>
              {creditLabel(memberInfo?.score || 100)}
            </span>
          </div>
          <div className="credit-bar-wrap">
            <div className="credit-bar-bg">
              <div
                className={`credit-bar-fill ${creditClass(memberInfo?.score || 100)}`}
                style={{ width: `${Math.min((memberInfo?.score || 100) / 200 * 100, 100)}%` }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { lbl: "On Time", val: memberInfo?.onTime || 0, color: "var(--green)" },
              { lbl: "Late",    val: memberInfo?.late   || 0, color: "var(--amber)" },
              { lbl: "Missed",  val: memberInfo?.missed || 0, color: "var(--red)"   },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Members ───────────────────────────────────────────── */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Members ({group?.memberCount}/{group?.maxSize})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group?.members?.slice(0, 5).map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--purple-dim)", border: "1px solid var(--purple-mid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "var(--purple)", fontWeight: 600, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: m.toLowerCase() === account.toLowerCase() ? "var(--cyan)" : "var(--text2)" }}>
                  {m.slice(0, 8)}...{m.slice(-4)}
                  {m.toLowerCase() === account.toLowerCase() && " (you)"}
                </span>
                {group?.borrower?.toLowerCase() === m.toLowerCase() && (
                  <span className="badge badge-borrower" style={{ fontSize: 10, padding: "2px 6px" }}>Borrower</span>
                )}
              </div>
            ))}
            {(group?.members?.length || 0) > 5 && (
              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                +{group.members.length - 5} more members
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EMI Countdown (active loan, borrower only) ──────────── */}
      {isBorrower && group?.status === 2 && nextDue > 0 && (
        <div className={`emi-countdown ${isUrgent ? "urgent" : ""}`} style={{ marginBottom: 16 }}>
          <div className={`countdown-label ${isUrgent ? "urgent" : ""}`}>
            {isUrgent ? "⚠ EMI DUE VERY SOON" : "⏰ Next EMI Due"}
          </div>
          <div className="countdown-timer">
            {[
              { val: countdown.d, lbl: "days" },
              { val: countdown.h, lbl: "hrs"  },
              { val: countdown.m, lbl: "min"  },
              { val: countdown.s, lbl: "sec"  },
            ].map((u, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div className="countdown-unit">
                  <div className="countdown-num">{String(u.val).padStart(2, "0")}</div>
                  <div className="countdown-unit-label">{u.lbl}</div>
                </div>
                {i < arr.length - 1 && <div className="countdown-sep">:</div>}
              </div>
            ))}
          </div>
          <div className="emi-amount-row">
            <div>
              <div className="emi-amount">
                {fmt(emi)}{" "}
                {parseFloat(lateFee) > 0 && (
                  <span style={{ color: "var(--red)", fontSize: 14 }}>+{fmt(lateFee)} late fee</span>
                )}
              </div>
              <div className="emi-sub">{remaining} months remaining</div>
            </div>
            <button className="btn-primary" onClick={() => navigate("emi", gid)} disabled={txPending}>
              Pay EMI →
            </button>
          </div>
        </div>
      )}

      {/* ── Profit Withdrawal ────────────────────────────────────── */}
      {parseFloat(profit) > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>💰 Withdraw Profit</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Partial amount (ETH)</label>
              <input
                type="number" step="0.001"
                placeholder={`Max: ${profit}`}
                value={withdrawAmt}
                onChange={e => setWithdrawAmt(e.target.value)}
              />
            </div>
            <button className="btn-gold" onClick={() => actions.withdrawPartialProfit(gid, withdrawAmt)} disabled={txPending || !withdrawAmt}>
              Withdraw Partial
            </button>
            <button className="btn-primary" onClick={() => actions.withdrawAllProfit(gid)} disabled={txPending}>
              Withdraw All ({fmt(profit)})
            </button>
          </div>
        </div>
      )}

      {/* ── Invite Management (private group creator only) ──────── */}
      {isPrivGroup && isCreator && group?.status <= 1 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "rgba(168,85,247,.4)" }}>
          <div className="card-title" style={{ marginBottom: 14, color: "#A855F7" }}>🔒 Manage Invites</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>
            Only wallets you invite can join this private group. Add or remove invites below.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              placeholder="0x... wallet address to invite"
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
            />
            <button
              className="btn-primary"
              style={{ background: "#A855F7", whiteSpace: "nowrap" }}
              onClick={handleInvite}
              disabled={txPending || !inviteInput.trim()}
            >
              + Invite
            </button>
          </div>

          {inviteList.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                Invited ({inviteList.length})
              </div>
              {inviteList.map((addr, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--bg3)", borderRadius: "var(--radius-sm)",
                  padding: "8px 12px", border: "1px solid var(--border)",
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text)" }}>
                    {addr.slice(0, 10)}...{addr.slice(-6)}
                  </span>
                  <button
                    onClick={() => handleRevoke(addr)}
                    disabled={txPending}
                    style={{
                      background: "var(--red-dim)", color: "var(--red)",
                      border: "1px solid rgba(239,68,68,.3)", borderRadius: "var(--radius-sm)",
                      padding: "3px 10px", fontSize: 11, cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>
              No pending invites. Add wallet addresses above.
            </div>
          )}
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => navigate("voting",    gid)}>🗳️ Vote</button>
          <button className="btn-secondary" onClick={() => navigate("emergency", gid)}>🚨 Emergency</button>
          <button className="btn-secondary" onClick={() => navigate("kick",      gid)}>⚠️ Kick</button>
          <button className="btn-secondary" onClick={() => navigate("emi",       gid)}>📋 EMI</button>
          <button className="btn-secondary" onClick={() => navigate("history",   gid)}>📜 History</button>
          {group?.status === 1 && group?.members?.length === group?.maxSize && (
            <button className="btn-primary" onClick={() => navigate("voting", gid)}>
              🗳️ Start Voting
            </button>
          )}
          {group?.status === 2 && group?.borrower === "0x0000000000000000000000000000000000000000" && (
            <button className="btn-primary" onClick={() => actions.releaseFunds(gid)} disabled={txPending}>
              💸 Release Funds
            </button>
          )}
          {/* Leave group: only OPEN groups, non-creator */}
          {group?.status === 1 && !isCreator && (
            <button
              style={{
                background: "var(--red-dim)", color: "var(--red)",
                border: "1px solid rgba(239,68,68,.3)", borderRadius: "var(--radius-sm)",
                padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
              onClick={async () => {
                if (window.confirm("Are you sure you want to leave? Your contribution will be refunded.")) {
                  await actions.leaveGroup(gid);
                }
              }}
              disabled={txPending}
            >
              🚪 Leave Group
            </button>
          )}
        </div>

        {/* Multi-round hint: loan repaid, new round starting */}
        {group?.status === 2 && !group?.loan?.active && group?.borrower === "0x0000000000000000000000000000000000000000" && group?.completedLoans > 0 && (
          <div style={{
            marginTop: 14, padding: "12px 16px",
            background: "rgba(167,139,250,.08)", border: "1px solid var(--purple-mid)",
            borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--purple)",
          }}>
            🔄 Round {group.completedLoans} complete! Start voting to select the next borrower.
          </div>
        )}
      </div>
    </div>
  );
}