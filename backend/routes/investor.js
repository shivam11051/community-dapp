const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const User = require("../models/User");
const contractService = require("../services/contractService");
const logger = require("../utils/logger");

// ─────────────────────────────────────────────
// GET investor dashboard
// ─────────────────────────────────────────────
router.get("/dashboard/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Get user profile
    let user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      user = new User({ address: address.toLowerCase(), isInvestor: true });
      await user.save();
    }

    // Get investor stats
    const groups = await Group.find({ "roi.roiPercentage": { $gt: 0 } }).lean();
    const investorGroups = user.investmentProfile.portfolioGroups;

    const portfolio = await Promise.all(
      investorGroups.map(async (gid) => {
        const group = await Group.findOne({ gid }).lean();
        return {
          ...group,
          invested: true,
        };
      })
    );

    res.json({
      status: "✅",
      data: {
        user,
        portfolio,
        allGroups: groups.length,
        investedGroups: investorGroups.length,
        totalInvested: user.investmentProfile.totalInvested,
        totalReturns: user.investmentProfile.totalReturns,
        averageROI: user.investmentProfile.averageROI,
      },
    });
  } catch (error) {
    logger.error(`Error fetching investor dashboard: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET top opportunities (groups with best health)
// ─────────────────────────────────────────────
router.get("/opportunities", async (req, res) => {
  try {
    const groups = await Group.find({ status: 1 }) // ACTIVE groups only
      .sort({ "health.averageCreditScore": -1 })
      .limit(20)
      .lean();

    const opportunities = await Promise.all(
      groups.map(async (group) => {
        const roi = await contractService.getGroupROI(group.gid);
        const metrics = await contractService.getGroupMetrics(group.gid);
        return {
          ...group,
          roi,
          metrics,
          investmentScore: calculateInvestmentScore(group, roi, metrics),
        };
      })
    );

    res.json({
      status: "✅",
      count: opportunities.length,
      data: opportunities.sort((a, b) => b.investmentScore - a.investmentScore),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET member trust scores
// ─────────────────────────────────────────────
router.get("/trust-score/:gid/:member", async (req, res) => {
  try {
    const { gid, member } = req.params;
    const trustScore = await contractService.getTrustScore(Number(gid), member);
    const memberInfo = await contractService.getMemberInfo(Number(gid), member);

    res.json({
      status: "✅",
      data: {
        address: member,
        trustScore,
        ...memberInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// Investment Score Calculator
// ─────────────────────────────────────────────
function calculateInvestmentScore(group, roi, metrics) {
  let score = 0;

  // Health score (40%)
  score += (group.health?.averageCreditScore || 0) * 0.4;

  // Fill percentage (30%)
  score += (group.health?.fillPercentage || 0) * 0.3;

  // ROI (20%)
  score += Math.min((roi?.roiPercentage || 0), 100) * 0.2;

  // On-time payment rate (10%)
  const onTimeRate = group.health?.onTimeMemberCount 
    ? (group.health.onTimeMemberCount / metrics?.totalMembers) * 100 
    : 0;
  score += onTimeRate * 0.1;

  return Math.round(score);
}

module.exports = router;