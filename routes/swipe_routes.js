// backedNodeBlik/routes/swipe_routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { swipe } = require("../controller/swipe_controller");

router.post("/", auth, swipe);

module.exports = router;