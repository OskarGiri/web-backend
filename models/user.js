const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },

    // ✅ MVP profile fields
    fullName: { type: String, default: "" },
    dob: { type: String, default: "" }, // store ISO string for MVP
    gender: { type: String, default: "" },
    lookingFor: { type: String, default: "" },
    bio: { type: String, default: "" }, // About Me section

    // ✅ photos list (URLs)
    photos: { type: [String], default: [] },

    // Access control and moderation status
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
      index: true,
    },

    // Forgot password via OTP
    resetOtpHash: { type: String, default: null },
    resetOtpExpiresAt: { type: Date, default: null },
    resetOtpAttempts: { type: Number, default: 0 },
    resetOtpResendAfter: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);