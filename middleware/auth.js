const jwt = require("jsonwebtoken");
const User = require("../models/user");

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    const userId = decoded.userId;

    const user = await User.findById(userId).select("_id status");
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.status === "banned") {
      return res.status(403).json({ message: "Account is banned" });
    }

    req.userId = userId;
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
};
