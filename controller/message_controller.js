// backedNodeBlik/controller/message_controller.js
const mongoose = require("mongoose");
const Match = require("../models/match");
const Message = require("../models/message");

async function assertUserInMatch(matchId, userId) {
  const matchObjectId = new mongoose.Types.ObjectId(matchId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const match = await Match.findById(matchObjectId).select("users");
  if (!match) {
    const err = new Error("Match not found");
    err.status = 404;
    throw err;
  }

  const isMember =
    Array.isArray(match.users) &&
    match.users.some((u) => u && u.toString() === userObjectId.toString());

  if (!isMember) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  return { matchObjectId, userObjectId };
}

const getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { matchObjectId } = await assertUserInMatch(matchId, req.userId);

    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);

    const messages = await Message.find({ match: matchObjectId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .select("_id match sender text createdAt");

    return res.status(200).json(
      messages.map((m) => ({
        id: m._id,
        matchId: m.match,
        senderId: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      }))
    );
  } catch (e) {
    console.error("Get messages error:", e);
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Failed to load messages" });
  }
};

const postMessage = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { userObjectId, matchObjectId } = await assertUserInMatch(
      matchId,
      req.userId
    );

    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ message: "Text is required" });

    const msg = await Message.create({
      match: matchObjectId,
      sender: userObjectId,
      text,
    });

    // ✅ ADD THIS LINE (updates match.updatedAt so /matches sort works)
    await Match.findByIdAndUpdate(matchObjectId, {
      $set: { updatedAt: new Date() },
    });

    // ✅ REAL-TIME emit to both users
    const io = req.app.get("io");
    if (io) {
      const match = await Match.findById(matchObjectId).select("users");
      const payload = {
        id: msg._id.toString(),
        matchId: msg.match.toString(),
        senderId: msg.sender.toString(),
        text: msg.text,
        createdAt: msg.createdAt,
      };

      for (const u of match?.users || []) {
        io.to(`user:${u.toString()}`).emit("message:new", payload);
      }
    }

    return res.status(201).json({
      id: msg._id,
      matchId: msg.match,
      senderId: msg.sender,
      text: msg.text,
      createdAt: msg.createdAt,
    });
  } catch (e) {
    console.error("Post message error:", e);
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Failed to send message" });
  }
};
module.exports = { getMessages, postMessage };