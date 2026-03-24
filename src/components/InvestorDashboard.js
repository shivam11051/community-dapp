/**
 * InvestorDashboard.js — Public investor view (no wallet needed)
 *
 * Shows all ACTIVE groups with health score, ROI, fill %, average credit.
 * Calls the backend /api/investor/opportunities API.
 * All data is read-only and publicly accessible.
 */

import { useState, useEffect } from "react";
import { formatEther } from "ethers";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

export default function InvestorDashboard({ contract, account, currency }) {
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [sortBy,   setSortBy]   = useState("score");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    setLoading(true);
    setError(null);
    try {
      // Try backend first (has cached score + ROI data)
      const res = await fetch(`${BACKEND}/api/investor/opportunities`).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        setGroups(json.data || []);
        return;
      }

      // Fallback: read directly from contract
      if (!contract) {
        setError("No backend or contract available.");
        return;
      }

      const count = Number(await contract.groupCount());
      const all = [];

      for (let i = 1; i <= count; i++) {
        try {
          const g       = await contract.groups(i);
          const members = await contract.getMembers(i);
          const status  = Number(g.status);

          // Only show ACTIVE (2) and OPEN (1) groups for investment view
          if (status < 1 || status > 2) continue;

          let health = { fillPercentage: 0, averageCreditScore: 100, onTimeMemberCount: 0, defaultedMemberCount: 0 };
          let roi    = { roiPercentage: 0, defaultRate: 0 };
          let metrics = { completedLoans: 0, activeLoan: false };

          try {
            const [fp, ac, ot, dc] = await contract.getGroupHealth(i);
            health = {
              fillPercentage:       Number(fp),
              averageCreditScore:   Number(ac),
              onTimeMemberCount:    Number(ot),
              defaultedMemberCount: Number(dc),
            };
          } catch (e) { /* eslint-disable-next-line no-empty */ } // getGroupHealth optional

          try {
            const [, , rp, dr] = await contract.getGroupROI(i);
            roi = { roiPercentage: Number(rp), defaultRate: Number(dr) };
          } catch (e) { /* eslint-disable-next-line no-empty */ } // getGroupROI optional

          try {
            const [, al, , cl] = await contract.getGroupMetrics(i);
            metrics = { activeLoan: al, completedLoans: Number(cl) };
          } catch (e) { /* eslint-disable-next-line no-empty */ } // getGroupMetrics optional

          // Simple investment score (0–100)
          const score = Math.max(0, Math.min(100, Math.round(
            (health.averageCreditScore / 2) * 0.4 +
            health.fillPercentage           * 0.2 +
            Math.min(roi.roiPercentage, 100) * 0.2 -
            roi.defaultRate                  * 0.2
          )));

          all.push({
            id:            Number(g.id),
            name:          g.name,
            creator:       g.creator,
            status,
            contribution:  g.contribution.toString(),
            maxSize:       Number(g.maxSize),
            tenure:        Number(g.tenure),
            totalPool:     g.totalPool.toString(),
            memberCount:   members.length,
            isPrivate:     g.isPrivate,
            health,
            roi,
            metrics,
            investmentScore: score,
          });
        } catch (e) { /* eslint-disable-next-line no-empty */ } // skip broken groups
      }

      setGroups(all);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fmt(weiStr) {
    try {
      const eth = parseFloat(formatEther(weiStr || "0"));
      if (currency === "INR") return `₹${(eth * 500000).toLocaleString()}`;
      return `${eth.toFixed(4)} ETH`;
    } catch {
      return "—";
    }
  }

  function scoreColor(s) {
    if (s >= 75) return "var(--green)";
    if (s >= 50) return "var(--purple)";
    if (s >= 30) return "var(--amber)";
    return "var(--red)";
  }

  function scoreLabel(s) {
    if (s >= 75) return "Excellent";
    if (s >= 50) return "Good";
    if (s >= 30) return "Fair";
    return "Risky";
  }

  const STATUS_LABEL = ["PENDING", "OPEN", "ACTIVE", "CLOSED"];

  const filtered = groups
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "score")   return b.investmentScore - a.investmentScore;
      if (sortBy === "roi")     return b.roi.roiPercentage - a.roi.roiPercentage;
      if (sortBy === "credit")  return b.health.averageCreditScore - a.health.averageCreditScore;
      if (sortBy === "pool")    return Number(b.totalPool) - Number(a.totalPool);
      return 0;
    });

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">📊 Investor Dashboard</div>
            <div className="page-sub">
              {filtered.length} investment opportunities — ranked by trust score
            </div>
          </div>
          <button className="btn-secondary" onClick={loadOpportunities}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Info Banner ─────────────────────────────────────────── */}
      <div style={{
        background: "rgba(167,139,250,.08)", border: "1px solid var(--purple-mid)",
        borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 20,
        fontSize: 13, color: "var(--text2)", lineHeight: 1.6,
      }}>
        🔒 All data is <strong style={{ color: "var(--text)" }}>read-only and on-chain verifiable</strong>.
        Investment scores are calculated from on-time payment rates, credit scores, and pool ROI.
        {!account && " No wallet connection required to view."}
      </div>

      {/* ── Search + Sort ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Search groups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 180 }}>
          <option value="score">Highest Trust Score</option>
          <option value="roi">Highest ROI</option>
          <option value="credit">Best Credit</option>
          <option value="pool">Largest Pool</option>
        </select>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⟳</div>
          <p>Loading investment opportunities...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p style={{ color: "var(--red)" }}>{error}</p>
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={loadOpportunities}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No investment opportunities found{search ? ` matching "${search}"` : ""}.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((g, idx) => (
            <div
              key={g.id}
              className="card"
              style={{
                borderLeft: `4px solid ${scoreColor(g.investmentScore)}`,
                position: "relative",
              }}
            >
              {/* Rank badge */}
              <div style={{
                position: "absolute", top: 14, right: 14,
                background: scoreColor(g.investmentScore),
                color: "white", borderRadius: "99px",
                padding: "2px 10px", fontSize: 11, fontWeight: 700,
              }}>
                #{idx + 1} · Score {g.investmentScore}/100
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {/* Score ring */}
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                  border: `3px solid ${scoreColor(g.investmentScore)}`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor(g.investmentScore) }}>
                    {g.investmentScore}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase" }}>
                    {scoreLabel(g.investmentScore)}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{g.name}</div>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 99,
                      background: g.status === 2 ? "rgba(34,197,94,.12)" : "rgba(167,139,250,.12)",
                      color: g.status === 2 ? "var(--green)" : "var(--purple)",
                      border: `1px solid ${g.status === 2 ? "rgba(34,197,94,.3)" : "var(--purple-mid)"}`,
                      fontWeight: 600,
                    }}>
                      {STATUS_LABEL[g.status]}
                    </span>
                    {g.isPrivate && (
                      <span style={{ fontSize: 10, color: "#A855F7", fontWeight: 600 }}>🔒 PRIVATE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
                    Group #{g.id} · by {g.creator.slice(0, 8)}...{g.creator.slice(-4)}
                  </div>

                  {/* Metrics grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {[
                      { lbl: "Pool",         val: fmt(g.totalPool),                         color: "var(--gold)" },
                      { lbl: "EMI/Month",    val: fmt(g.contribution),                      color: "" },
                      { lbl: "Fill",         val: `${g.health.fillPercentage}%`,             color: g.health.fillPercentage >= 80 ? "var(--green)" : "var(--amber)" },
                      { lbl: "Avg Credit",   val: g.health.averageCreditScore,               color: g.health.averageCreditScore >= 100 ? "var(--green)" : "var(--amber)" },
                      { lbl: "Completed",    val: `${g.metrics.completedLoans} loans`,       color: "var(--purple)" },
                    ].map((m, i) => (
                      <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{m.lbl}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: m.color || "var(--text)", marginTop: 2 }}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* On-time / defaults bar */}
                  {(g.health.onTimeMemberCount > 0 || g.health.defaultedMemberCount > 0) && (
                    <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 11 }}>
                      <span style={{ color: "var(--green)" }}>
                        ✓ {g.health.onTimeMemberCount} on-time payers
                      </span>
                      {g.health.defaultedMemberCount > 0 && (
                        <span style={{ color: "var(--red)" }}>
                          ✗ {g.health.defaultedMemberCount} defaulted
                        </span>
                      )}
                      {g.metrics.activeLoan && (
                        <span style={{ color: "var(--cyan)" }}>⚡ Loan active</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div style={{ marginTop: 32, padding: "16px 20px", background: "var(--bg2)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text3)", lineHeight: 1.7 }}>
        ⚠️ <strong>Disclaimer:</strong> Investment scores are algorithmic and based on historical on-chain data.
        Past performance does not guarantee future results. All chit fund investments carry risk.
        This is not financial advice.
      </div>
    </div>
  );
}
