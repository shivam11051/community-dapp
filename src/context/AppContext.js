/**
 * APP CONTEXT - GLOBAL STATE MANAGEMENT
 * 
 * Remove prop drilling by providing global access to:
 * - contract (ethers.Contract instance)
 * - account (user's wallet address)
 * - signer (for signing transactions)
 * - provider (ethers provider)
 * - isAdmin (is user the contract owner?)
 * - loading (is web3 initializing?)
 * - notifications (toast messages)
 * - addNotif (function to add notification)
 * 
 * USAGE IN ANY COMPONENT:
 * ────────────────────────────────────────
 * import { useContext } from "react";
 * import { AppContext } from "../context/AppContext";
 * 
 * function MyComponent() {
 *   const { contract, account, addNotif } = useContext(AppContext);
 *   
 *   // Now use contract, account directly!
 *   // No prop drilling needed!
 * }
 */

import { createContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESS, ABI } from "../contracts/contractConfig";

// ─── CREATE CONTEXT ───────────────────────────────────────────
export const AppContext = createContext();

// ─── CONTEXT PROVIDER ─────────────────────────────────────────
export function AppContextProvider({ children }) {
  
  // State variables
  const [contract, setContract]   = useState(null);
  const [account, setAccount]     = useState(null);
  const [provider, setProvider]   = useState(null);
  const [signer, setSigner]       = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [notifications, setNotifications] = useState([]);

  // ─── NOTIFICATION SYSTEM (MOVE HERE - BEFORE initializeWeb3) ──
  /**
   * ADD NOTIFICATION
   * Shows a toast message to user
   * Auto-removes after duration
   */
  const addNotif = useCallback((message, type = "info", duration = 3000) => {
    const id = Date.now();
    const notif = { id, message, type };
    
    // Add notification to list
    setNotifications(prev => [...prev, notif]);
    
    // Log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Auto-remove after duration
    const timeout = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);

    return () => clearTimeout(timeout);
  }, []);

  /**
   * REMOVE NOTIFICATION
   * Manually remove a notification by ID
   */
  const removeNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // ─── INITIALIZE WEB3 ON MOUNT ─────────────────────────────
  useEffect(() => {
    initializeWeb3();
  }, [addNotif]); // ← Add addNotif as dependency

  /**
   * INITIALIZE WEB3
   * Connects to MetaMask and initializes contract
   */
  async function initializeWeb3() {
    try {
      console.log("🔌 Initializing Web3...");

      // Check if MetaMask is available
      if (!window.ethereum) {
        console.warn("⚠️ MetaMask not installed");
        addNotif("MetaMask not found. Please install it.", "error");
        setLoading(false);
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      
      const userAccount = accounts[0];
      setAccount(userAccount);
      console.log(`✅ Connected account: ${userAccount}`);
      addNotif(`Connected: ${userAccount.slice(0,6)}...${userAccount.slice(-4)}`, "success");

      // Create provider (read-only connection to blockchain)
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);
      console.log("✅ Provider initialized");

      // Create signer (for signing transactions)
      const s = await p.getSigner();
      setSigner(s);
      console.log("✅ Signer initialized");

      // Create contract instance (with signer for write operations)
      const c = new ethers.Contract(ADDRESS, ABI, s);
      setContract(c);
      console.log(`✅ Contract initialized at ${ADDRESS}`);

      // ─── CHECK IF USER IS ADMIN (FROM BACKEND API) ──────────────
      console.log("🔍 Checking admin status from backend...");
      console.log("📍 Backend URL: http://localhost:5001/api/admin/check/" + userAccount);

      try {
        const response = await fetch(
          `http://localhost:5001/api/admin/check/${userAccount}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );
        
        console.log(`📊 Backend response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        console.log(`✅ Admin status: ${data.isAdmin ? "YES ✓" : "NO ✗"}`);
        
        if (data.isAdmin) {
          addNotif("👑 Admin mode enabled", "success");
        }
        
      } catch (err) {
        console.warn("⚠️ Backend check failed, falling back to contract check...", err.message);
        addNotif("Backend unavailable, using contract fallback", "warning");
        
        // Fallback: Check contract owner if backend fails
        try {
          const owner = await c.owner();
          const userIsAdmin = owner.toLowerCase() === userAccount.toLowerCase();
          setIsAdmin(userIsAdmin);
          console.log(`🔑 Admin (from contract): ${userIsAdmin ? "YES" : "NO"}`);
          
          if (userIsAdmin) {
            addNotif("👑 Admin mode enabled (contract)", "success");
          }
        } catch (e) {
          console.warn("⚠️ Could not fetch owner:", e.message);
          setIsAdmin(false);
        }
      }

      // Listen for account changes
      window.ethereum.on("accountsChanged", (newAccounts) => {
        if (newAccounts.length > 0) {
          console.log(`🔄 Account changed to: ${newAccounts[0]}`);
          setAccount(newAccounts[0]);
          addNotif("Account changed, reloading...", "info");
          window.location.reload(); // Reload to reset state
        }
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", () => {
        console.log("🔄 Chain changed, reloading...");
        addNotif("Chain changed, reloading...", "info");
        window.location.reload();
      });

    } catch (err) {
      console.error("❌ Web3 initialization error:", err);
      addNotif("Failed to connect wallet: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ─── CONTEXT VALUE ────────────────────────────────────────
  const value = {
    // Web3 connections
    contract,
    account,
    provider,
    signer,
    isAdmin,
    
    // Loading state
    loading,
    
    // Notifications
    notifications,
    addNotif,
    removeNotif,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;