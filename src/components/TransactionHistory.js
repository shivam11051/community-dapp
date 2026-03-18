import { useState, useEffect } from "react";
import { formatEther } from "ethers";

const EVENT_CONFIG = {
  GroupCreated:       { label: "Group Created",      color: "var(--cyan)",   icon: "🏦", amountField: null      },
  GroupApproved:      { label: "Group Approved",     color: "var(--green)",  icon: "✅", amountField: null      },
  MemberJoined:       { label: "Member Joined",      color: "var(--cyan)",   icon: "👤", amountField: null      },
  VotingStarted:      { label: "Voting Started",     color: "var(--purple)", icon: "🗳️", amountField: null      },
  BorrowerSelected:   { label: "Borrower Selected",  color: "var(--gold)",   icon: "🏆", amountField: null      },
  LoanReleased:       { label: "Loan Released",      color: "var(--green)",  icon: "💸", amountField: "amount", dir: "in"  },
  EMIPaid:            { label: "EMI Paid",           color: "var(--amber)",  icon: "📋", amountField: "amount", dir: "out" },
  ProfitWithdrawn:    { label: "Profit Withdrawn",   color: "var(--green)",  icon: "💰", amountField: "amount", dir: "in"  },
  EmergencyRequested: { label: "Emergency Raised",   color: "var(--red)",    icon: "🚨", amountField: "amount"  },
  EmergencyResolved:  { label: "Emergency Resolved", color: "var(--amber)",  icon: "⚖️", amountField: null      },
  EmergencyReleased:  { label: "Emergency Funds",    color: "var(--green)",  icon: "🆘", amountField: "amount", dir: "in"  },
  EmergencyRepaid:    { label: "Emergency Repaid",   color: "var(--cyan)",   icon: "↩️", amountField: "amount", dir: "out" },
  KickRaised:         { label: "Kick Raised",        color: "var(--red)",    icon: "⚠️", amountField: null      },
  KickResolved:       { label: "Kick Resolved",      color: "var(--amber)",  icon: "⚖️", amountField: null      },
  CreditUpdated:      { label: "Credit Updated",     color: "var(--purple)", icon: "⭐", amountField: null      },
};

export default function TransactionHistory({
  contract, account, myGroupId, activeGroupId,
  currency, navigate
}) {
  const gid = activeGroupId || myGroupId;

  const [txs,      setTxs]      = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [addrFilter, setAddrFilter] = useState("");

  useEffect(() => { if (contract && gid) load(); }, [contract, gid]);
  useEffect(() => { applyFilter(); }, [txs, filter, addrFilter]);

  async function load() {
    setLoading(true);
    try {
      const all = [];

      const eventNames = Object.keys(EVENT_CONFIG);
      for (const name of eventNames) {
        try {
          const events = await contract.queryFilter(name);
          for (const e of events) {
            const args = e.args;
            // Only include events for this group
            if (args[0] !== undefined && Number(args[0]) !== gid) continue;

            const cfg = EVENT_CONFIG[name];
            let amount = null;
            if (cfg.amountField === "amount") {
              // Find amount in args — different position per event
              const amtArg = Array.from(args).find(a => typeof a === "bigint" && a > 0n);
              if (amtArg) amount = formatEther(amtArg);
            }

            all.push({
              type:    name,
              label:   cfg.label,
              color:   cfg.color,
              icon:    cfg.icon,
              dir:     cfg.dir || null,
              amount,
              args:    [...args].map(a => a?.toString?.() ?? ""),
              block:   e.blockNumber,
              txHash:  e.transactionHash,
              logIdx:  e.logIndex,
            });
          }
        } catch { /* some events may not exist */ }
      }

      // Sort newest first
      all.sort((a, b) => b.block - a.block || b.logIdx - a.logIdx);
      setTxs(all);
    } catch (err) {
      console.error("TransactionHistory load:", err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilter() {
    let result = [...txs];

    if (filter !== "all") {
      const filterMap = {
        loan:      ["LoanReleased", "BorrowerSelected"],
        emi:       ["EMIPaid"],
        profit:    ["ProfitWithdrawn"],
        voting:    ["VotingStarted", "BorrowerSelected"],
        emergency: ["EmergencyRequested", "EmergencyResolved", "EmergencyReleased", "EmergencyRepaid"],
        members:   ["MemberJoined", "GroupCreated", "GroupApproved", "KickRaised", "KickResolved"],
        credit:    ["CreditUpdated"],
      };
      result = result.filter(t => (filterMap[filter] || []).includes(t.type));
    }

    if (addrFilter.trim()) {
      const addr = addrFilter.toLowerCase().trim();
      result = result.filter(t =>
        t.args.some(a => a.toLowerCase().includes(addr)) ||
        t.txHash.toLowerCase().includes(addr)
      );
    }

    setFiltered(result);
  }

  function fmt(amount) {
    if (!amount) return "";
    const n = parseFloat(amount);
    return currency === "INR" ? `₹${(n * 500000).toLocaleString()}` : `${n.toFixed(6)} ETH`;
  }

  function getSubtitle(tx) {
    const a = tx.args;
    switch (tx.type) {
      case "MemberJoined":       return `Member ${a[1]?.slice(0,8)}...${a[1]?.slice(-4)} joined`;
      case "BorrowerSelected":   return `Borrower: ${a[1]?.slice(0,8)}...${a[1]?.slice(-4)}${a[2]==="true"?" (tie broken)":""}`;
      case "LoanReleased":       return `To: ${a[1]?.slice(0,8)}...${a[1]?.slice(-4)}`;
      case "EMIPaid":            return `Month #${a[3]} · Late fee: ${parseFloat(formatEther(a[4]||"0"))>0?fmt(formatEther(a[4])):"None"}`;
      case "ProfitWithdrawn":    return `By: ${a[1]?.slice(0,8)}...${a[1]?.slice(-4)}`;
      case "EmergencyRequested": return `"${a[4]}" by ${a[2]?.slice(0,8)}...`;
      case "EmergencyResolved":  return `${a[2]==="true"?"Approved":"Rejected"} — Yes:${a[3]} No:${a[4]}`;
      case "EmergencyReleased":  return `To: ${a[2]?.slice(0,8)}...${a[2]?.slice(-4)}`;
      case "KickRaised":         return `Target: ${a[2]?.slice(0,8)}... by ${a[3]?.slice(0,8)}...`;
      case "KickResolved":       return `${a[3]==="true"?"Kicked":"Kept"}: ${a[2]?.slice(0,8)}...`;
      case "CreditUpdated":      return `${a[1]?.slice(0,8)}... new score: ${a[2]}`;
      default:                   return "";
    }
  }

  const FILTERS = [
    { key: "all",       label: `All (${txs.length})` },
    { key: "loan",      label: "Loan" },
    { key: "emi",       label: "EMI" },
    { key: "profit",    label: "Profit" },
    { key: "voting",    label: "Voting" },
    { key: "emergency", label: "Emergency" },
    { key: "members",   label: "Members" },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">📜 Transaction History</div>
            <div className="page-sub">Complete on-chain ledger for Group #{gid}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={`https://sepolia.etherscan.io/address/${contract?.target}`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--purple)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
            >
              View Contract on Etherscan ↗
            </a>
            <button className="btn-secondary" onClick={load} style={{ padding: "6px 14px", fontSize: 12 }}>
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { lbl: "Total Events",  val: txs.length                                              },
          { lbl: "EMI Payments",  val: txs.filter(t=>t.type==="EMIPaid").length,     cls:"cyan" },
          { lbl: "Loans Released",val: txs.filter(t=>t.type==="LoanReleased").length,cls:"green"},
          { lbl: "Emergencies",   val: txs.filter(t=>t.type==="EmergencyRequested").length, cls:"amber" },
        ].map((s,i) => (
          <div className={`stat-card ${s.cls||""}`} key={i}>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-val">{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`nav-btn ${filter === f.key ? "active" : ""}`}
            style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Address search ─────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Search by address or tx hash..."
          value={addrFilter}
          onChange={e => setAddrFilter(e.target.value)}
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state"><div className="empty-icon">⟳</div><p>Loading transactions...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No transactions found{filter !== "all" ? ` for filter "${filter}"` : ""}.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Details</th>
                <th>Amount</th>
                <th>Block</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{tx.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: tx.color, fontSize: 12 }}>{tx.label}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text3)", maxWidth: 200 }}>
                    {getSubtitle(tx)}
                  </td>
                  <td>
                    {tx.amount ? (
                      <span className={tx.dir === "in" ? "amount-in" : tx.dir === "out" ? "amount-out" : ""} style={{ fontSize: 13 }}>
                        {tx.dir === "in" ? "+" : tx.dir === "out" ? "-" : ""}{fmt(tx.amount)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <a
                      href={`https://sepolia.etherscan.io/block/${tx.block}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--purple)", fontSize: 12 }}
                    >
                      #{tx.block}
                    </a>
                  </td>
                  <td>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--purple)", fontSize: 12 }}
                    >
                      {tx.txHash.slice(0,8)}... ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}