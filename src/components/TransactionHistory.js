import { useState, useEffect } from "react";
import { formatEther } from "ethers";

// Event configuration with proper field mapping
const EVENT_CONFIG = {
  GroupCreated:       { label: "Group Created",      color: "var(--cyan)",   icon: "🏦", signature: "GroupCreated(uint256,string,address,uint256,bool)" },
  GroupApproved:      { label: "Group Approved",     color: "var(--green)",  icon: "✅", signature: "GroupApproved(uint256)" },
  MemberJoined:       { label: "Member Joined",      color: "var(--cyan)",   icon: "👤", signature: "MemberJoined(uint256,address,uint256)" },
  VotingStarted:      { label: "Voting Started",     color: "var(--purple)", icon: "🗳️", signature: "VotingStarted(uint256,uint256)" },
  BorrowerSelected:   { label: "Borrower Selected",  color: "var(--gold)",   icon: "🏆", signature: "BorrowerSelected(uint256,address,bool)" },
  LoanReleased:       { label: "Loan Released",      color: "var(--green)",  icon: "💸", signature: "LoanReleased(uint256,address,uint256)" },
  EMIPaid:            { label: "EMI Paid",           color: "var(--amber)",  icon: "📋", signature: "EMIPaid(uint256,address,uint256,uint256,uint256)" },
  ProfitWithdrawn:    { label: "Profit Withdrawn",   color: "var(--green)",  icon: "💰", signature: "ProfitWithdrawn(uint256,address,uint256)" },
  EmergencyRequested: { label: "Emergency Raised",   color: "var(--red)",    icon: "🚨", signature: "EmergencyRequested(uint256,uint256,uint256,address,string)" },
  EmergencyResolved:  { label: "Emergency Resolved", color: "var(--amber)",  icon: "⚖️", signature: "EmergencyResolved(uint256,uint256,bool)" },
  EmergencyReleased:  { label: "Emergency Funds",    color: "var(--green)",  icon: "🆘", signature: "EmergencyReleased(uint256,uint256,uint256)" },
  EmergencyRepaid:    { label: "Emergency Repaid",   color: "var(--cyan)",   icon: "↩️", signature: "EmergencyRepaid(uint256,uint256,uint256)" },
  KickRaised:         { label: "Kick Raised",        color: "var(--red)",    icon: "⚠️", signature: "KickRaised(uint256,uint256,address)" },
  KickResolved:       { label: "Kick Resolved",      color: "var(--amber)",  icon: "⚖️", signature: "KickResolved(uint256,uint256,bool)" },
  CreditUpdated:      { label: "Credit Updated",     color: "var(--purple)", icon: "⭐", signature: "CreditUpdated(uint256,address,uint256)" },
  VoteCast:           { label: "Vote Cast",          color: "var(--purple)", icon: "🗳️", signature: "VoteCast(uint256,address,address)" },
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

  // ── Configurable filters: stored in localStorage ───────────────────
  const DEFAULT_FILTERS = {
    loan:      ["LoanReleased", "BorrowerSelected"],
    emi:       ["EMIPaid"],
    profit:    ["ProfitWithdrawn"],
    voting:    ["VotingStarted", "BorrowerSelected"],
    emergency: ["EmergencyRequested", "EmergencyResolved", "EmergencyReleased", "EmergencyRepaid"],
    members:   ["MemberJoined", "GroupCreated", "GroupApproved", "KickRaised", "KickResolved"],
    credit:    ["CreditUpdated"],
  };

  const [filterMap, setFilterMap] = useState(() => {
    try {
      const saved = localStorage.getItem("tx_filter_preferences");
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => { if (contract && gid) load(); }, [contract, gid]);
  useEffect(() => { applyFilter(); }, [txs, filter, addrFilter]);

  async function load() {
    setLoading(true);
    try {
      if (!contract) {
        console.warn("Contract not available");
        return;
      }

      // Get contract address
      const contractAddress = await contract.getAddress();
      console.log(`📡 Fetching transactions from MongoDB for Group #${gid}`);

      // Fetch all logs through backend database (avoids API limits)
      const backendBase = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const backendUrl = `${backendBase}/api/history/${gid}?limit=1000`;
      console.log(`Backend endpoint: ${backendUrl}`);
      const response = await fetch(backendUrl);

      if (!response.ok) {
        console.error("Backend API error:", response.statusText);
        return;
      }

      const result = await response.json();
      console.log("📦 Full response:", result);
      
      if (!result.data || result.data.length === 0) {
        console.warn("❌ No transactions found in database for this group");
        setTxs([]);
        return;
      }

      console.log(`📊 Found ${result.data.length} transactions from MongoDB`);

      // Transform database events to UI format
      const all = [];
      for (const event of result.data) {
        try {
          // Map from database format to UI format
          const eventConfig = EVENT_CONFIG[event.eventType];
          if (!eventConfig) continue;

          all.push({
            type: event.eventType,
            label: event.eventType,
            color: eventConfig.color,
            icon: eventConfig.icon,
            dir: null,
            amount: event.amount || null,
            args: event.args || [gid.toString()],
            block: event.block || 0,
            txHash: event.txHash || "pending",
            logIdx: event.logIndex || 0,
            timestamp: event.timestamp,
          });
        } catch (err) {
          console.warn("Failed to process event:", err.message);
        }
      }

      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      console.log(`✅ Loaded ${all.length} transactions for Group #${gid}`);
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
      const selectedEvents = filterMap[filter] || [];
      result = result.filter(t => selectedEvents.includes(t.type));
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

  // Save filter preferences to localStorage
  function saveFilterPreferences(newFilterMap) {
    try {
      localStorage.setItem("tx_filter_preferences", JSON.stringify(newFilterMap));
      setFilterMap(newFilterMap);
    } catch (e) {
      console.warn("Failed to save filter preferences:", e);
    }
  }

  // Reset to default filters
  function resetFilters() {
    saveFilterPreferences(DEFAULT_FILTERS);
  }

  // Toggle an event type in a filter category
  function toggleEventInFilter(filterName, eventType) {
    const updated = { ...filterMap };
    const events = updated[filterName] || [];
    const idx = events.indexOf(eventType);
    if (idx >= 0) {
      events.splice(idx, 1);
    } else {
      events.push(eventType);
    }
    updated[filterName] = events;
    saveFilterPreferences(updated);
  }

  function fmt(amount) {
    if (!amount) return "";
    const n = parseFloat(amount);
    return currency === "INR" ? `₹${(n * 500000).toLocaleString()}` : `${n.toFixed(6)} ETH`;
  }

  function getSubtitle(tx) {
    const a = tx.args;
    if (!a) return "";

    const safeAddr = (addr, idx = 0) => addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : `arg[${idx}]`;
    const safeBool = (val) => val === "true" || val === true;
    const safeNum = (val, def = "0") => val ? String(val) : def;

    try {
      switch (tx.type) {
        case "MemberJoined":       
          return `Member ${a[1] ? safeAddr(a[1], 1) : "unknown"} joined`;
        case "BorrowerSelected":   
          return `Borrower: ${a[1] ? safeAddr(a[1], 1) : "unknown"}${safeBool(a[2]) ? " (tie broken)" : ""}`;
        case "LoanReleased":       
          return `To: ${a[1] ? safeAddr(a[1], 1) : "unknown"}`;
        case "EMIPaid":            
          return `Month #${safeNum(a[3], "?")} · Late fee: ${a[4] && formatEther(a[4]) ? fmt(formatEther(a[4])) : "None"}`;
        case "ProfitWithdrawn":    
          return `By: ${a[1] ? safeAddr(a[1], 1) : "unknown"}`;
        case "EmergencyRequested": 
          return `"${a[4] || "?"}" by ${a[2] ? safeAddr(a[2], 2) : "unknown"}`;
        case "EmergencyResolved":  
          return `${safeBool(a[2]) ? "Approved" : "Rejected"} — Yes:${safeNum(a[3])} No:${safeNum(a[4])}`;
        case "EmergencyReleased":  
          return `To: ${a[2] ? safeAddr(a[2], 2) : "unknown"}`;
        case "KickRaised":         
          return `Target: ${a[2] ? safeAddr(a[2], 2) : "unknown"} by ${a[3] ? safeAddr(a[3], 3) : "unknown"}`;
        case "KickResolved":       
          return `${safeBool(a[3]) ? "Kicked" : "Kept"}: ${a[2] ? safeAddr(a[2], 2) : "unknown"}`;
        case "CreditUpdated":      
          return `${a[1] ? safeAddr(a[1], 1) : "unknown"} new score: ${safeNum(a[2])}`;
        default:                   
          return "";
      }
    } catch (err) {
      console.warn("getSubtitle error:", err);
      return "";
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
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
        
        {/* Reset filters button (shows when not default) */}
        {JSON.stringify(filterMap) !== JSON.stringify(DEFAULT_FILTERS) && (
          <button
            onClick={resetFilters}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              fontSize: 11,
              background: "var(--amber)",
              color: "var(--text)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
            title="Reset filters to default"
          >
            🔄 Reset Filters
          </button>
        )}
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