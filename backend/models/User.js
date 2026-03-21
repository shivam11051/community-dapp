const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isInvestor: {
    type: Boolean,
    default: false,
  },
  creditScore: {
    type: Number,
    default: 50,
  },
  groupsJoined: [Number],
  groupsCreated: [Number],
  onTimeEMIs: {
    type: Number,
    default: 0,
  },
  lateEMIs: {
    type: Number,
    default: 0,
  },
  missedEMIs: {
    type: Number,
    default: 0,
  },
  trustScore: {
    type: Number,
    default: 50,
  },
  investmentProfile: {
    totalInvested: {
      type: String,
      default: "0",
    },
    totalReturns: {
      type: String,
      default: "0",
    },
    averageROI: {
      type: Number,
      default: 0,
    },
    portfolioGroups: [Number],
  },
  lastActivity: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);