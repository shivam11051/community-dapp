/**
 * routes/admin.js - v3.0 Production
 *
 * Admin verification now uses ethers.verifyMessage() signature check
 * instead of a plain string comparison (which was bypassable).
 */

const express = require("express");
const router  = express.Router();
const { ethers } = require("ethers");
const logger  = require("../utils/logger");

const ADMIN_ADDRESS = (process.env.ADMIN_ADDRESS || "0xfe6fdb2d1b213400272fa50f993d9c61bb885ac0").toLowerCase();

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/check/:address
// Simple read-only check — no auth needed (just tells the frontend
// if an address is admin, which is also readable from contract.admin())
// ─────────────────────────────────────────────────────────────────
router.get("/check/:address", (req, res) => {
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
// ─────────────────────────────────────────────────────────────────
router.post("/verify", (req, res) => {
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
      logger.warn(`Failed admin verification attempt from ${address} (recovered: ${recovered})`);
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
// ─────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;