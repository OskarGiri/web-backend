// backedNodeBlik/routes/match_routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { listMatches } = require("../controller/match_controller");
const { getMessages, postMessage } = require("../controller/message_controller");

router.get("/", auth, listMatches);

// ✅ Day 3 chat
router.get("/:matchId/messages", auth, getMessages);
router.post("/:matchId/messages", auth, postMessage);

module.exports = router;