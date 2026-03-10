const User = require("../models/user");

module.exports = async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const user = await User.findById(req.userId).select("role status");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Account is banned" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(500).json({ message: "Unable to verify admin access" });
  }
};
