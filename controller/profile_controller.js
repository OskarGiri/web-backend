const User = require("../models/user");

const getMe = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select(
      "-password -resetOtpHash -resetOtpExpiresAt -resetOtpAttempts -resetOtpResendAfter -resetTokenHash -resetTokenExpiresAt"
    );
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(me);
  } catch (e) {
    res.status(500).json({ message: "Failed to load profile" });
  }
};

const updateMe = async (req, res) => {
  try {
    const allowed = ["fullName", "dob", "gender", "lookingFor"];
    const updates = {};

    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    const me = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select(
      "-password -resetOtpHash -resetOtpExpiresAt -resetOtpAttempts -resetOtpResendAfter -resetTokenHash -resetTokenExpiresAt"
    );
    res.json(me);
  } catch (e) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};

module.exports = { getMe, updateMe };
