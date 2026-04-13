/**
 * PASTE LOCATION: src/context/AppContext.js
 * Replace the entire existing file.
 *
 * Production fixes:
 *  1. Admin fallback used contract.owner() which doesn't exist → now uses contract.admin()
 *  2. Added proper MetaMask-not-installed handling (no silent failure)
 *  3. addNotif is now stable (no re-render loop risk)
 *  4. Exposes disconnect() so the wallet chip can have a working onClick
 */

import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { ADDRESS, ABI } from "../contracts/contractConfig";

export const AppContext = createContext();

export function AppContextProvider({ children }) {
  const [contract,      setContract]      = useState(null);
  const [account,       setAccount]       = useState(null);
  const [provider,      setProvider]      = useState(null);
  const [signer,        setSigner]        = useState(null);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Use a ref so addNotif is stable across renders without needing useCallback deps
  const notifIdRef = useRef(0);

  const addNotif = useCallback((message, type = "info", duration = 4000) => {
    const id = ++notifIdRef.current;
    setNotifications(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // ── Connect / initialize ──────────────────────────────────────
  async function initializeWeb3() {
    setLoading(true);
    try {
      if (!window.ethereum) {
        addNotif(
          "MetaMask not found. Install it from metamask.io to use BlockChit.",
          "error",
          0 // persistent until dismissed
        );
        setLoading(false);
        return;
      }

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts.length) {
        addNotif("No accounts returned from MetaMask.", "error");
        setLoading(false);
        return;
      }

      const userAccount = accounts[0];
      setAccount(userAccount);

      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);

      const s = await p.getSigner();
      setSigner(s);

      const c = new ethers.Contract(ADDRESS, ABI, s);
      setContract(c);

      addNotif(
        `Connected: ${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`,
        "success"
      );

      // ── Check admin status ──────────────────────────────────
      // Strategy: try backend first (faster, no RPC call), fall back to chain.
      let adminResolved = false;

      try {
        const res  = await fetch(
          `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001"}/api/admin/check/${userAccount}`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin);
          adminResolved = true;
          if (data.isAdmin) addNotif("Admin mode enabled.", "success");
        }
      } catch {
        // Backend unreachable — fall through to on-chain check
      }

      if (!adminResolved) {
        try {
          const onChainAdmin = await c.admin();
          const userIsAdmin  = onChainAdmin.toLowerCase() === userAccount.toLowerCase();
          setIsAdmin(userIsAdmin);
          if (userIsAdmin) addNotif("Admin mode enabled (on-chain).", "success");
        } catch (e) {
          console.error("Could not fetch admin status from contract:", e.message);
          addNotif("⚠️ Could not verify admin status. Defaulting to user mode.", "warning");
          setIsAdmin(false);
        }
      }

      // ── Listen for wallet/chain changes ──────────────────────
      window.ethereum.removeAllListeners?.("accountsChanged");
      window.ethereum.removeAllListeners?.("chainChanged");

      window.ethereum.on("accountsChanged", (newAccounts) => {
        if (newAccounts.length === 0) {
          // User disconnected all accounts
          setAccount(null);
          setContract(null);
          setSigner(null);
          setIsAdmin(false);
          addNotif("Wallet disconnected.", "info");
        } else {
          addNotif("Account changed — reloading.", "info");
          window.location.reload();
        }
      });

      window.ethereum.on("chainChanged", () => {
        addNotif("Network changed — reloading.", "info");
        window.location.reload();
      });

    } catch (err) {
      // User rejected MetaMask prompt or other error
      const msg = err.code === 4001
        ? "Connection cancelled — you rejected the MetaMask prompt."
        : `Failed to connect: ${err.message}`;
      addNotif(msg, "error");
      console.error("Web3 init error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Disconnect ────────────────────────────────────────────────
  function disconnect() {
    setAccount(null);
    setContract(null);
    setSigner(null);
    setProvider(null);
    setIsAdmin(false);
    addNotif("Disconnected.", "info");
    // MetaMask doesn't support programmatic disconnect via eth_requestAccounts
    // revocation — user must disconnect in MetaMask itself. We clear local state.
  }

  useEffect(() => {
    // Auto-connect if MetaMask already has permission (no popup)
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) {
            initializeWeb3();
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    contract,
    account,
    provider,
    signer,
    isAdmin,
    loading,
    notifications,
    addNotif,
    removeNotif,
    initializeWeb3,
    disconnect,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;