// backedNodeBlik/controller/user_controller.js
const User = require("../models/user");
const Swipe = require("../models/swipe");
const Match = require("../models/match");
const Message = require("../models/message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUserStats } = require("../services/user.service");

function signToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "1d" }
  );
}

function userPayload(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

async function deleteUserRelatedData(userId) {
  await Swipe.deleteMany({
    $or: [{ fromUser: userId }, { toUser: userId }],
  });

  await Match.deleteMany({ users: userId });

  await Message.deleteMany({ sender: userId });
}

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    const token = signToken(newUser._id);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: userPayload(newUser),
    });
  } catch (e) {
    console.log("Signup error:", e);
    return res.status(500).json({ message: "Unable to signup" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (user.status === "banned") {
      return res.status(403).json({ message: "Account is banned" });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userPayload(user),
    });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ message: "Unable to login" });
  }
};

const findAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("username email fullName photos role status createdAt updatedAt")
      .sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (e) {
    console.error("Unable to find users:", e);
    return res.status(500).json({ message: "Unable to fetch users" });
  }
};

const adminListUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("username email fullName photos role status createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (e) {
    console.error("Admin list users error:", e);
    return res.status(500).json({ message: "Unable to fetch users" });
  }
};

const adminGetUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "-password -resetOtpHash -resetOtpExpiresAt -resetOtpAttempts -resetOtpResendAfter -resetTokenHash -resetTokenExpiresAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user);
  } catch (e) {
    console.error("Admin get user error:", e);
    return res.status(500).json({ message: "Unable to fetch user details" });
  }
};

const adminUpdateUser = async (req, res) => {
  try {
    const allowed = [
      "username",
      "email",
      "fullName",
      "dob",
      "gender",
      "lookingFor",
      "role",
      "status",
    ];

    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    if (updates.role && !["user", "admin"].includes(updates.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (updates.status && !["active", "banned"].includes(updates.status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await User.findByIdAndUpdate(req.params.userId, updates, {
      new: true,
      runValidators: true,
    }).select(
      "-password -resetOtpHash -resetOtpExpiresAt -resetOtpAttempts -resetOtpResendAfter -resetTokenHash -resetTokenExpiresAt"
    );

    if (!updated) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("Admin update user error:", e);
    return res.status(500).json({ message: "Unable to update user" });
  }
};

const adminDeleteUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    if (targetUserId === String(req.userId)) {
      return res.status(400).json({ message: "Admin cannot delete their own account here" });
    }

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await deleteUserRelatedData(targetUserId);
    await User.findByIdAndDelete(targetUserId);

    return res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (e) {
    console.error("Admin delete user error:", e);
    return res.status(500).json({ success: false, message: "Unable to delete user" });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (typeof newPassword !== "string" || newPassword.trim().length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (e) {
    console.error("Change password error:", e);
    return res.status(500).json({ message: "Unable to change password" });
  }
};

const getStats = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const stats = await getUserStats(userId);
    return res.status(200).json(stats);
  } catch (e) {
    console.error("Get stats error:", e);
    return res.status(500).json({ message: "Unable to fetch user stats" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await deleteUserRelatedData(userId);

    // Delete the user account
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (e) {
    console.error("Delete account error:", e);
    return res.status(500).json({
      success: false,
      message: "Unable to delete account"
    });
  }
};

module.exports = {
  signup,
  login,
  findAllUsers,
  changePassword,
  getStats,
  deleteAccount,
  adminListUsers,
  adminGetUserById,
  adminUpdateUser,
  adminDeleteUser,
};