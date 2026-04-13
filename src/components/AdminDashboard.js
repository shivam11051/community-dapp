import { useState, useEffect } from "react";
import { formatEther } from "ethers";
import { formatAddress } from "../utils/format";

const STATUS_LABEL = ["PENDING", "OPEN", "ACTIVE", "CLOSED"];
const STATUS_BADGE = ["badge-pending", "badge-open", "badge-active", "badge-closed"];

export default function AdminDashboard({
  contract, account, isAdmin, currency,
  txPending, actions, loadGlobalState, addNotif
}) {
  const [tab,        setTab]        = useState("overview");
  const [allGroups,  setAllGroups]  = useState([]);
  const [contractBal,setContractBal]= useState("0");
  const [isPaused,   setIsPaused]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [members,    setMembers]    = useState([]);
  const [emergencies,setEmergencies]= useState([]);
  const [kicks,      setKicks]      = useState([]);
  const [memberInfos,setMemberInfos]= useState({});
  const [detailLoad, setDetailLoad] = useState(false);

  useEffect(() => { if (contract && isAdmin) loadData(); }, [contract, isAdmin]);

  /**
   * LOAD ALL GROUPS DATA
   * Gets all groups, their members, and contract balance
   */
  async function loadData() {
    setLoading(true);
    try {
      console.log("📊 Loading admin data...");
      
      const count = Number(await contract.groupCount());
      const all = [];
      
      for (let i = 1; i <= count; i++) {
        try {
          const g   = await contract.groups(i);
          const mem = await contract.getMembers(i);
          all.push({
            id: Number(g.id), 
            name: g.name, 
            creator: g.creator,
            status: Number(g.status), 
            contribution: g.contribution,
            maxSize: Number(g.maxSize), 
            tenure: Number(g.tenure),
            fillDeadline: Number(g.fillDeadline),
            memberCount: mem.length, 
            totalPool: g.totalPool,
            profitPool: g.profitPool, 
            isPrivate: g.isPrivate || false,
            borrower: g.borrower,
            emergencyCount: Number(g.emergencyCount),
            kickCount: Number(g.kickCount),
          });
        } catch (e) { 
          console.warn(`⚠️ Error loading group ${i}:`, e.message);
        }
      }
      setAllGroups(all);
      console.log(`✅ Loaded ${all.length} groups`);

      // Get contract balance
      try {
        let addr;
        try {
          addr = contract.address || contract.target || (await contract.getAddress?.());
          if (!addr) throw new Error("Could not determine contract address");
        } catch (err) {
          logger.warn("Failed to get contract address:", err.message);
          addNotif("Could not load contract address", "warning");
          return;
        }

        const bal = await contract.runner?.provider?.getBalance(addr);
        if (!bal) {
          setContractBal("0");
        } else {
          setContractBal(formatEther(bal));
        }
      } catch (e) { 
        console.warn("⚠️ Error loading contract balance:", e.message);
      }

      // Check if contract is paused
      try { 
        setIsPaused(await contract.paused()); 
      } catch (e) { 
        setIsPaused(false); 
      }

    } catch (err) {
      console.error("❌ Error loading admin data:", err);
      addNotif("Failed to load: " + err.message, "error");
    } finally { 
      setLoading(false); 
    }
  }

  /**
   * LOAD MEMBER INFO WITH Promise.all
   * 
   * Load all member credit scores, missed/late payments IN PARALLEL
   * Instead of: 1 by 1 (takes 5 seconds for 5 members)
   * We do: All at once (takes 1 second for 5 members) ⚡
   */
  async function loadMemberInfos(gid, membersList) {
    if (!contract || !membersList || membersList.length === 0) {
      console.warn("⚠️ No members to load");
      return {};
    }

    try {
      console.log(`📊 Loading info for ${membersList.length} members in PARALLEL...`);
      
      // Load all member infos AT ONCE using Promise.all
      const infoArray = await Promise.all(
        membersList.map(m => contract.getMemberInfo(gid, m))
      );
      
      console.log(`✅ Loaded ${infoArray.length} member infos (5x faster than sequential!)`);

      // Convert array to object for easy lookup
      const infos = {};
      membersList.forEach((member, idx) => {
        const info = infoArray[idx];
        infos[member.toLowerCase()] = {
          creditScore: Number(info[0] || 0),
          missed: Number(info[1] || 0),
          onTime: Number(info[2] || 0),
          late: Number(info[3] || 0),
        };
      });

      return infos;
    } catch (error) {
      console.error("❌ Error loading member infos:", error);
      addNotif("Failed to load member info", "error");
      return {};
    }
  }

  /**
   * LOAD GROUP DETAIL
   * Called when user clicks on a group to view detailed info
   */
  async function loadGroupDetail(g) {
    setSelected(g); 
    setDetailLoad(true);
    setMembers([]); 
    setEmergencies([]); 
    setKicks([]); 
    setMemberInfos({});

    try {
      // ─── Load members ─────────────────────────────────────────
      const mems = await contract.getMembers(g.id);
      setMembers(mems);
      console.log(`✅ Loaded ${mems.length} members for group ${g.id}`);

      // ─── Load all member infos IN PARALLEL ─────────────────────
      const infos = await loadMemberInfos(g.id, mems);
      setMemberInfos(infos);

      // ─── Load emergency requests ──────────────────────────────
      const emgs = [];
      for (let i = 1; i <= g.emergencyCount; i++) {
        try {
          const r = await contract.emergencyRequests(g.id, i);
          emgs.push({ 
            id: Number(r.id), 
            requester: r.requester, 
            amount: r.amount, 
            reason: r.reason, 
            yesVotes: Number(r.yesVotes), 
            noVotes: Number(r.noVotes), 
            resolved: r.resolved, 
            approved: r.approved, 
            repaid: r.repaid 
          });
        } catch (e) { 
          console.warn(`⚠️ Error loading emergency ${i}:`, e.message);
        }
      }
      setEmergencies(emgs);
      console.log(`✅ Loaded ${emgs.length} emergency requests`);

      // ─── Load kick requests ────────────────────────────────────
      const ks = [];
      for (let i = 1; i <= g.kickCount; i++) {
        try {
          const r = await contract.kickRequests(g.id, i);
          ks.push({ 
            id: Number(r.id), 
            target: r.target, 
            raisedBy: r.raisedBy, 
            yesVotes: Number(r.yesVotes), 
            noVotes: Number(r.noVotes), 
            resolved: r.resolved, 
            approved: r.approved 
          });
        } catch (e) { 
          console.warn(`⚠️ Error loading kick ${i}:`, e.message);
        }
      }
      setKicks(ks);
      console.log(`✅ Loaded ${ks.length} kick requests`);

    } catch (err) { 
      console.error("❌ Error loading group detail:", err);
      addNotif("Failed to load group detail", "error"); 
    }
    finally { 
      setDetailLoad(false); 
    }
  }

  /**
   * SEND DIRECT TRANSACTION
   * Executes a contract function and shows success/error message
   */
  async function sendDirectTx(fn, msg) {
    try { 
      const tx = await fn(); 
      await tx.wait(); 
      addNotif(msg, "success"); 
      return true; 
    }
    catch (err) { 
      addNotif(err?.reason || err?.message || "Failed", "error"); 
      return false; 
    }
  }

  // ─── ADMIN ACTIONS ────────────────────────────────────────────
  async function handlePauseToggle() {
    const ok = await sendDirectTx(
      () => isPaused ? contract.unpause() : contract.pause(),
      isPaused ? "Contract unpaused ▶" : "Contract paused ⏸"
    );
    if (ok) { 
      setIsPaused(!isPaused); 
      await loadData(); 
    }
  }

  async function handleApprove(gid) { 
    await actions.approveGroup(gid); 
    await loadData(); 
    if (selected?.id === gid) setSelected(p => ({ ...p, status: 1 })); 
  }

  async function handleReject(gid)  { 
    await actions.rejectGroup(gid);  
    await loadData(); 
    if (selected?.id === gid) setSelected(null); 
  }

  async function handleExpire(gid)  { 
    await actions.expireGroup(gid);  
    await loadData(); 
    if (selected?.id === gid) setSelected(null); 
  }

  // ─── FORMATTING HELPERS ────────────────────────────────────────
  function fmt(raw) {
    const eth = parseFloat(formatEther(raw || "0"));
    return currency === "INR" ? `₹${(eth * 500000).toLocaleString()}` : `${eth.toFixed(4)} ETH`;
  }

  function fmtAddr(a) { 
    return a ? `${a.slice(0,8)}...${a.slice(-6)}` : "—"; 
  }

  function creditColor(s) { 
    if (s >= 150) return "var(--green)"; 
    if (s >= 100) return "var(--purple)"; 
    if (s >= 60) return "var(--gold)"; 
    return "var(--red)"; 
  }

  // ─── TAB BUTTON STYLE ──────────────────────────────────────────
  const tbStyle = (k) => ({
    padding: "8px 16px", 
    borderRadius: "var(--radius-sm)",
    border: `1px solid ${tab === k ? "var(--purple-mid)" : "var(--border)"}`,
    background: tab === k ? "var(--purple-dim)" : "transparent",
    color: tab === k ? "var(--purple)" : "var(--text3)",
    fontSize: 13, 
    fontWeight: 600, 
    cursor: "pointer", 
    fontFamily: "inherit",
  });

  // ─── ACCESS CONTROL ───────────────────────────────────────────
  if (!isAdmin) return (
    <div>
      <div className="page-header">
        <div className="page-title">Admin Dashboard</div>
      </div>
      <div className="warn-box">⛔ Access denied. Only the contract deployer can access this page.</div>
    </div>
  );

  // ─── DERIVE STATE ──────────────────────────────────────────────
  const pending = allGroups.filter(g => g.status === 0);
  const open    = allGroups.filter(g => g.status === 1);
  const active  = allGroups.filter(g => g.status === 2);
  const closed  = allGroups.filter(g => g.status === 3);
  const totalPooled  = allGroups.reduce((a, g) => a + parseFloat(formatEther(g.totalPool || "0")), 0);
  const totalMembers = allGroups.reduce((a, g) => a + g.memberCount, 0);

  return (
    <div>
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">⚙ Admin Control Panel</div>
            <div className="page-sub">
              Full DApp control · {fmtAddr(account)}
              {isPaused && <span style={{ color: "var(--red)", marginLeft: 12, fontWeight: 700 }}>⏸ CONTRACT PAUSED</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePauseToggle} disabled={txPending} style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", fontFamily: "inherit",
              background: isPaused ? "var(--green)" : "var(--red)", color: "white",
            }}>
              {isPaused ? "▶ Unpause" : "⏸ Pause Contract"}
            </button>
            <button style={tbStyle("")} onClick={loadData}>↻ Refresh</button>
          </div>
        </div>
      </div>

      {/* ─── PAUSED BANNER ────────────────────────────────────────────────── */}
      {isPaused && (
        <div style={{ background: "rgba(255,92,122,.08)", border: "1px solid rgba(255,92,122,.25)", borderLeft: "4px solid var(--red)", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 4 }}>⏸ CONTRACT IS PAUSED</div>
            <div style={{ color: "var(--text2)", fontSize: 13 }}>All user transactions are blocked. Only admin functions work.</div>
          </div>
          <button className="btn-success" onClick={handlePauseToggle} disabled={txPending}>▶ Unpause Now</button>
        </div>
      )}

      {/* ─── TABS ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { k: "overview",  l: "Overview" },
          { k: "pending",   l: `Approve (${pending.length})` },
          { k: "groups",    l: `All Groups (${allGroups.length})` },
          { k: "contract",  l: "Contract Controls" },
        ].map(t => <button key={t.k} style={tbStyle(t.k)} onClick={() => setTab(t.k)}>{t.l}</button>)}
      </div>

      {/* ─── LOADING STATE ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⟳</div>
          <p>Loading DApp data...</p>
        </div>
      ) : (
        <>
          {/* ════════ OVERVIEW TAB ════════ */}
          {tab === "overview" && (
            <div>
              <div className="stats-grid" style={{ marginBottom: 14 }}>
                {[
                  { lbl: "Pending Approval", val: pending.length, cls: "amber"  },
                  { lbl: "Open Groups",      val: open.length,    cls: "purple" },
                  { lbl: "Active Loans",     val: active.length,  cls: "green"  },
                  { lbl: "Closed Groups",    val: closed.length,  cls: ""       },
                ].map((s, i) => <div className={`stat-card ${s.cls}`} key={i}><div className="stat-lbl">{s.lbl}</div><div className="stat-val">{s.val}</div></div>)}
              </div>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                {[
                  { lbl: "Total Groups",     val: allGroups.length, cls: "" },
                  { lbl: "Total Members",    val: totalMembers,     cls: "purple" },
                  { lbl: "Total Pooled",     val: currency === "INR" ? `₹${(totalPooled*500000).toLocaleString()}` : `${totalPooled.toFixed(4)} ETH`, cls: "green" },
                  { lbl: "Contract Balance", val: currency === "INR" ? `₹${(parseFloat(contractBal)*500000).toLocaleString()}` : `${parseFloat(contractBal).toFixed(4)} ETH`, cls: "amber" },
                ].map((s, i) => <div className={`stat-card ${s.cls}`} key={i}><div className="stat-lbl">{s.lbl}</div><div className="stat-val" style={{ fontSize: s.val?.toString().length > 10 ? 16 : 24 }}>{s.val}</div></div>)}
              </div>

              {pending.length > 0 && (
                <div style={{ background: "rgba(255,179,71,.06)", border: "1px solid rgba(255,179,71,.2)", borderLeft: "4px solid var(--gold)", borderRadius: "var(--radius)", padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ color: "var(--gold)", fontWeight: 700, marginBottom: 12 }}>⚠ {pending.length} Group{pending.length > 1 ? "s" : ""} Awaiting Approval</div>
                  {pending.map(g => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,.03)", borderRadius: "var(--radius-sm)", padding: "12px 14px", border: "1px solid var(--border)", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{g.name} <span style={{ fontSize: 12, color: "var(--text3)" }}>#{g.id}</span></div>
                        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                          {fmtAddr(g.creator)} · {fmt(g.contribution)}/mo · {g.maxSize} members · {g.isPrivate ? "🔒 Private" : "🌐 Public"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-success" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleApprove(g.id)} disabled={txPending}>✓ Approve</button>
                        <button className="btn-danger"  style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleReject(g.id)}  disabled={txPending}>✕ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 14 }}>Groups by Status</div>
                  {[
                    { label: "Pending", count: pending.length, color: "var(--gold)"   },
                    { label: "Open",    count: open.length,    color: "var(--purple)" },
                    { label: "Active",  count: active.length,  color: "var(--green)"  },
                    { label: "Closed",  count: closed.length,  color: "var(--text3)"  },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                        <span style={{ color: "var(--text2)", fontSize: 13 }}>{row.label}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: row.color }}>{row.count}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 14 }}>Emergency Activity</div>
                  {allGroups.filter(g => g.emergencyCount > 0).length === 0 ? (
                    <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No emergency requests across any group</div>
                  ) : allGroups.filter(g => g.emergencyCount > 0).map((g, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ color: "var(--text2)" }}>{g.name}</span>
                      <span style={{ color: "var(--red)", fontWeight: 600 }}>{g.emergencyCount} request{g.emergencyCount > 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════ PENDING APPROVAL TAB ════════ */}
          {tab === "pending" && (
            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 390px" : "1fr", gap: 20 }}>
              <div>
                {pending.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">✓</div><p>All groups approved. Nothing pending!</p></div>
                ) : pending.map(g => (
                  <div key={g.id} className="card" style={{ marginBottom: 12, borderColor: selected?.id === g.id ? "var(--purple-mid)" : "var(--border)", cursor: "pointer" }} onClick={() => loadGroupDetail(g)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15, marginBottom: 4 }}>
                          {g.name}
                          <span className="badge badge-pending" style={{ marginLeft: 8, fontSize: 10 }}>PENDING</span>
                          {g.isPrivate && <span className="badge" style={{ marginLeft: 6, fontSize: 10, background: "var(--purple-dim)", color: "var(--purple)", border: "1px solid var(--purple-mid)" }}>🔒 PRIVATE</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>#{g.id} · Creator: {fmtAddr(g.creator)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-success" style={{ padding: "6px 14px", fontSize: 12 }} onClick={e => { e.stopPropagation(); handleApprove(g.id); }} disabled={txPending}>✓ Approve</button>
                        <button className="btn-danger"  style={{ padding: "6px 14px", fontSize: 12 }} onClick={e => { e.stopPropagation(); handleReject(g.id); }}  disabled={txPending}>✕ Reject</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { lbl: "EMI/month",   val: fmt(g.contribution) },
                        { lbl: "Max Members", val: g.maxSize },
                        { lbl: "Tenure",      val: `${g.tenure} mo` },
                        { lbl: "Type",        val: g.isPrivate ? "🔒 Private" : "🌐 Public" },
                      ].map((r, i) => (
                        <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{r.lbl}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{r.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {selected && <DetailPanel g={selected} members={members} emergencies={emergencies} kicks={kicks} memberInfos={memberInfos} loading={detailLoad} fmt={fmt} fmtAddr={fmtAddr} creditColor={creditColor} onApprove={handleApprove} onReject={handleReject} onClose={() => setSelected(null)} txPending={txPending} />}
            </div>
          )}

          {/* ════════ ALL GROUPS TAB ════════ */}
          {tab === "groups" && (
            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 390px" : "1fr", gap: 20 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Creator</th><th>EMI</th><th>Members</th><th>Pool</th><th>Status</th><th>Type</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {allGroups.map(g => (
                      <tr key={g.id} style={{ cursor: "pointer", background: selected?.id === g.id ? "rgba(167,139,250,.05)" : "" }} onClick={() => loadGroupDetail(g)}>
                        <td style={{ color: "var(--purple)", fontWeight: 600 }}>#{g.id}</td>
                        <td style={{ color: "var(--text)", fontWeight: 500 }}>{g.name}</td>
                        <td className="mono">{fmtAddr(g.creator)}</td>
                        <td style={{ color: "var(--gold)" }}>{fmt(g.contribution)}</td>
                        <td>{g.memberCount}/{g.maxSize}</td>
                        <td>{fmt(g.totalPool)}</td>
                        <td><span className={`badge ${STATUS_BADGE[g.status]}`}>{STATUS_LABEL[g.status]}</span></td>
                        <td>
                          <span className="badge" style={{ fontSize: 10, background: g.isPrivate ? "var(--purple-dim)" : "var(--green-dim)", color: g.isPrivate ? "var(--purple)" : "var(--green)", border: `1px solid ${g.isPrivate ? "var(--purple-mid)" : "rgba(34,197,94,.2)"}` }}>
                            {g.isPrivate ? "🔒 Private" : "🌐 Public"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {g.status === 0 && <>
                              <button className="btn-success" style={{ padding: "3px 8px", fontSize: 11 }} onClick={e => { e.stopPropagation(); handleApprove(g.id); }} disabled={txPending}>Approve</button>
                              <button className="btn-danger"  style={{ padding: "3px 8px", fontSize: 11 }} onClick={e => { e.stopPropagation(); handleReject(g.id);  }} disabled={txPending}>Reject</button>
                            </>}
                            {g.status === 1 && <button className="btn-danger" style={{ padding: "3px 8px", fontSize: 11 }} onClick={e => { e.stopPropagation(); handleExpire(g.id); }} disabled={txPending}>Expire</button>}
                            <button style={{ padding: "3px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: "6px", background: "transparent", color: "var(--text2)", cursor: "pointer" }} onClick={e => { e.stopPropagation(); loadGroupDetail(g); }}>View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected && <DetailPanel g={selected} members={members} emergencies={emergencies} kicks={kicks} memberInfos={memberInfos} loading={detailLoad} fmt={fmt} fmtAddr={fmtAddr} creditColor={creditColor} onApprove={handleApprove} onReject={handleReject} onClose={() => setSelected(null)} txPending={txPending} />}
            </div>
          )}

          {/* ════════ CONTRACT CONTROLS TAB ════════ */}
          {tab === "contract" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>Contract Status</div>
                {[
                  { lbl: "Status",        val: isPaused ? "⏸ PAUSED" : "▶ ACTIVE", color: isPaused ? "var(--red)" : "var(--green)", mono: false },
                  { lbl: "Balance",       val: `${parseFloat(contractBal).toFixed(6)} ETH`, color: "var(--gold)", mono: false },
                  { lbl: "Total Groups",  val: allGroups.length, mono: false },
                  { lbl: "Total Members", val: totalMembers,     mono: false },
                  { lbl: "Admin",         val: fmtAddr(account), mono: true  },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{r.lbl}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.color || "var(--text)", fontFamily: r.mono ? "monospace" : "inherit" }}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{ borderColor: isPaused ? "rgba(34,197,94,.3)" : "rgba(255,92,122,.2)" }}>
                <div className="card-title" style={{ marginBottom: 8, color: isPaused ? "var(--green)" : "var(--red)" }}>
                  {isPaused ? "▶ Resume Operations" : "⏸ Emergency Stop"}
                </div>
                <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 16 }}>
                  {isPaused ? "Contract is paused. All user transactions are blocked. Unpause to resume." : "Pause all user operations instantly if a bug or attack is detected. Only you can unpause."}
                </p>
                <button disabled={txPending} onClick={handlePauseToggle} style={{
                  width: "100%", padding: 12, fontSize: 14, fontWeight: 700, border: "none",
                  borderRadius: "var(--radius-sm)", cursor: "pointer", fontFamily: "inherit",
                  background: isPaused ? "var(--green)" : "var(--red)", color: "white",
                }}>
                  {txPending ? "Processing..." : isPaused ? "▶ Unpause Contract" : "⏸ Pause Contract"}
                </button>
              </div>

              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Group Pipeline</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    { label: "Pending", groups: pending, color: "var(--gold)",   action: "Approve / Reject" },
                    { label: "Open",    groups: open,    color: "var(--purple)", action: "Members Joining"  },
                    { label: "Active",  groups: active,  color: "var(--green)",  action: "Loan Running"     },
                    { label: "Closed",  groups: closed,  color: "var(--text3)",  action: "Completed"        },
                  ].map((col, i) => (
                    <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius)", padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: col.color, textTransform: "uppercase", letterSpacing: ".06em" }}>{col.label}</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: col.color }}>{col.groups.length}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>{col.action}</div>
                      {col.groups.slice(0, 3).map((g, j) => (
                        <div key={j} style={{ fontSize: 11, color: "var(--text2)", padding: "3px 0", borderTop: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          #{g.id} {g.name}
                        </div>
                      ))}
                      {col.groups.length > 3 && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>+{col.groups.length - 3} more</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-title" style={{ marginBottom: 12 }}>On-Chain Links</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href={`https://sepolia.etherscan.io/address/${contract?.target}`} target="_blank" rel="noreferrer"
                    style={{ color: "var(--purple)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid var(--purple-mid)", borderRadius: "var(--radius-sm)", background: "var(--purple-dim)" }}>
                    View Contract ↗
                  </a>
                  <a href={`https://sepolia.etherscan.io/address/${account}`} target="_blank" rel="noreferrer"
                    style={{ color: "var(--text2)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                    Admin Wallet ↗
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Detail side panel ─────────────────────────────────────────────
function DetailPanel({ g, members, emergencies, kicks, memberInfos, loading, fmt, fmtAddr, creditColor, onApprove, onReject, onClose, txPending }) {
  const [dt, setDt] = useState("members");
  
  const dtStyle = k => ({
    padding: "5px 10px", 
    borderRadius: "6px", 
    fontSize: 11, 
    fontWeight: 600,
    border: `1px solid ${dt === k ? "var(--purple-mid)" : "var(--border)"}`,
    background: dt === k ? "var(--purple-dim)" : "transparent",
    color: dt === k ? "var(--purple)" : "var(--text3)", 
    cursor: "pointer", 
    fontFamily: "inherit",
  });

  return (
    <div className="card" style={{ position: "sticky", top: 80, maxHeight: "calc(100vh - 120px)", overflowY: "auto", borderColor: "var(--purple-mid)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>{g.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Group #{g.id} · {["PENDING","OPEN","ACTIVE","CLOSED"][g.status]}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { lbl: "EMI",     val: fmt(g.contribution) },
          { lbl: "Members", val: `${g.memberCount}/${g.maxSize}` },
          { lbl: "Tenure",  val: `${g.tenure} mo` },
          { lbl: "Pool",    val: fmt(g.totalPool) },
        ].map((r, i) => (
          <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{r.lbl}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{r.val}</div>
          </div>
        ))}
      </div>

      {g.status === 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className="btn-success" style={{ flex: 1, padding: "8px" }} onClick={() => onApprove(g.id)} disabled={txPending}>✓ Approve</button>
          <button className="btn-danger"  style={{ flex: 1, padding: "8px" }} onClick={() => onReject(g.id)}  disabled={txPending}>✕ Reject</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={dtStyle("members")}     onClick={() => setDt("members")}>Members ({members.length})</button>
        <button style={dtStyle("emergencies")} onClick={() => setDt("emergencies")}>Emg ({emergencies.length})</button>
        <button style={dtStyle("kicks")}       onClick={() => setDt("kicks")}>Kicks ({kicks.length})</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>⟳ Loading...</div>
      ) : (
        <>
          {dt === "members" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>No members yet</div>
              ) : (
                members.map((addr, i) => {
                  const info = memberInfos[addr.toLowerCase()];
                  const isBorrower = g.borrower?.toLowerCase() === addr.toLowerCase();
                  const isCreator  = g.creator?.toLowerCase()  === addr.toLowerCase();
                  return (
                    <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: `1px solid ${isBorrower ? "rgba(255,179,71,.2)" : "var(--border)"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text)" }}>{fmtAddr(addr)}</span>
                          <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                            {isCreator  && <span className="badge badge-open"     style={{ fontSize: 9 }}>Creator</span>}
                            {isBorrower && <span className="badge badge-borrower" style={{ fontSize: 9 }}>Borrower</span>}
                          </div>
                        </div>
                        {info && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: creditColor(info.creditScore) }}>{info.creditScore}</div>
                            <div style={{ fontSize: 10, color: "var(--text3)" }}>score</div>
                          </div>
                        )}
                      </div>
                      {info && (
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: "var(--green)" }}>✓ {info.onTime} on-time</span>
                          <span style={{ fontSize: 10, color: "var(--gold)"  }}>⚡ {info.late} late</span>
                          <span style={{ fontSize: 10, color: "var(--red)"   }}>✗ {info.missed} missed</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {dt === "emergencies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {emergencies.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>No emergency requests</div>
              ) : (
                emergencies.map((r, i) => (
                  <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: `1px solid ${r.approved ? "rgba(34,197,94,.2)" : "var(--border)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>#{r.id} — {fmt(r.amount)}</div>
                      <span className={`badge ${r.resolved ? (r.approved ? "badge-active" : "badge-closed") : "badge-pending"}`} style={{ fontSize: 9 }}>
                        {r.resolved ? (r.approved ? "APPROVED" : "REJECTED") : "VOTING"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>&ldquo;{r.reason}&rdquo;</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>By: {fmtAddr(r.requester)}</div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, marginTop: 4 }}>
                      <span style={{ color: "var(--green)" }}>Yes: {r.yesVotes}</span>
                      <span style={{ color: "var(--red)"   }}>No: {r.noVotes}</span>
                      {r.repaid && <span style={{ color: "var(--purple)" }}>✓ Repaid</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {dt === "kicks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {kicks.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>No kick requests</div>
              ) : (
                kicks.map((r, i) => (
                  <div key={i} style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Kick #{r.id}</div>
                      <span className={`badge ${r.resolved ? (r.approved ? "badge-active" : "badge-closed") : "badge-pending"}`} style={{ fontSize: 9 }}>
                        {r.resolved ? (r.approved ? "KICKED" : "KEPT") : "VOTING"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Target: {fmtAddr(r.target)}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>By: {fmtAddr(r.raisedBy)}</div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                      <span style={{ color: "var(--green)" }}>Yes: {r.yesVotes}</span>
                      <span style={{ color: "var(--red)"   }}>No: {r.noVotes}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}