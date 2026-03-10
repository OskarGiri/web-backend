// backedNodeBlik/services/user.service.js
const mongoose = require("mongoose");
const Match = require("../models/match");
const Swipe = require("../models/swipe");

/**
 * Calculate user engagement statistics
 * @param {string} userId - The user ID to get stats for
 * @returns {Promise<{totalMatches: number, likesReceived: number}>}
 */
async function getUserStats(userId) {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1️⃣ Count total matches (where user is part of the match)
    const totalMatches = await Match.countDocuments({
      users: userObjectId,
    });

    // 2️⃣ Count total likes received (where user is the target and action is 'like')
    const likesReceived = await Swipe.countDocuments({
      toUser: userObjectId,
      action: "like",
    });

    return {
      totalMatches,
      likesReceived,
    };
  } catch (error) {
    console.error("Error calculating user stats:", error);
    throw error;
  }
}

module.exports = {
  getUserStats,
};
