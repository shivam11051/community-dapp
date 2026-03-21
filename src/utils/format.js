/**
 * FORMATTING UTILITIES
 * ─────────────────────────────────────────────
 * Helper functions to format blockchain data
 * for human-readable display
 */

import { formatEther } from "ethers";

/**
 * Format BigNumber/wei to ETH string
 * @param {BigNumber|string|number} wei - Amount in wei
 * @returns {string} - Formatted ETH amount with 6 decimals
 * 
 * Example:
 * formatETH("1000000000000000000") → "1.000000"
 * formatETH(BigNumber.from("500000000000000000")) → "0.500000"
 */
export const formatETH = (wei) => {
  try {
    if (!wei) return "0.000000";
    const eth = formatEther(wei);
    return parseFloat(eth).toFixed(6);
  } catch (error) {
    console.warn("Error formatting ETH:", error);
    return "0.000000";
  }
};

/**
 * Convert ETH amount to INR (Indian Rupees)
 * @param {string|number} eth - Amount in ETH
 * @returns {string} - Formatted INR with commas, no decimals
 * 
 * Example:
 * formatINR("1") → "500,000"
 * formatINR("0.5") → "250,000"
 */
export const formatINR = (eth) => {
  try {
    const ethNum = parseFloat(eth || 0);
    const inrAmount = ethNum * 500000; // 1 ETH = 500,000 INR (approximate)
    return inrAmount.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
  } catch (error) {
    console.warn("Error formatting INR:", error);
    return "0";
  }
};

/**
 * Format currency based on preference
 * @param {BigNumber|string|number} wei - Amount in wei
 * @param {string} currency - "ETH" or "INR"
 * @returns {string} - Formatted amount with symbol
 * 
 * Example:
 * formatCurrency("1000000000000000000", "ETH") → "1.000000 ETH"
 * formatCurrency("1000000000000000000", "INR") → "₹500,000"
 */
export const formatCurrency = (wei, currency = "ETH") => {
  const eth = formatETH(wei);
  if (currency === "INR") {
    const inr = formatINR(eth);
    return `₹${inr}`;
  }
  return `${eth} ETH`;
};

/**
 * Shorten Ethereum address for display
 * @param {string} address - Full address (0x...)
 * @param {number} start - Characters to show at start (default 6)
 * @param {number} end - Characters to show at end (default 4)
 * @returns {string} - Shortened address
 * 
 * Example:
 * formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f...") 
 * → "0x742d...595f"
 */
export const formatAddress = (address, start = 6, end = 4) => {
  if (!address || address.length < start + end) {
    return address || "—";
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

/**
 * Format Unix timestamp to readable date
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted date (e.g., "01/03/2026")
 * 
 * Example:
 * formatDate(1708300800) → "18/02/2024"
 */
export const formatDate = (timestamp) => {
  if (!timestamp || timestamp === 0) return "—";
  try {
    return new Date(timestamp * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (error) {
    return "—";
  }
};

/**
 * Format Unix timestamp to readable time
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted time (e.g., "14:30:45")
 * 
 * Example:
 * formatTime(1708300800) → "19:30:00"
 */
export const formatTime = (timestamp) => {
  if (!timestamp || timestamp === 0) return "—";
  try {
    return new Date(timestamp * 1000).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    return "—";
  }
};

/**
 * Calculate time remaining from now until timestamp
 * Returns breakdown of days, hours, minutes, seconds
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {object} - { days, hours, minutes, seconds }
 * 
 * Example:
 * getCountdown(Date.now()/1000 + 86400 + 3600)
 * → { days: 1, hours: 1, minutes: 0, seconds: 0 }
 */
export const getCountdown = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, timestamp - now);

  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
};

/**
 * Format countdown as human-readable string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - e.g., "2 days, 3 hours"
 * 
 * Example:
 * formatCountdown(Date.now()/1000 + 172800) → "2 days"
 */
export const formatCountdown = (timestamp) => {
  const { days, hours, minutes } = getCountdown(timestamp);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return "Less than 1 minute";
};

/**
 * Format percentage value
 * @param {number} value - Decimal value (0-1) or percentage (0-100)
 * @param {boolean} isDecimal - If true, multiplies by 100
 * @returns {string} - Percentage string (e.g., "75.5%")
 * 
 * Example:
 * formatPercent(0.755) → "75.5%"
 * formatPercent(75.5, false) → "75.5%"
 */
export const formatPercent = (value, isDecimal = true) => {
  const num = isDecimal ? value * 100 : value;
  return `${num.toFixed(1)}%`;
};

/**
 * Format large numbers with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted number (e.g., "1,234,567")
 * 
 * Example:
 * formatNumber(1234567) → "1,234,567"
 */
export const formatNumber = (num) => {
  try {
    return num.toLocaleString("en-IN");
  } catch {
    return String(num);
  }
};