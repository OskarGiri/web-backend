const User = require("../models/user");

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Prefer configured public URL, otherwise derive from incoming request host.
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.photos = user.photos || [];
    // Keep most recently uploaded photo as the primary profile picture.
    user.photos.unshift(url);
    await user.save();

    res.json({ photos: user.photos });
  } catch (e) {
    res.status(500).json({ message: "Upload failed" });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const { index } = req.params; // simplest MVP: delete by index
    const i = parseInt(index, 10);

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!Array.isArray(user.photos) || i < 0 || i >= user.photos.length) {
      return res.status(400).json({ message: "Invalid photo index" });
    }

    user.photos.splice(i, 1);
    await user.save();

    res.json({ photos: user.photos });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" });
  }
};

module.exports = { uploadPhoto, deletePhoto };