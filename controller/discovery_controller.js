

const User = require("../models/user");
const Swipe = require("../models/swipe");

function toAbsolute(req, p) {
  if (!p) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  // Use localhost:3000 for the backend URL (or environment variable)
  const baseUrl = process.env.PUBLIC_URL || "http://localhost:3000";
  return `${baseUrl}${p.startsWith("/") ? "" : "/"}${p}`;
}

const discovery = async (req, res) => {
  try {
    const me = req.userId;

    const swiped = await Swipe.find({ fromUser: me }).select("toUser -_id");
    const swipedIds = swiped.map((s) => s.toUser);

    const users = await User.find({
      _id: { $ne: me, $nin: swipedIds },
      role: { $ne: "admin" },
    })
      .select("username fullName dob gender lookingFor photos")
      .lean();

    console.log(`📱 Discovery: Found ${users.length} users for ${me}`);

    const out = users.map((u) => {
      const obj = { ...u };
      // Ensure photos is always an array and convert to absolute URLs
      obj.photos = Array.isArray(obj.photos) 
        ? obj.photos.filter(p => p).map((p) => toAbsolute(req, p))
        : [];
      console.log(`  👤 ${u.username}: ${obj.photos.length} photos`);
      return obj;
    });

    return res.status(200).json(out);
  } catch (e) {
    console.error("❌ Discovery error:", e);
    return res.status(500).json({ message: "Failed to load discovery" });
  }
};

module.exports = { discovery };