const express = require("express");
const router  = express.Router();
const { ethers } = require("ethers");
const rateLimit = require("express-rate-limit");
const logger  = require("../utils/logger");

const ADMIN_ADDRESS = (process.env.ADMIN_ADDRESS || "0xfe6fdb2d1b213400272fa50f993d9c61bb885ac0").toLowerCase();

// ─── Rate limiters ───────────────────────────────────────────────
// Admin check: 50 per 15 min (read-only, low risk)
const adminCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many admin checks, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Log excessive attempts
    if (req.rateLimit && req.rateLimit.current >= req.rateLimit.limit - 5) {
      logger.warn(`⚠️ Admin check rate limit approaching for IP: ${req.ip}`);
    }
    return false;
  }
});

// Admin verify: 5 per 15 min (auth endpoint, HIGH RISK - stricter limit)
const adminVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many verification attempts. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Log all verification attempts
    if (req.rateLimit) {
      const remaining = req.rateLimit.limit - req.rateLimit.current;
      if (remaining <= 2) {
        logger.warn(`🔒 Admin verify: ${remaining} attempts remaining for IP: ${req.ip}`);
      }
    }
    return false;
  }
});

// Admin stats: 20 per 15 min (informational, medium risk)
const adminStatsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many stats requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/check/:address
// Simple read-only check — no auth needed (just tells the frontend
// if an address is admin, which is also readable from contract.admin())
// ─────────────────────────────────────────────────────────────────
router.get("/check/:address", adminCheckLimiter, (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    const isAdmin = address.toLowerCase() === ADMIN_ADDRESS;
    logger.info(`Admin check for ${address}: ${isAdmin}`);

    res.json({
      status:    "✅",
      address,
      isAdmin,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/verify
// Verifies a signed message to confirm the caller is the admin.
// Body: { address, signature, message }
// STRICT rate limit: 5 per 15 min (authentication endpoint)
// ─────────────────────────────────────────────────────────────────
router.post("/verify", adminVerifyLimiter, (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ error: "address, signature, and message required" });
    }
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Recover the signer from the signature
    const recovered = ethers.verifyMessage(message, signature);
    const isAdmin   = recovered.toLowerCase() === ADMIN_ADDRESS;

    if (!isAdmin) {
      logger.warn(`❌ Failed admin verification attempt from ${address} (recovered: ${recovered})`);
      return res.status(403).json({ error: "Signature does not match admin address" });
    }

    logger.info(`✅ Admin verified: ${address}`);
    res.json({ status: "✅", verified: true, address });
  } catch (error) {
    logger.error(`Admin verify error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Returns aggregated statistics (read-only, doesn't require auth)
// Rate limit: 20 per 15 min
// ─────────────────────────────────────────────────────────────────
router.get("/stats", adminStatsLimiter, async (req, res) => {
  try {
    const Group = require("../models/Group");
    const Event = require("../models/Event");
    const User  = require("../models/User");

    const [totalGroups, activeGroups, totalEvents, totalUsers] = await Promise.all([
      Group.countDocuments(),
      Group.countDocuments({ status: 2 }),
      Event.countDocuments(),
      User.countDocuments(),
    ]);

    res.json({
      status: "✅",
      data: {
        totalGroups,
        activeGroups,
        totalEvents,
        totalUsers,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error(`Admin stats error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;