const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  findAllUsers,
  changePassword,
} = require("../controller/user_controller");
const { getMe, updateMe } = require("../controller/profile_controller");
const { uploadPhoto, deletePhoto } = require("../controller/photo_controller");

const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

router.post("/signup", signup);
router.post("/login", login);
router.post("/change-password", auth, changePassword);

// profile
router.get("/me", auth, getMe);
router.put("/me", auth, updateMe);

// photos
router.post("/me/photos", auth, upload.single("photo"), uploadPhoto);
router.delete("/me/photos/:index", auth, deletePhoto);

router.get("/", findAllUsers);

module.exports = router;