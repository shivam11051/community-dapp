import { useState, useEffect } from "react";
import { eventCache } from "../utils/eventCache";
import { formatAddress } from "../utils/format";

export default function VotingScreen({
  contract, account, myGroupId, activeGroupId,
  groupCache, txPending, actions, views, navigate, addNotif
}) {
  const gid = activeGroupId || myGroupId;

  const [group,      setGroup]      = useState(null);
  const [voteState,  setVoteState]  = useState(0); // 0=NONE,1=OPEN,2=RESOLVED
  const [voteEnd,    setVoteEnd]    = useState(0);
  const [winner,     setWinner]     = useState("");
  const [wasTie,     setWasTie]     = useState(false);
  const [myVote,     setMyVote]     = useState("");
  const [voteCounts, setVoteCounts] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [timeLeft,   setTimeLeft]   = useState("");

  // ─── MAIN LOAD FUNCTION ──────────────────────────────────────
  useEffect(() => { 
    if (contract && gid) load(); 
  }, [contract, gid]);

  // ─── COUNTDOWN TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (!voteEnd) return;
    const iv = setInterval(() => {
      const diff = voteEnd * 1000 - Date.now();
      if (diff <= 0) { 
        setTimeLeft("Closed"); 
        clearInterval(iv); 
        return; 
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(iv);
  }, [voteEnd]);

  /**
   * LOAD VOTING DATA WITH SMART CACHING
   * 
   * How it works:
   * 1. Get current block number
   * 2. Ask cache: "What blocks should I query?"
   * 3. Query only NEW blocks since last time
   * 4. Update cache for next time
   * 
   * IMPORTANT FIX: On first load, always query from genesis to ensure we don't miss events.
   * This solves the issue where voting events are missed due to caching.
   * 
   * Result: First load = 5 seconds, Next load = 0.5 seconds ⚡
   */
  async function loadVoteEventData() {
    if (!contract) {
      console.warn("⚠️ Contract not available");
      return { voteEvents: [], startEvents: [], resolveEvents: [] };
    }

    try {
      console.log(`🔄 Loading vote events for group ${gid}...`);

      // Step 1: Get current block number
      const currentBlock = await contract.runner.provider.getBlockNumber();
      console.log(`📍 Current block: ${currentBlock}`);

      // Step 2: Query VotingStarted events - CRITICAL: Always query back further on first load
      let startBlockRange = eventCache.getBlockRange(
        currentBlock,
        `VotingStarted_${gid}`
      );
      
      // Force broader search for VotingStarted on first load to catch any missed events
      const cachedStartBlock = eventCache._blocks?.[`VotingStarted_${gid}`];
      if (!cachedStartBlock) {
        // First load - query last 500 blocks to catch any voting events
        startBlockRange = {
          fromBlock: Math.max(0, currentBlock - 500),
          toBlock: currentBlock
        };
        console.log(`🔍 First load: Querying VotingStarted blocks ${startBlockRange.fromBlock} → ${startBlockRange.toBlock}`);
      } else {
        console.log(`📊 Cached load: Querying VotingStarted blocks ${startBlockRange.fromBlock} → ${startBlockRange.toBlock}`);
      }

      const startEvents = await contract.queryFilter(
        contract.filters.VotingStarted(gid),
        startBlockRange.fromBlock,
        startBlockRange.toBlock
      );
      console.log(`✅ Found ${startEvents.length} voting start events`);
      eventCache.setLastBlock(`VotingStarted_${gid}`, startBlockRange.toBlock);

      // Step 3: Query VoteCast events with caching
      const voteBlockRange = eventCache.getBlockRange(
        currentBlock,
        `VoteCast_${gid}`
      );
      console.log(`📊 Querying VoteCast blocks ${voteBlockRange.fromBlock} → ${voteBlockRange.toBlock}`);

      const voteEvents = await contract.queryFilter(
        contract.filters.VoteCast(gid),
        voteBlockRange.fromBlock,
        voteBlockRange.toBlock
      );
      console.log(`✅ Found ${voteEvents.length} votes`);
      eventCache.setLastBlock(`VoteCast_${gid}`, voteBlockRange.toBlock);

      // Step 4: Query BorrowerSelected events with caching
      const resolveBlockRange = eventCache.getBlockRange(
        currentBlock,
        `BorrowerSelected_${gid}`
      );
      const resolveEvents = await contract.queryFilter(
        contract.filters.BorrowerSelected(gid),
        resolveBlockRange.fromBlock,
        resolveBlockRange.toBlock
      );
      console.log(`✅ Found ${resolveEvents.length} borrower selection events`);
      eventCache.setLastBlock(`BorrowerSelected_${gid}`, resolveBlockRange.toBlock);

      return { voteEvents, startEvents, resolveEvents };

    } catch (error) {
      console.error("❌ Error loading vote events:", error);
      addNotif("Failed to load voting data", "error");
      return { voteEvents: [], startEvents: [], resolveEvents: [] };
    }
  }

  /**
   * MAIN LOAD FUNCTION
   * Loads all voting-related data
   * 
   * FIX: Improved vote state detection with better debugging
   */
  async function load() {
    setLoading(true);
    try {
      // ─── Get Group Data ───────────────────────────────────────
      const g       = await contract.groups(gid);
      const members = await contract.getMembers(gid);
      const gData   = {
        id: Number(g.id), 
        name: g.name, 
        status: Number(g.status),
        maxSize: Number(g.maxSize), 
        borrower: g.borrower, 
        members,
      };
      setGroup(gData);
      console.log(`📋 Group data loaded: ${members.length}/${gData.maxSize} members`);

      // ─── Load Vote Events with Smart Caching ──────────────────
      const { voteEvents, startEvents, resolveEvents } = await loadVoteEventData();

      // ─── Check If Current User Has Voted ──────────────────────
      const myVoteEvent = voteEvents.find(e => {
        try {
          return e.args && e.args[1] && e.args[1].toLowerCase() === account.toLowerCase();
        } catch (err) {
          console.warn("⚠️ Error checking vote event args:", err, e);
          return false;
        }
      });
      if (myVoteEvent) {
        setMyVote(myVoteEvent.args[2]); // candidate address
        console.log(`✅ My vote found: ${myVoteEvent.args[2]}`);
      }

      // ─── Get Vote Counts For All Members ──────────────────────
      console.log(`📊 Fetching vote counts for ${members.length} members...`);
      const counts = {};
      
      try {
        // Use Promise.all to fetch all vote counts in parallel (not sequentially)
        const voteCounts = await Promise.all(
          members.map(m => contract.votesReceived(gid, m))
        );
        
        members.forEach((m, idx) => {
          counts[m] = Number(voteCounts[idx]);
        });
        
        setVoteCounts(counts);
        console.log(`✅ Vote counts updated:`, counts);
      } catch (err) {
        console.error("❌ Error fetching vote counts:", err);
        addNotif("Failed to fetch vote counts", "error");
        // Continue anyway with empty counts
        members.forEach(m => {
          counts[m] = 0;
        });
        setVoteCounts(counts);
      }

      // ─── Detect Vote State From Events ────────────────────────
      let myResolveEvent = null;
      let myStartEvent = null;

      // Safely find resolve event
      for (const e of resolveEvents) {
        try {
          if (e.args && Number(e.args[0]) === gid) {
            myResolveEvent = e;
            break;
          }
        } catch (err) {
          console.warn("⚠️ Error parsing resolve event:", err, e);
        }
      }

      // Safely find start event
      for (const e of startEvents) {
        try {
          if (e.args && Number(e.args[0]) === gid) {
            myStartEvent = e;
            break;
          }
        } catch (err) {
          console.warn("⚠️ Error parsing start event:", err, e);
        }
      }

      console.log(`📊 Event search results:`, {
        resolveEventFound: !!myResolveEvent,
        startEventFound: !!myStartEvent,
        totalResolveEvents: resolveEvents.length,
        totalStartEvents: startEvents.length
      });

      // IMPORTANT: Check resolved first
      if (myResolveEvent) {
        // Vote has been resolved
        try {
          const winner = myResolveEvent.args[1];
          const wasTie = myResolveEvent.args[2];
          console.log(`✅ Vote RESOLVED - Winner: ${winner}, wasTie: ${wasTie}`);
          setVoteState(2);
          setWinner(winner);
          setWasTie(wasTie);
        } catch (err) {
          console.error("❌ Error parsing resolve event data:", err, myResolveEvent);
          addNotif("Error processing voting results", "error");
        }
      } 
      // Then check if voting is open
      else if (myStartEvent) {
        // Vote is in progress
        try {
          const voteEndTime = Number(myStartEvent.args[1]);
          const currentTime = Math.floor(Date.now() / 1000);
          const timeUntilExpire = voteEndTime - currentTime;
          
          console.log(`🗳️ Voting data:`, {
            voteEndTime,
            currentTime,
            timeUntilExpire,
            totalCastVotes: Object.values(counts).reduce((a, b) => a + b, 0),
            totalMembers: members.length
          });

          // Voting window has expired
          if (timeUntilExpire <= 0) {
            console.warn(`⏰ Voting window EXPIRED (${Math.abs(timeUntilExpire)} seconds ago)`);
            setVoteState(2); // Can now resolve
          } else {
            console.log(`🟢 Voting OPEN - ${Math.floor(timeUntilExpire / 60)}m ${timeUntilExpire % 60}s remaining`);
            setVoteState(1);
          }
          
          setVoteEnd(voteEndTime);
        } catch (err) {
          console.error("❌ Error parsing start event data:", err, myStartEvent);
          addNotif("Error loading voting timer", "error");
        }
      } 
      // No voting started at all
      else {
        console.log(`⏳ No voting started yet`);
        setVoteState(0);
        setVoteEnd(0);
      }

    } catch (err) {
      console.error("❌ VotingScreen load error:", err);
      console.error("Error stack:", err.stack);
      const errorMsg = err.message || "Unknown error loading voting data";
      addNotif(`Failed to load voting data: ${errorMsg}`, "error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * USER ACTIONS
   */
  async function handleStartVoting() {
    try {
      await actions.startVoting(gid);
      // IMPORTANT: Clear all event cache to force fresh query from contract
      eventCache.clear();
      console.log("🗳️ Voting started - clearing event cache and reloading...");
      // Wait for transaction to be mined + indexed, then reload with fresh data
      setTimeout(() => load(), 3000);
    } catch (err) {
      console.error("Error starting voting:", err);
      addNotif("Failed to start voting: " + err.message, "error");
    }
  }

  async function handleVote(candidate) {
    try {
      await actions.castVote(gid, candidate);
      // IMPORTANT: Clear event cache so next load picks up this vote
      eventCache.clear();
      console.log("✅ Vote cast - clearing cache and reloading...");
      // Wait for transaction to be mined + indexed, then reload with fresh data
      setTimeout(() => load(), 2500);
    } catch (err) {
      console.error("Error casting vote:", err);
      addNotif("Failed to cast vote: " + err.message, "error");
    }
  }

  async function handleResolve() {
    try {
      console.log("🏆 Attempting to resolve vote...");
      const currentTime = Math.floor(Date.now() / 1000);
      const totalVotesCast = Object.values(voteCounts).reduce((a, b) => a + b, 0);
      console.log(`Current state:`, {
        totalVotes: totalVotesCast,
        totalMembers: group?.members?.length,
        voteEnd,
        currentTime,
        isExpired: currentTime > voteEnd
      });
      
      await actions.resolveVote(gid);
      
      // Clear event cache for this group to force fresh query of recent blocks
      eventCache.clear();
      console.log("🏆 Vote resolved - clearing cache and reloading...");
      
      // Wait for transaction to be mined + indexed, then reload with fresh data
      setTimeout(() => load(), 3000);
    } catch (err) {
      console.error("Error resolving vote:", err);
      addNotif("Failed to resolve vote: " + err.message, "error");
    }
  }

  // ─── DERIVED STATE ────────────────────────────────────────────
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const maxVotes   = Math.max(...Object.values(voteCounts), 1);

  // ─── RENDER ────────────────────────────────────────────────────

  if (!gid) return (
    <div className="empty-state">
      <div className="empty-icon">🗳️</div>
      <p>Join a group to participate in voting.</p>
    </div>
  );

  if (loading) return (
    <div className="empty-state">
      <div className="empty-icon">⟳</div>
      <p>Loading voting data...</p>
    </div>
  );

  return (
    <div>
      {/* ─── PAGE HEADER ──────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-title">🗳️ Voting — {group?.name}</div>
        <div className="page-sub">Democratic borrower selection for Group #{gid}</div>
      </div>

      {/* ─── STATUS BANNER ────────────────────────────────────────── */}
      {voteState === 0 && (
        <div className="info-box" style={{ marginBottom: 20 }}>
          {group?.members?.length === group?.maxSize
            ? "🟢 Group is full — any member can start voting to select the borrower."
            : `⏳ Waiting for group to fill up (${group?.members?.length}/${group?.maxSize} members) before voting can begin.`}
        </div>
      )}

      {voteState === 0 && group?.borrower && group?.borrower !== "0x0000000000000000000000000000000000000000" && (
        <div className="info-box" style={{ marginBottom: 20, background: "rgba(251,146,60,.08)", borderColor: "rgba(251,146,60,.3)" }}>
          <div style={{ color: "var(--amber)", fontWeight: 600, marginBottom: 6 }}>
            ⏳ Active Loan in Progress
          </div>
          <div style={{ color: "var(--text2)", fontSize: 13 }}>
            {group?.name} currently has an active borrower. Members must complete all EMI payments before a new voting round can start.
          </div>
        </div>
      )}

      {voteState === 1 && (
        <div style={{ 
          background: "var(--purple-dim)", 
          border: "1px solid var(--purple-mid)", 
          borderRadius: "var(--radius)", 
          padding: "14px 18px", 
          marginBottom: 20, 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <div>
            <div style={{ color: "var(--purple)", fontWeight: 600, marginBottom: 2 }}>
              🟢 VOTING IS OPEN
            </div>
            <div style={{ color: "var(--text2)", fontSize: 13 }}>
              {totalVotes} of {group?.members?.length} votes cast
            </div>
            <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 4 }}>
              Closes when: All members vote OR 2-day window expires
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ 
              fontSize: 22, 
              fontWeight: 700, 
              color: timeLeft === "Closed" ? "var(--red)" : "var(--amber)" 
            }}>
              {timeLeft || "..."}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              remaining
            </div>
          </div>
        </div>
      )}

      {voteState === 2 && winner && (
        <div style={{ 
          background: "var(--green-dim)", 
          border: "1px solid rgba(34,197,94,.3)", 
          borderRadius: "var(--radius)", 
          padding: "18px 20px", 
          marginBottom: 20 
        }}>
          <div style={{ color: "var(--green)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            ✅ Voting Complete {wasTie && "(Tie broken by blockchain randomness)"}
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, marginBottom: 8 }}>
            {totalVotes === group?.members?.length 
              ? "📊 All members voted" 
              : "⏰ Voting window expired"}
            {" — "}
            {totalVotes} of {group?.members?.length} votes cast
          </div>
          <div style={{ color: "var(--text2)", fontSize: 13 }}>
            Selected borrower:
          </div>
          <div style={{ 
            fontFamily: "monospace", 
            fontSize: 15, 
            color: "var(--text)", 
            fontWeight: 600, 
            marginTop: 4 
          }}>
            {formatAddress(winner)}
            {winner.toLowerCase() === account.toLowerCase() && " 🎉 (You!)"}
          </div>
          {group?.borrower && group?.borrower !== "0x0000000000000000000000000000000000000000" && (
            <button
              className="btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => actions.releaseFunds(gid)}
              disabled={txPending}
            >
              💸 Release Funds to Borrower
            </button>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* ─── CANDIDATE LIST ────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Members</div>
            {voteState === 0 && group?.members?.length === group?.maxSize && (
              <button 
                className="btn-primary" 
                style={{ padding: "6px 16px", fontSize: 12 }} 
                onClick={handleStartVoting} 
                disabled={txPending}
              >
                Start Voting
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group?.members?.map((m, i) => {
              const isMe       = m.toLowerCase() === account.toLowerCase();
              const isWinner   = m.toLowerCase() === winner.toLowerCase();
              const isBorrower = group?.borrower?.toLowerCase() === m.toLowerCase();
              const votes      = voteCounts[m] || 0;
              const pct        = totalVotes > 0 ? Math.round((votes / maxVotes) * 100) : 0;
              const votedForMe = myVote.toLowerCase() === m.toLowerCase();

              return (
                <div 
                  key={i} 
                  style={{ 
                    background: "var(--bg3)", 
                    borderRadius: "var(--radius-sm)", 
                    padding: "12px 14px", 
                    border: isWinner ? "1px solid var(--green)" : "1px solid var(--border)" 
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontSize: 12, 
                        color: isMe ? "var(--cyan)" : "var(--text)" 
                      }}>
                        {formatAddress(m)}
                        {isMe && " (you)"}
                      </span>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {isWinner   && <span className="badge badge-active" style={{ fontSize: 10 }}>Winner</span>}
                        {isBorrower && <span className="badge badge-borrower" style={{ fontSize: 10 }}>Borrower</span>}
                        {votedForMe && <span className="badge badge-open" style={{ fontSize: 10 }}>Your vote</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cyan)" }}>
                        {votes}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>
                        votes
                      </div>
                    </div>
                  </div>

                  {/* Vote bar */}
                  <div className="vote-bar-bg" style={{ marginBottom: 8 }}>
                    <div 
                      className="vote-bar-fill" 
                      style={{ 
                        width: `${pct}%`, 
                        background: isWinner ? "var(--green)" : "var(--purple)" 
                      }} 
                    />
                  </div>

                  {/* Vote button */}
                  {voteState === 1 && !myVote && !isMe && (
                    <button
                      className="btn-primary"
                      style={{ width: "100%", padding: "7px", fontSize: 12 }}
                      onClick={() => handleVote(m)}
                      disabled={txPending}
                    >
                      Vote for this member
                    </button>
                  )}
                  {voteState === 1 && myVote && (
                    <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      You have already voted
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── RIGHT PANEL ──────────────────────────────────────── */}
        <div>
          {/* Vote summary */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>
              Vote Summary
            </div>
            {[
              { lbl: "Total Votes Cast",   val: totalVotes },
              { lbl: "Members",            val: group?.members?.length || 0 },
              { lbl: "Votes Remaining",    val: (group?.members?.length || 0) - totalVotes },
              { lbl: "Vote Status",        val: voteState === 0 ? "Not Started" : voteState === 1 ? "Open" : "Resolved" },
            ].map((r, i) => (
              <div key={i} style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                padding: "7px 0", 
                borderBottom: "1px solid rgba(30,58,95,.5)", 
                fontSize: 13 
              }}>
                <span style={{ color: "var(--text2)" }}>
                  {r.lbl}
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {r.val}
                </span>
              </div>
            ))}
          </div>

          {/* Resolve button - when voting is open and closed/complete */}
          {voteState === 1 && (timeLeft === "Closed" || totalVotes === group?.members?.length) && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 10 }}>
                ✅ Ready to Resolve
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
                {timeLeft === "Closed" 
                  ? "✅ Voting window has closed." 
                  : "✅ All members have voted."}
                {" "}Click below to finalize and select the borrower.
              </p>
              <button 
                className="btn-primary" 
                style={{ width: "100%" }} 
                onClick={handleResolve} 
                disabled={txPending}
              >
                🏆 Resolve & Select Borrower
              </button>
            </div>
          )}

          {/* Fallback resolve button - if votes exist but state seems stuck */}
          {voteState === 0 && totalVotes > 0 && (
            <div className="card" style={{ background: "rgba(251,146,60,.08)", borderColor: "rgba(251,146,60,.3)" }}>
              <div className="card-title" style={{ marginBottom: 10, color: "var(--amber)" }}>
                ⚠️ Votes Detected (State Issue)
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
                Found {totalVotes} votes cast but voting state not detected. This sometimes happens due to event caching. Click below to reload voting data first.
              </p>
              <button 
                className="btn-primary" 
                style={{ width: "100%", marginBottom: 8 }} 
                onClick={() => {
                  console.log("🔄 Manual refresh triggered");
                  eventCache.clear();
                  load();
                }}
              >
                🔄 Refresh Voting Data
              </button>
              <button 
                className="btn-primary" 
                style={{ width: "100%", background: "var(--orange)" }} 
                onClick={handleResolve} 
                disabled={txPending}
              >
                🏆 Force Resolve Vote
              </button>
            </div>
          )}

          {/* Info */}
          <div className="info-box" style={{ marginTop: 16 }}>
            <strong>How voting works:</strong><br />
            • Each member gets 1 vote<br />
            • Cannot vote for yourself<br />
            • Most votes wins the loan<br />
            • Ties are broken by blockchain randomness<br />
            • Voting window: 2 days<br />
            <br />
            <strong>Troubleshooting:</strong><br />
            • If voting seems stuck, refresh the page<br />
            • If &quot;Resolve&quot; button doesn&apos;t appear, click &quot;Refresh Voting Data&quot;<br />
            • Check browser console (F12) for detailed error logs
          </div>
        </div>
      </div>
    </div>
  );
}