/**
 * routes/users.js - v3.0 Production
 *
 * Full user profile API:
 *   GET  /api/users/:address         - Get user profile
 *   POST /api/users/:address         - Upsert user profile
 *   GET  /api/users/:address/credit  - Get credit history
 *   GET  /api/users/:address/groups  - Get groups this user is/was in
 */

const express = require("express");
const router  = express.Router();
const { ethers } = require("ethers");
const User    = require("../models/User");
const Event   = require("../models/Event");
const logger  = require("../utils/logger");

// Helper: validate address
function validateAddress(req, res) {
  const { address } = req.params;
  if (!ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid Ethereum address" });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/users/:address
// ─────────────────────────────────────────────────────────────────
router.get("/:address", async (req, res) => {
  if (!validateAddress(req, res)) return;

  try {
    const { address } = req.params;
    const normalized  = address.toLowerCase();

    let user = await User.findOne({ address: normalized }).lean();

    if (!user) {
      // Return a default profile if user not yet in DB
      return res.json({
        status: "✅",
        data: {
          address:        normalized,
          creditScore:    100,
          trustScore:     100,
          totalGroups:    0,
          activeGroup:    null,
          onTimePayments: 0,
          latePayments:   0,
          missedPayments: 0,
          joinedAt:       null,
          exists:         false,
        },
      });
    }

    res.json({ status: "✅", data: { ...user, exists: true } });
  } catch (error) {
    logger.error(`GET /users/${req.params.address} error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/users/:address  — upsert profile (called by backend sync)
// ─────────────────────────────────────────────────────────────────
router.post("/:address", async (req, res) => {
  if (!validateAddress(req, res)) return;

  try {
    const { address } = req.params;
    const normalized  = address.toLowerCase();
    const updates     = req.body;

    // Whitelist fields that can be updated
    const allowed = [
      "creditScore", "trustScore", "totalGroups", "activeGroup",
      "onTimePayments", "latePayments", "missedPayments",
      "investmentProfile", "lastSeen",
    ];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { address: normalized },
      {
        $set: { ...filtered, address: normalized, updatedAt: new Date() },
        $setOnInsert: { joinedAt: new Date() },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    res.json({ status: "✅", data: user });
  } catch (error) {
    logger.error(`POST /users/${req.params.address} error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/users/:address/credit  — EMI payment history from events
// ─────────────────────────────────────────────────────────────────
router.get("/:address/credit", async (req, res) => {
  if (!validateAddress(req, res)) return;

  try {
    const { address } = req.params;
    const normalized  = address.toLowerCase();

    const events = await Event.find({
      eventType: { $in: ["EMIPaid", "EMIMissed", "CreditUpdated"] },
      "data.borrower": { $regex: new RegExp(`^${normalized}$`, "i") },
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const emiPaid   = events.filter(e => e.eventType === "EMIPaid");
    const emiMissed = events.filter(e => e.eventType === "EMIMissed");

    res.json({
      status: "✅",
      data: {
        address:       normalized,
        totalPaid:     emiPaid.length,
        totalMissed:   emiMissed.length,
        history:       events,
      },
    });
  } catch (error) {
    logger.error(`GET /users/${req.params.address}/credit error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/users/:address/groups  — groups this address participated in
// ─────────────────────────────────────────────────────────────────
router.get("/:address/groups", async (req, res) => {
  if (!validateAddress(req, res)) return;

  try {
    const { address } = req.params;
    const normalized  = address.toLowerCase();

    // Find all MemberJoined events for this address
    const joinEvents = await Event.find({
      eventType: "MemberJoined",
      "data.member": { $regex: new RegExp(`^${normalized}$`, "i") },
    }).lean();

    const groupIds = [...new Set(joinEvents.map(e => e.gid))];

    res.json({
      status: "✅",
      data: {
        address:  normalized,
        groupIds,
        count:    groupIds.length,
      },
    });
  } catch (error) {
    logger.error(`GET /users/${req.params.address}/groups error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
