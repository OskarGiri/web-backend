// backedNodeBlik/routes/discovery_routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { discovery } = require("../controller/discovery_controller");

router.get("/", auth, discovery);

module.exports = router;