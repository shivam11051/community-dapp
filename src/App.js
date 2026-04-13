import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./App.css";
import Logo from "./components/Logo";

// ─── ERROR BOUNDARY & CONTEXT ────────────────────────────────────
import ErrorBoundary from "./components/ErrorBoundary";
import { AppContextProvider, AppContext } from "./context/AppContext";

// ─── CONTRACT CONFIG ────────────────────────────────────────────
import { ADDRESS as CONTRACT_ADDRESS, ABI } from "./contracts/contractConfig";

// ─── UTILITIES ──────────────────────────────────────────────────
import { safeCall, safeTransaction } from "./utils/safeCall";

// ─── SCREENS ─────────────────────────────────────────────────────
import GroupDiscovery    from "./components/GroupDiscovery";
import CreateGroup       from "./components/CreateGroup";
import AdminDashboard    from "./components/AdminDashboard";
import MemberDashboard   from "./components/MemberDashboard";
import VotingScreen      from "./components/VotingScreen";
import EmergencyScreen   from "./components/EmergencyScreen";
import EMIScreen         from "./components/EMIScreen";
import TransactionHistory from "./components/TransactionHistory";
import KickScreen         from "./components/KickScreen";
import InvestorDashboard  from "./components/InvestorDashboard";
import LandingPage        from "./components/LandingPage";

// ─── NOTIFICATION TYPES ──────────────────────────────────────────
const NOTIF = {
  SUCCESS: "success",
  ERROR:   "error",
  INFO:    "info",
  WARNING: "warning",
  TX:      "tx",
};

// ════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ════════════════════════════════════════════════════════════════

function AppContent() {
  // ── Get context (contract, account, signer, provider, isAdmin)
  const { 
    contract, 
    account, 
    provider,
    signer,
    isAdmin, 
    loading: contextLoading,
    addNotif,
    removeNotif,
    initializeWeb3,
    disconnect,
  } = useContext(AppContext);

  // ── Navigation
  const [screen, setScreen] = useState("discovery");
  const [activeGroupId, setActiveGroupId] = useState(null);

  // ── Currency toggle
  const [currency, setCurrency] = useState("INR");

  // ── Global group state
  const [myGroupId, setMyGroupId] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [openGroups, setOpenGroups] = useState([]);
  const [pendingGroups, setPendingGroups] = useState([]);
  const [groupCache, setGroupCache] = useState({});

  // ── Loading states
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [chainId, setChainId] = useState(null);

  // ════════════════════════════════════════════════════════════════
  // LOAD GLOBAL STATE WHEN CONTRACT IS READY
  // ════════════════════════════════════════════════════════════════

  const listenersRef = useRef(false);

  useEffect(() => {
    if (contract && account && !contextLoading) {
      loadGlobalState();
      // Setup listeners only once per contract instance
      if (!listenersRef.current) {
        setupEventListeners();
        listenersRef.current = true;
      }
      getChainId();
    }

    // Cleanup listeners on unmount or when contract changes
    return () => {
      if (contract && listenersRef.current) {
        cleanupEventListeners();
        listenersRef.current = false;
      }
    };
  }, [contract, account, contextLoading]);

  /**
   * GET CURRENT CHAIN ID
   */
  async function getChainId() {
    try {
      if (!provider) return;
      const network = await provider.getNetwork();
      setChainId(network.chainId.toString());
    } catch (err) {
      console.error("Error getting chain ID:", err);
    }
  }

  /**
   * LOAD GLOBAL STATE
   * Gets all groups, user's group, open groups, pending groups
   */
  async function loadGlobalState() {
    if (!contract || !account) return;

    try {
      console.log("📊 Loading global state...");

      const result = await safeCall(
        async () => {
          const count = await contract.groupCount();
          const inGrp = await contract.inGroup(account);
          const myGid = inGrp ? Number(await contract.memberGroup(account)) : 0;
          const openIds = (await contract.getOpenGroups()).map(Number);
          const pendingIds = (await contract.getPendingGroups()).map(Number);

          return { count, myGid, openIds, pendingIds };
        },
        {
          fallback: { count: 0, myGid: 0, openIds: [], pendingIds: [] },
          label: "Load global state",
          timeout: 20000,
        }
      );

      const { count, myGid, openIds, pendingIds } = result;

      setGroupCount(Number(count));
      setMyGroupId(myGid);
      setOpenGroups(openIds);
      setPendingGroups(pendingIds);

      console.log(`✅ Global state loaded: ${count} groups, myGroupId=${myGid}`);

      // Load group data
      const toLoad = [...new Set([...openIds, ...(myGid ? [myGid] : [])])];
      const cache = {};

      for (const gid of toLoad) {
        const gdata = await loadGroupData(gid);
        if (gdata) cache[gid] = gdata;
      }

      setGroupCache(cache);

      // Auto-navigate to dashboard if user is in an active group
      if (myGid > 0) {
        const myGroup = cache[myGid];
        const status = myGroup ? myGroup.status : -1;
        setActiveGroupId(myGid);
        if (status > 0) {
          setScreen("dashboard");
        }
      }

    } catch (err) {
      console.error("❌ Error loading global state:", err);
    }
  }

  /**
   * LOAD SINGLE GROUP DATA
   */
  async function loadGroupData(gid) {
    if (!contract) return null;

    return await safeCall(
      async () => {
        const g = await contract.groups(gid);
        const members = await contract.getMembers(gid);

        return {
          id: Number(g.id),
          name: g.name,
          creator: g.creator,
          status: Number(g.status),
          contribution: g.contribution,
          maxSize: Number(g.maxSize),
          tenure: Number(g.tenure),
          fillDeadline: Number(g.fillDeadline),
          borrower: g.borrower,
          emergencyCount: Number(g.emergencyCount),
          kickCount: Number(g.kickCount),
          totalPool: g.totalPool,
          profitPool: g.profitPool,
          isPrivate: g.isPrivate ?? false,
          members,
          memberCount: members.length,
        };
      },
      {
        fallback: null,
        label: `Load group #${gid}`,
        timeout: 15000,
      }
    );
  }

  /**
   * REFRESH SINGLE GROUP
   */
  async function refreshGroup(gid) {
    if (!contract || !gid) return;
    const data = await loadGroupData(gid);
    if (data) {
      setGroupCache(prev => ({ ...prev, [gid]: data }));
    }
  }

  // ════════════════════════════════════════════════════════════════
  // EVENT LISTENERS WITH RATE LIMIT PROTECTION
  // ════════════════════════════════════════════════════════════════

  function setupEventListeners() {
    if (!contract || !account) return;

    console.log("🔊 Setting up event listeners (rate limit safe - staggered)...");

    // Define all listeners as tuples to attach with delays
    const listeners = [
      ["GroupApproved", (gid) => {
        addNotif(`✅ Group #${gid} approved by admin!`, NOTIF.SUCCESS);
        loadGlobalState();
      }],
      ["GroupRejected", (gid) => {
        addNotif(`❌ Group #${gid} was rejected.`, NOTIF.WARNING);
        loadGlobalState();
      }],
      ["MemberJoined", (gid, member) => {
        if (member.toLowerCase() !== account.toLowerCase()) {
          addNotif(`👥 New member joined Group #${gid}`, NOTIF.INFO);
        }
        refreshGroup(Number(gid));
      }],
      ["VotingStarted", (gid) => {
        addNotif(`🗳️ Voting started in Group #${gid}!`, NOTIF.INFO);
        refreshGroup(Number(gid));
      }],
      ["VoteCast", (gid, voter) => {
        if (voter.toLowerCase() !== account.toLowerCase()) {
          addNotif(`🗳️ A vote was cast in Group #${gid}`, NOTIF.INFO);
        }
      }],
      ["BorrowerSelected", (gid, borrower, wasTie) => {
        const msg = wasTie
          ? `Borrower selected by tiebreaker in Group #${gid}`
          : `Borrower selected by vote in Group #${gid}`;
        addNotif(msg, NOTIF.SUCCESS);
        refreshGroup(Number(gid));
      }],
      ["LoanReleased", (gid, borrower, amount) => {
        if (borrower.toLowerCase() === account.toLowerCase()) {
          addNotif(`💰 Loan of ${formatEther(amount)} ETH released to you!`, NOTIF.SUCCESS, 0);
        }
        refreshGroup(Number(gid));
      }],
      ["EMIPaid", (gid, borrower, amount, month, lateFee) => {
        const fee = Number(lateFee) > 0 ? ` (late fee: ${formatEther(lateFee)} ETH)` : "";
        addNotif(`✅ EMI #${month} paid in Group #${gid}${fee}`, NOTIF.INFO);
        refreshGroup(Number(gid));
      }],
      ["CreditUpdated", (gid, member, newScore) => {
        if (member.toLowerCase() === account.toLowerCase()) {
          addNotif(`⭐ Your credit score updated to ${newScore}`, NOTIF.INFO);
        }
      }],
      ["ProfitWithdrawn", (gid, member, amount) => {
        if (member.toLowerCase() === account.toLowerCase()) {
          addNotif(`💸 Profit of ${formatEther(amount)} ETH withdrawn!`, NOTIF.SUCCESS);
        }
      }],
      ["EmergencyRequested", (gid, rid, requester, amount, reason) => {
        if (requester.toLowerCase() !== account.toLowerCase()) {
          addNotif(`🚨 Emergency request in Group #${gid}: "${reason}"`, NOTIF.WARNING, 0);
        }
      }],
      ["EmergencyResolved", (gid, rid, approved) => {
        addNotif(
          `🚨 Emergency #${rid} in Group #${gid} ${approved ? "APPROVED" : "REJECTED"}`,
          approved ? NOTIF.SUCCESS : NOTIF.WARNING
        );
      }],
      ["EmergencyReleased", (gid, rid, requester, amount) => {
        if (requester.toLowerCase() === account.toLowerCase()) {
          addNotif(`💰 Emergency funds of ${formatEther(amount)} ETH sent to you!`, NOTIF.SUCCESS, 0);
        }
      }],
      ["KickRaised", (gid, kid, target) => {
        if (target.toLowerCase() === account.toLowerCase()) {
          addNotif(`⚠️ A kick request has been raised against you in Group #${gid}!`, NOTIF.ERROR, 0);
        } else {
          addNotif(`⚠️ Kick request raised in Group #${gid}`, NOTIF.WARNING);
        }
      }],
      ["KickResolved", (gid, kid, target, kicked) => {
        if (target.toLowerCase() === account.toLowerCase()) {
          addNotif(
            kicked
              ? `❌ You were removed from Group #${gid}`
              : `✅ Kick vote failed — you stay in Group #${gid}`,
            kicked ? NOTIF.ERROR : NOTIF.SUCCESS,
            0
          );
        }
      }],
    ];

    // Attach listeners with staggered delays to prevent rate limiting
    listeners.forEach(([eventName, handler], index) => {
      setTimeout(() => {
        try {
          contract.on(eventName, handler);
          console.log(`  ✓ Listener added: ${eventName}`);
        } catch (err) {
          // Silently fail - rate limit will be caught by user interaction
          console.warn(`  ⚠️ Listener failed: ${eventName}`, err.code);
        }
      }, index * 150); // 150ms stagger between each listener
    });
  }

  /**
   * CLEANUP EVENT LISTENERS
   * Prevents duplicate filters and rate limiting issues
   */
  function cleanupEventListeners() {
    if (!contract) return;
    try {
      contract.removeAllListeners();
      console.log("🔇 All event listeners removed");
    } catch (err) {
      console.warn("⚠️ Error cleaning listeners:", err.message);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // SAFE TX WRAPPER
  // ────────────────────────────────────────────────────────────────

  /**
   * Send transaction safely
   * - Checks network
   * - Shows loading
   * - Handles errors
   * - Refreshes state on success
   */
  async function sendTx(fn, successMsg, errorMsg) {
    // Network guard
    try {
      const network = await provider.getNetwork();
      const cid = network.chainId.toString();
      if (cid !== "11155111") {
        addNotif("⚠️ Wrong network! Please switch MetaMask to Sepolia testnet.", NOTIF.ERROR, 0);
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch (e) {
          console.log(e);
        }
        return false;
      }
    } catch (e) {
      console.log(e);
    }

    setTxPending(true);

    try {
      const receipt = await safeTransaction(fn(), {
        label: successMsg || "Transaction",
        confirmations: 1,
        timeout: 60000,
      });

      if (receipt) {
        const txHash = receipt?.hash;
        const etherscanUrl = txHash
          ? `https://sepolia.etherscan.io/tx/${txHash}`
          : null;
        addNotif(
          successMsg || "✅ Transaction confirmed!",
          NOTIF.SUCCESS,
          undefined,
          etherscanUrl
        );
        return true;
      } else {
        addNotif(errorMsg || "❌ Transaction failed", NOTIF.ERROR);
        return false;
      }
    } catch (err) {
      // Parse error message for better user feedback
      const errorMsg = err?.reason || err?.message || "Transaction failed";
      
      // Handle specific contract errors
      let userMsg = errorMsg;
      if (errorMsg.includes("E:28")) {
        userMsg = "❌ Voting is already in progress or completed. Please wait for it to resolve before starting a new vote.";
      } else if (errorMsg.includes("E:27")) {
        userMsg = "❌ Cannot start voting yet. A borrower is already selected with an active/pending loan. Complete all EMI payments first before starting a new voting round.";
      } else if (errorMsg.includes("E:37")) {
        userMsg = "❌ Borrower not set. Voting must be resolved first before releasing funds.";
      } else if (errorMsg.includes("E:29")) {
        userMsg = "❌ A loan is already active. Previous EMIs must be completed first.";
      } else if (errorMsg.includes("E:36")) {
        userMsg = "❌ Cannot resolve voting yet. Either wait for the voting window to close or all members must vote.";
      } else if (errorMsg.includes("E:31")) {
        userMsg = "❌ Voting is not open. Start voting first.";
      } else if (errorMsg.includes("E:32")) {
        userMsg = "❌ Voting period has ended. Click 'Resolve & Select Borrower' to finalize.";
      } else if (errorMsg.includes("E:33")) {
        userMsg = "❌ You have already voted in this round.";
      } else if (errorMsg.includes("E:34")) {
        userMsg = "❌ You cannot vote for yourself.";
      } else if (errorMsg.includes("E:35")) {
        userMsg = "❌ The candidate is not a member of this group.";
      } else if (errorMsg.includes("E:")) {
        // Other contract errors
        userMsg = `❌ Contract validation failed: ${errorMsg}`;
      } else if (errorMsg.includes("rate limited") || errorMsg.includes("429")) {
        userMsg = "⚠️ RPC provider rate limited. Please try again in a moment.";
      } else if (errorMsg.includes("reverted")) {
        userMsg = `❌ Transaction reverted: ${errorMsg}`;
      }
      
      addNotif(userMsg, NOTIF.ERROR);
      return false;
    } finally {
      setTxPending(false);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CONTRACT ACTIONS (passed to screens)
  // ════════════════════════════════════════════════════════════════

  const actions = {
    // ── Group
    createGroup: async (name, maxSize, tenure, ethAmount, isPrivate = false, invites = []) => {
      const ok = await sendTx(
        () => contract.createGroup(name, maxSize, tenure, isPrivate, invites, { value: parseEther(ethAmount) }),
        `✅ Group "${name}" created! Waiting for admin approval.`
      );
      if (ok) await loadGlobalState();
      return ok;
    },

    inviteMember: async (gid, invitee) => {
      return await sendTx(
        () => contract.inviteMember(gid, invitee),
        `✅ ${invitee.slice(0, 8)}... invited successfully!`
      );
    },

    revokeInvite: async (gid, invitee) => {
      return await sendTx(
        () => contract.revokeInvite(gid, invitee),
        "✅ Invite revoked."
      );
    },

    joinGroup: async (gid) => {
      const g = groupCache[gid];
      if (!g) return;
      const ok = await sendTx(
        () => contract.joinGroup(gid, { value: g.contribution }),
        `✅ Joined Group #${gid} successfully!`
      );
      if (ok) {
        await loadGlobalState();
        setActiveGroupId(gid);
        setScreen("dashboard");
      }
    },

    approveGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.approveGroup(gid),
        `✅ Group #${gid} approved!`
      );
      if (ok) await loadGlobalState();
    },

    rejectGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.rejectGroup(gid),
        `❌ Group #${gid} rejected.`
      );
      if (ok) await loadGlobalState();
    },

    expireGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.expireGroup(gid),
        `✅ Group #${gid} expired and members refunded.`
      );
      if (ok) await loadGlobalState();
    },

    // ── Voting
    startVoting: async (gid) => {
      const ok = await sendTx(
        () => contract.startVoting(gid),
        "✅ Voting started! Members can now cast their votes."
      );
      if (ok) await refreshGroup(gid);
    },

    castVote: async (gid, candidate) => {
      const ok = await sendTx(
        () => contract.castVote(gid, candidate),
        "✅ Your vote has been cast!"
      );
      if (ok) await refreshGroup(gid);
    },

    resolveVote: async (gid) => {
      const ok = await sendTx(
        () => contract.resolveVote(gid),
        "✅ Vote resolved! Borrower selected."
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Loan
    releaseFunds: async (gid) => {
      const ok = await sendTx(
        () => contract.releaseFunds(gid),
        "✅ Funds released to borrower!"
      );
      if (ok) await refreshGroup(gid);
    },

    payEMI: async (gid) => {
      const emi = await contract.getEMI(gid);
      const lateFee = await contract.getLateFee(gid);
      const total = emi + lateFee;
      const ok = await sendTx(
        () => contract.payEMI(gid, { value: total }),
        "✅ EMI paid successfully!"
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Profit
    withdrawAllProfit: async (gid) => {
      const ok = await sendTx(
        () => contract.withdrawAllProfit(gid),
        "✅ Full profit withdrawn!"
      );
      if (ok) await refreshGroup(gid);
    },

    withdrawPartialProfit: async (gid, amount) => {
      const ok = await sendTx(
        () => contract.withdrawPartialProfit(gid, parseEther(amount)),
        `✅ ${amount} ETH profit withdrawn!`
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Emergency
    raiseEmergency: async (gid, amount, reason) => {
      const ok = await sendTx(
        () => contract.raiseEmergency(gid, parseEther(amount), reason),
        "✅ Emergency request submitted!"
      );
      if (ok) await refreshGroup(gid);
    },

    voteEmergency: async (gid, rid, support) => {
      const ok = await sendTx(
        () => contract.voteEmergency(gid, rid, support),
        `✅ Vote ${support ? "YES" : "NO"} cast on emergency request.`
      );
      if (ok) await refreshGroup(gid);
    },

    resolveEmergency: async (gid, rid) => {
      const ok = await sendTx(
        () => contract.resolveEmergency(gid, rid),
        "✅ Emergency request resolved!"
      );
      if (ok) await refreshGroup(gid);
    },

    repayEmergency: async (gid, rid, amount) => {
      const ok = await sendTx(
        () => contract.repayEmergency(gid, rid, { value: parseEther(amount) }),
        "✅ Emergency loan repaid!"
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Kick
    raiseKick: async (gid, target) => {
      const ok = await sendTx(
        () => contract.raiseKick(gid, target),
        "✅ Kick request raised!"
      );
      if (ok) await refreshGroup(gid);
    },

    voteKick: async (gid, kid, support) => {
      const ok = await sendTx(
        () => contract.voteKick(gid, kid, support),
        "✅ Kick vote cast!"
      );
      if (ok) await refreshGroup(gid);
    },

    resolveKick: async (gid, kid) => {
      const ok = await sendTx(
        () => contract.resolveKick(gid, kid),
        "✅ Kick vote resolved!"
      );
      if (ok) await loadGlobalState();
    },

    // ── Leave group
    leaveGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.leaveGroup(gid),
        "✅ Left the group. Your contribution has been refunded."
      );
      if (ok) {
        await loadGlobalState();
        setScreen("discovery");
        setActiveGroupId(null);
      }
      return ok;
    },

    // ── Mark missed EMI (can be called by anyone)
    checkAndMarkMissed: async (gid) => {
      return await sendTx(
        () => contract.checkAndMarkMissed(gid),
        "✅ Missed EMI marked on-chain."
      );
    },

    // ── Admin
    pause: async () => {
      return await sendTx(() => contract.pause(), "✅ Contract paused successfully.");
    },

    unpause: async () => {
      return await sendTx(() => contract.unpause(), "✅ Contract unpaused — operations resumed.");
    },
  };

  // ── View helpers (read-only)
  const views = {
    getCreditScore: (gid, addr) => contract?.getCreditScore(gid, addr),
    getMemberInfo: (gid, addr) => contract?.getMemberInfo(gid, addr),
    getTrustScore: (gid, addr) => contract?.getTrustScore(gid, addr),
    getGroupMetrics: (gid) => contract?.getGroupMetrics(gid),
    getGroupHealth: (gid) => contract?.getGroupHealth(gid),
    getGroupROI: (gid) => contract?.getGroupROI(gid),
    getEMI: (gid) => contract?.getEMI(gid),
    getEMIinINR: (gid) => contract?.getEMIinINR(gid),
    getLateFee: (gid) => contract?.getLateFee(gid),
    getNextDueTime: (gid) => contract?.getNextDueTime(gid),
    getRemainingMonths: (gid) => contract?.getRemainingMonths(gid),
    getProfitBalance: (gid, addr) => contract?.getProfitBalance(gid, addr),
    getVotesFor: (gid, addr) => contract?.votesReceived(gid, addr),
    hasVoted: (gid, addr) => contract?.hasVoted(gid, addr),
    getEmergencyReq: (gid, rid) => contract?.emergencyRequests(gid, rid),
    getKickReq: (gid, kid) => contract?.kickRequests(gid, kid),
    getActiveEmergency: (addr) => contract?.activeEmergencyGroup(addr),
    getActiveKick: (gid, addr) => contract?.activeKick(gid, addr),
    queryEvents: (eventName, filter) => contract?.queryFilter(eventName, filter),
    getMyInvites: () => contract?.getMyInvites(account),
    getMyPrivateInvites: () => contract?.getMyPrivateInvites(account),
    isInvited: (gid, addr) => contract?.isInvited(gid, addr),
  };

  // ════════════════════════════════════════════════════════════════
  // SHARED PROPS FOR ALL SCREENS
  // ════════════════════════════════════════════════════════════════

  const sharedProps = {
    contract,
    account,
    isAdmin,
    currency,
    myGroupId,
    activeGroupId,
    groupCache,
    openGroups,
    pendingGroups,
    txPending,
    actions,
    views,
    navigate: (screen, gid) => {
      if (gid !== undefined) setActiveGroupId(gid);
      setScreen(screen);
    },
    refreshGroup,
    loadGlobalState,
    addNotif,
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  const networkName =
    chainId === "11155111"
      ? "Sepolia"
      : chainId === "1"
      ? "Mainnet"
      : chainId
      ? `Chain ${chainId}`
      : "";

  return (
    <div className="app">
      {/* ── TOPBAR ─────────────────────────────────────────────── */}
      <div className="topbar">
        <div className="logo-wrap" onClick={() => setScreen("discovery")}>
          <div className="logo-mark">
            <Logo size={36} />
          </div>
          <div className="logo-text">
            <span className="lo-b">Block</span>
            <span className="lo-c">Chit</span>
          </div>
        </div>

        <div className="topbar-center">
          {account && (
            <nav className="top-nav">
              <button
                className={`nav-btn ${screen === "discovery" ? "active" : ""}`}
                onClick={() => setScreen("discovery")}
              >
                Discover
              </button>
              <button
                className={`nav-btn ${screen === "create" ? "active" : ""}`}
                onClick={() => setScreen("create")}
              >
                Create Group
              </button>
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "dashboard" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("dashboard");
                  }}
                >
                  My Group
                </button>
              )}
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "voting" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("voting");
                  }}
                >
                  Vote
                </button>
              )}
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "emergency" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("emergency");
                  }}
                >
                  Emergency
                </button>
              )}
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "kick" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("kick");
                  }}
                >
                  ⚠ Kick
                </button>
              )}
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "emi" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("emi");
                  }}
                >
                  EMI
                </button>
              )}
              {myGroupId > 0 && (
                <button
                  className={`nav-btn ${screen === "history" ? "active" : ""}`}
                  onClick={() => {
                    setActiveGroupId(myGroupId);
                    setScreen("history");
                  }}
                >
                  History
                </button>
              )}
              <button
                className={`nav-btn ${screen === "investor" ? "active" : ""}`}
                onClick={() => setScreen("investor")}
              >
                📊 Invest
              </button>
              {isAdmin && (
                <button
                  className={`nav-btn admin-btn ${screen === "admin" ? "active" : ""}`}
                  onClick={() => setScreen("admin")}
                >
                  ⚙ Admin
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="topbar-right">
          {account && (
            <button className="currency-toggle" onClick={() => setCurrency(c => (c === "INR" ? "ETH" : "INR"))}>
              {currency === "INR" ? "₹ INR" : "Ξ ETH"}
            </button>
          )}
          {networkName && (
            <div className="network-badge">
              <div
                className={`dot ${
                  networkName === "Sepolia" ? "dot-green" : "dot-amber"
                }`}
              />
              {networkName}
            </div>
          )}
          {!account ? (
            <button
              className="btn-connect"
              disabled={contextLoading}
              onClick={initializeWeb3}
            >
              {contextLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div className="wallet-chip" title="Click to disconnect" style={{ cursor: "pointer" }} onClick={disconnect}>
              <div className="dot dot-green" />
              {account.slice(0, 6)}...{account.slice(-4)}
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>✕</span>
            </div>
          )}
        </div>
      </div>

      {/* ── WRONG NETWORK BANNER ──────────────────────────────── */}
      {account && chainId && chainId !== "11155111" && (
        <div className="wrong-network-banner">
          <span>
            ⚠ Wrong Network — You are on{" "}
            {chainId === "1" ? "Ethereum Mainnet" : `Chain ${chainId}`}. Transactions
            will fail and cost REAL ETH.
          </span>
          <button
            onClick={async () => {
              try {
                await window.ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: "0xaa36a7" }],
                });
              } catch {
                addNotif("Switch to Sepolia manually in MetaMask.", "error");
              }
            }}
          >
            Switch to Sepolia
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────── */}
      <div className="main">
        {!account ? (
          /* ── LANDING ─────────────────────────────────────────── */
          <LandingPage
            contextLoading={contextLoading}
            initializeWeb3={initializeWeb3}
            CONTRACT_ADDRESS={CONTRACT_ADDRESS}
          />
        ) : (
          /* ── SCREENS ─────────────────────────────────────────── */
          <>
            {screen === "discovery" && <GroupDiscovery {...sharedProps} />}
            {screen === "create" && <CreateGroup {...sharedProps} />}
            {screen === "admin" && <AdminDashboard {...sharedProps} />}
            {screen === "dashboard" && <MemberDashboard {...sharedProps} />}
            {screen === "voting" && <VotingScreen {...sharedProps} />}
            {screen === "emergency" && <EmergencyScreen {...sharedProps} />}
            {screen === "kick" && <KickScreen {...sharedProps} />}
            {screen === "emi" && <EMIScreen {...sharedProps} />}
            {screen === "history" && <TransactionHistory {...sharedProps} />}
            {screen === "investor" && <InvestorDashboard {...sharedProps} />}
            {screen === "invites" && (
              <GroupDiscovery {...sharedProps} showInvitesOnly={true} />
            )}
          </>
        )}
      </div>

      {/* ── TX OVERLAY ─────────────────────────────────────────── */}
      {txPending && (
        <div className="tx-overlay">
          <div className="tx-spinner" />
          <p>Confirm in MetaMask...</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN APP WITH ERROR BOUNDARY & CONTEXT PROVIDER
// ════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <ErrorBoundary>
      <AppContextProvider>
        <AppContent />
      </AppContextProvider>
    </ErrorBoundary>
  );
}