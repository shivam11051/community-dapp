const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const contractService = require("../services/contractService");
const logger = require("../utils/logger");

// ─────────────────────────────────────────────
// GET all groups
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, sort = "-createdAt", limit = 50, skip = 0 } = req.query;

    let query = Group.find();

    if (status !== undefined) {
      query = query.where("status").equals(Number(status));
    }

    const total = await Group.countDocuments(query.getFilter());
    const groups = await query
      .sort(sort)
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    res.json({
      status: "✅",
      count: groups.length,
      total,
      data: groups,
    });
  } catch (error) {
    logger.error(`Error fetching groups: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET single group with full details
// ─────────────────────────────────────────────
router.get("/:gid", async (req, res) => {
  try {
    const { gid } = req.params;

    // Get from DB first (cached)
    let group = await Group.findOne({ gid: Number(gid) }).lean();

    // If not in DB, fetch from blockchain
    if (!group) {
      const blockchainGroup = await contractService.getGroupData(Number(gid));
      if (!blockchainGroup) {
        return res.status(404).json({ error: "❌ Group not found" });
      }

      // Save to DB for caching
      group = new Group({
        gid: Number(gid),
        ...blockchainGroup,
      });
      await group.save();
    }

    // Get metrics and health
    const metrics = await contractService.getGroupMetrics(Number(gid));
    const health = await contractService.getGroupHealth(Number(gid));
    const roi = await contractService.getGroupROI(Number(gid));
    const members = await contractService.getMembers(Number(gid));

    res.json({
      status: "✅",
      data: {
        ...group,
        metrics,
        health,
        roi,
        membersList: members,
        syncedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error(`Error fetching group ${req.params.gid}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET group ROI for investors
// ─────────────────────────────────────────────
router.get("/:gid/roi", async (req, res) => {
  try {
    const { gid } = req.params;
    const roi = await contractService.getGroupROI(Number(gid));

    res.json({
      status: "✅",
      data: roi,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET group members
// ─────────────────────────────────────────────
router.get("/:gid/members", async (req, res) => {
  try {
    const { gid } = req.params;
    const members = await contractService.getMembers(Number(gid));

    // Get info for each member
    const membersInfo = await Promise.all(
      members.map(async (address) => {
        const info = await contractService.getMemberInfo(Number(gid), address);
        const trustScore = await contractService.getTrustScore(Number(gid), address);
        return {
          address,
          ...info,
          trustScore,
        };
      })
    );

    res.json({
      status: "✅",
      count: membersInfo.length,
      data: membersInfo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;