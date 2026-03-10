const mongoose = require("mongoose");
const Match = require("../models/match");
const Message = require("../models/message");
const User = require("../models/user");

const listMatches = async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.userId);

    // load matches with other user
    const matches = await Match.find({ users: me })
      .sort({ updatedAt: -1 })
      .lean();

    const matchIds = matches.map((m) => m._id);

    // latest message per match (aggregation)
    const latest = await Message.aggregate([
      { $match: { match: { $in: matchIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$match",
          id: { $first: "$_id" },
          text: { $first: "$text" },
          senderId: { $first: "$sender" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]);

    const latestMap = new Map(latest.map((x) => [x._id.toString(), x]));

    // fetch users
    const allUserIds = new Set();
    for (const m of matches) {
      for (const u of m.users || []) allUserIds.add(u.toString());
    }

    const users = await User.find({ _id: { $in: Array.from(allUserIds) } })
      .select("_id username fullName photos")
      .lean();

    const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

    const out = matches.map((m) => {
      const otherUserId = (m.users || []).find((u) => u.toString() !== me.toString());
      const other = otherUserId ? usersMap.get(otherUserId.toString()) : null;

      const lm = latestMap.get(m._id.toString());
      const lastMessage = lm
        ? {
            id: lm.id.toString(),
            text: lm.text,
            senderId: lm.senderId.toString(),
            createdAt: lm.createdAt,
          }
        : null;

      return {
        id: m._id,
        otherUser: other
          ? {
              id: other._id,
              username: other.username,
              fullName: other.fullName,
              photos: other.photos || [],
            }
          : null,
        lastMessage,
      };
    });

    return res.status(200).json(out);
  } catch (e) {
    console.error("List matches error:", e);
    return res.status(500).json({ message: "Failed to load matches" });
  }
};

module.exports = { listMatches };