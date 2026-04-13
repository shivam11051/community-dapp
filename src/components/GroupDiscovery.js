import { useState, useEffect, useRef } from "react";
import { formatEther } from "ethers";

const STATUS = ["PENDING", "OPEN", "ACTIVE", "CLOSED"];
const STATUS_BADGE = ["badge-pending", "badge-open", "badge-active", "badge-closed"];

export default function GroupDiscovery({
  contract, account, currency, myGroupId,
  openGroups, groupCache, txPending,
  actions, navigate, refreshGroup, loadGlobalState
}) {
  const [groups,         setGroups]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [sortBy,         setSortBy]         = useState("newest");
  const [joiningId,      setJoiningId]      = useState(null);
  const [activeTab,      setActiveTab]      = useState("public");
  const [myInvites,      setMyInvites]      = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [invitesError,   setInvitesError]   = useState(null);

  // Track in-flight requests to prevent race conditions
  const loadingRef = useRef(false);
  const invitesLoadingRef = useRef(false);

  // ─── LOAD GROUPS WHEN CONTRACT IS READY ──────────────────────
  useEffect(() => {
    if (contract && !loadingRef.current) {
      console.log("✅ Contract ready, loading groups...");
      loadGroups();
    } else if (!contract) {
      console.warn("⏳ Waiting for contract...");
    }
  }, [contract]); // Only contract, NOT openGroups (prevents race condition)

  // ─── LOAD INVITES WHEN CONTRACT AND ACCOUNT ARE READY ────────
  useEffect(() => {
    if (contract && account && !invitesLoadingRef.current) {
      console.log("✅ Contract and account ready, loading invites...");
      loadMyInvites();
    } else if (!contract || !account) {
      console.warn("⏳ Waiting for contract and account...");
    }
  }, [contract, account]); // Only dependencies ready for invites

  // ─── RELOAD INVITES WHEN TAB CHANGES ────────────────────────
  useEffect(() => {
    if (activeTab === "invites" && contract && account && !invitesLoadingRef.current) {
      loadMyInvites();
    }
  }, [activeTab, contract, account]);

  // ─── LOAD ALL GROUPS ────────────────────────────────────────
  async function loadGroups() {
    if (!contract || loadingRef.current) {
      if (!contract) console.warn("⚠️ Contract not available");
      if (loadingRef.current) console.warn("⚠️ Load already in progress");
      setLoading(false);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    try {
      const count = Number(await contract.groupCount());
      const all   = [];
      
      for (let i = 1; i <= count; i++) {
        const cached = groupCache[i];
        
        // Use cached data if available
        if (cached && cached.isPrivate !== undefined) {
          all.push(cached);
        } else {
          // Fetch from contract
          try {
            const g       = await contract.groups(i);
            const members = await contract.getMembers(i);
            const isPrivate = g.isPrivate ?? false;
            
            all.push({
              id:           Number(g.id),
              name:         g.name,
              creator:      g.creator,
              status:       Number(g.status),
              contribution: g.contribution,
              maxSize:      Number(g.maxSize),
              tenure:       Number(g.tenure),
              fillDeadline: Number(g.fillDeadline),
              members,
              memberCount:  members.length,
              totalPool:    g.totalPool,
              isPrivate:    isPrivate,
            });
          } catch (e) {
            console.warn(`⚠️ Could not load group ${i}:`, e.message);
          }
        }
      }
      
      setGroups(all);
      console.log(`✅ Loaded ${all.length} groups`);
      
    } catch (err) {
      console.error("❌ loadGroups error:", err.message);
      setGroups([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // ─── LOAD MY PRIVATE INVITES ─────────────────────────────────
  async function loadMyInvites() {
    // ✅ Prevent concurrent loads and safety checks
    if (invitesLoadingRef.current) {
      console.warn("⚠️ Invite load already in progress");
      return;
    }

    if (!contract) {
      console.warn("⚠️ Contract is null");
      setInvitesError("Contract not initialized");
      return;
    }

    if (!account) {
      console.warn("⚠️ Account is null");
      setInvitesError("Account not connected");
      return;
    }

    invitesLoadingRef.current = true;
    setLoadingInvites(true);
    setInvitesError(null);

    try {
      console.log("📋 Fetching invites for:", account);
      
      let inviteIds = [];

      // ✅ Method 1: Try contract's getMyInvites (returns OPEN groups only)
      try {
        const result = await contract.getMyInvites(account);
        inviteIds = (result || []).map(Number);
        console.log("✅ getMyInvites result:", inviteIds);
      } catch (e) {
        console.warn("⚠️ getMyInvites failed:", e.message);
      }

      // ✅ Method 2: Scan ALL groups manually to catch PENDING invites
      try {
        const count = Number(await contract.groupCount());
        
        for (let i = 1; i <= count; i++) {
          if (inviteIds.includes(i)) continue;
          
          try {
            const isInv = await contract.isInvited(i, account);
            if (isInv) {
              inviteIds.push(i);
              console.log(`✅ Found invite for group ${i}`);
            }
          } catch (e) {
            /* skip this group */
          }
        }
      } catch (e) {
        console.warn("⚠️ Manual invite scan error:", e.message);
      }

      console.log("📬 Total invite IDs found:", inviteIds);

      // ✅ Fetch full data for each invite
      const inviteData = [];
      
      for (const gid of inviteIds) {
        try {
          const g       = await contract.groups(gid);
          const members = await contract.getMembers(gid);
          const status  = Number(g.status);
          
          inviteData.push({
            id:           Number(g.id),
            name:         g.name,
            creator:      g.creator,
            status,
            contribution: g.contribution,
            maxSize:      Number(g.maxSize),
            tenure:       Number(g.tenure),
            fillDeadline: Number(g.fillDeadline),
            members,
            memberCount:  members.length,
            totalPool:    g.totalPool,
            isPrivate:    true,
            isPending:    status === 0,
          });
        } catch (e) {
          console.warn(`⚠️ Could not load invite group ${gid}:`, e.message);
        }
      }
      
      setMyInvites(inviteData);
      console.log(`✅ Loaded ${inviteData.length} invites`);
      
    } catch (err) {
      console.error("❌ loadMyInvites error:", err.message);
      setInvitesError(err.message);
      setMyInvites([]);
    } finally {
      setLoadingInvites(false);
      invitesLoadingRef.current = false;
    }
  }

  // ─── HANDLE JOIN GROUP ───────────────────────────────────────
  async function handleJoin(gid) {
    if (myGroupId > 0) return;
    setJoiningId(gid);
    
    try {
      await actions.joinGroup(gid);
      await loadGlobalState();
    } catch (e) {
      console.error("❌ Join error:", e);
    } finally {
      setJoiningId(null);
    }
  }

  // ─── FILTER + SORT FOR PUBLIC GROUPS ─────────────────────────
  const publicGroups = groups
    .filter(g => !g.isPrivate)
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    .filter(g => g.status === 1)
    .sort((a, b) => {
      if (sortBy === "newest")      return b.id - a.id;
      if (sortBy === "cheapest")    return Number(a.contribution) - Number(b.contribution);
      if (sortBy === "mostMembers") return b.memberCount - a.memberCount;
      return 0;
    });

  // ─── FILTER + SORT FOR PRIVATE INVITES ──────────────────────
  const privateInvites = myInvites
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "newest")      return b.id - a.id;
      if (sortBy === "cheapest")    return Number(a.contribution) - Number(b.contribution);
      if (sortBy === "mostMembers") return b.memberCount - a.memberCount;
      return 0;
    });

  const allVisible = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const filtered   = activeTab === "public" ? publicGroups : privateInvites;

  function contribDisplay(g) {
    const eth = formatEther(g.contribution);
    if (currency === "INR") return `₹${(parseFloat(eth) * 500000).toLocaleString()}`;
    return `${eth} ETH`;
  }

  function fillPct(g) {
    return Math.round((g.memberCount / g.maxSize) * 100);
  }

  function deadlineLeft(ts) {
    const diff = ts * 1000 - Date.now();
    if (diff <= 0) return "Expired";
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="page-title">Discover Groups</div>
            <div className="page-sub">
              {activeTab === "public"
                ? `${publicGroups.length} open public group${publicGroups.length !== 1 ? "s" : ""} available`
                : `${myInvites.length} private invite${myInvites.length !== 1 ? "s" : ""} for you`}
            </div>
          </div>
          <button className="btn-primary" onClick={() => navigate("create")} disabled={myGroupId > 0}>
            + Create Group
          </button>
        </div>
      </div>

      {/* ── Already in group notice ─────────────────────────────── */}
      {myGroupId > 0 && (
        <div className="info-box" style={{ marginBottom: 20 }}>
          You are already in Group #{myGroupId}. Leave or complete it before joining another.
          <button
            className="btn-secondary"
            style={{ marginLeft: 12, padding: "4px 12px", fontSize: 12 }}
            onClick={() => navigate("dashboard", myGroupId)}
          >
            Go to My Group
          </button>
        </div>
      )}

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab("public")}
          style={{
            padding: "8px 16px",
            borderBottom: activeTab === "public" ? "3px solid var(--cyan)" : "3px solid transparent",
            color: activeTab === "public" ? "var(--cyan)" : "var(--text2)",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "none", transition: "all 0.2s"
          }}
        >
          🌐 Public Groups
          <span style={{ marginLeft: 6, color: "var(--text3)", fontWeight: 400 }}>
            ({groups.filter(g => !g.isPrivate && g.status === 1).length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab("invites")}
          style={{
            padding: "8px 16px",
            borderBottom: activeTab === "invites" ? "3px solid var(--cyan)" : "3px solid transparent",
            color: activeTab === "invites" ? "var(--cyan)" : "var(--text2)",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "none", transition: "all 0.2s"
          }}
        >
          🔒 My Invites
          <span style={{ marginLeft: 6, color: "var(--text3)", fontWeight: 400 }}>
            ({myInvites.length})
          </span>
          {myInvites.length > 0 && (
            <span style={{
              background: "#A855F7", color: "white",
              borderRadius: "99px", padding: "1px 7px",
              fontSize: 10, marginLeft: 6, fontWeight: 700
            }}>
              {myInvites.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Search + Sort ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder={activeTab === "public" ? "Search public groups..." : "Search your invites..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 160 }}>
          <option value="newest">Newest First</option>
          <option value="cheapest">Lowest EMI</option>
          <option value="mostMembers">Most Members</option>
        </select>
        <button className="btn-secondary" onClick={() => { loadGroups(); loadMyInvites(); }} style={{ whiteSpace: "nowrap" }}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      {activeTab === "public" && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
          {[
            { lbl: "Open Public",   val: groups.filter(g => !g.isPrivate && g.status === 1).length, cls: "cyan"  },
            { lbl: "My Invites",    val: myInvites.length,                                           cls: "green" },
            { lbl: "Active Groups", val: groups.filter(g => g.status === 2).length,                  cls: "green" },
            { lbl: "Total Groups",  val: groups.length,                                              cls: ""      },
          ].map((s, i) => (
            <div className={`stat-card ${s.cls}`} key={i}>
              <div className="stat-lbl">{s.lbl}</div>
              <div className="stat-val">{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Private invite banner ────────────────────────────────── */}
      {activeTab === "invites" && (
        <div style={{
          background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.2)",
          borderRadius: "var(--radius-sm)", padding: "12px 16px",
          fontSize: 13, color: "#A855F7", marginBottom: 16
        }}>
          🔒 These are <strong>private groups</strong> where the creator personally invited your wallet.
          Not visible to anyone else.
        </div>
      )}

      {/* ── Error Message ───────────────────────────────────────── */}
      {invitesError && activeTab === "invites" && (
        <div style={{
          background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)",
          borderRadius: "var(--radius-sm)", padding: "12px 16px",
          fontSize: 12, color: "#EF4444", marginBottom: 16
        }}>
          ⚠️ {invitesError}
        </div>
      )}

      {/* ── Group Cards ─────────────────────────────────────────── */}
      {loading || (activeTab === "invites" && loadingInvites) ? (
        <div className="empty-state">
          <div className="empty-icon">⟳</div>
          <p>Loading {activeTab === "public" ? "groups" : "invites"}...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{activeTab === "public" ? "🔍" : "📬"}</div>
          <p>
            {activeTab === "public"
              ? `No open public groups found${search ? ` matching "${search}"` : ""}.`
              : `No private group invitations${search ? ` matching "${search}"` : ""}.`}
          </p>
          {activeTab === "public" && (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("create")}>
              Create the first group
            </button>
          )}
        </div>
      ) : (
        <div className="group-grid">
          {filtered.map(g => (
            <div className="group-card" key={g.id}>
              <div className="group-card-header">
                <div>
                  <div className="group-card-name">{g.name}</div>
                  <div className="group-card-id">Group #{g.id} · by {g.creator.slice(0,6)}...{g.creator.slice(-4)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {g.isPending && (
                    <div className="badge badge-pending" style={{ fontSize: 10 }}>
                      PENDING APPROVAL
                    </div>
                  )}
                  {g.isPrivate ? (
                    <div className="badge" style={{ background: "rgba(168,85,247,.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,.3)", fontSize: 11, fontWeight: 600 }}>
                      🔒 PRIVATE
                    </div>
                  ) : (
                    <div className="badge" style={{ background: "rgba(34,197,94,.12)", color: "var(--green)", border: "1px solid rgba(34,197,94,.3)", fontSize: 11, fontWeight: 600 }}>
                      🌐 PUBLIC
                    </div>
                  )}
                  <div className={`badge ${STATUS_BADGE[g.status]}`}>{STATUS[g.status]}</div>
                </div>
              </div>

              <div className="group-meta">
                <div className="group-meta-item">💰 {contribDisplay(g)}/month</div>
                <div className="group-meta-item">📅 {g.tenure} months</div>
                <div className="group-meta-item">👥 {g.memberCount}/{g.maxSize}</div>
              </div>

              <div className="progress-wrap">
                <div className="progress-label">
                  <span>Members</span>
                  <span>{fillPct(g)}% full</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${fillPct(g)}%`,
                      background: fillPct(g) >= 80 ? "var(--amber)" : g.isPrivate ? "#A855F7" : "var(--cyan)"
                    }}
                  />
                </div>
              </div>

              {g.fillDeadline > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
                  ⏰ {deadlineLeft(g.fillDeadline)}
                </div>
              )}

              {activeTab === "invites" && (
                <div style={{
                  background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.2)",
                  borderRadius: "var(--radius-sm)", padding: "8px 12px",
                  fontSize: 12, color: "#A855F7", marginBottom: 12
                }}>
                  🎉 You have been personally invited to this group
                </div>
              )}

              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>
                Pool: {currency === "INR"
                  ? `₹${(parseFloat(formatEther(g.totalPool)) * 500000).toLocaleString()}`
                  : `${formatEther(g.totalPool)} ETH`}
              </div>

              {g.isPending ? (
                <div style={{
                  width: "100%", textAlign: "center",
                  background: "rgba(255,179,71,.08)",
                  border: "1px solid rgba(255,179,71,.2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px", fontSize: 12,
                  color: "var(--gold)", fontWeight: 600
                }}>
                  ⏳ Waiting for admin approval
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: "100%", background: g.isPrivate ? "#A855F7" : undefined }}
                  onClick={() => handleJoin(g.id)}
                  disabled={myGroupId > 0 || txPending || joiningId === g.id}
                >
                  {joiningId === g.id
                    ? "Joining..."
                    : myGroupId > 0
                    ? "Already in a Group"
                    : activeTab === "invites" ? "Accept & Join" : "Join Group"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}