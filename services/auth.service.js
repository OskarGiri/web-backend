const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/user");
const { generateOtp, hashValue, isExpired } = require("../utils/otp");
const { sendMail, buildOtpEmailTemplate } = require("../utils/mailer");

const OTP_EXPIRES_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRES_MINUTES = 15;

const GENERIC_FORGOT_MESSAGE =
  "If this email is registered, an OTP has been sent.";

function normalizedEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function addSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000);
}

async function forgotPassword(email) {
  const safeEmail = normalizedEmail(email);
  const user = await User.findOne({ email: safeEmail });

  if (!user) {
    return {
      statusCode: 200,
      message: GENERIC_FORGOT_MESSAGE,
      data: null,
    };
  }

  if (user.resetOtpResendAfter && new Date(user.resetOtpResendAfter) > new Date()) {
    return {
      statusCode: 200,
      message: GENERIC_FORGOT_MESSAGE,
      data: null,
    };
  }

  const otp = generateOtp(6);
  const otpHash = hashValue(`${safeEmail}:${otp}`);

  user.resetOtpHash = otpHash;
  user.resetOtpExpiresAt = addMinutes(OTP_EXPIRES_MINUTES);
  user.resetOtpAttempts = 0;
  user.resetOtpResendAfter = addSeconds(OTP_RESEND_COOLDOWN_SECONDS);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  try {
    await sendMail({
      to: safeEmail,
      subject: "Your OTP for password reset",
      html: buildOtpEmailTemplate(otp),
      text: `Your OTP is ${otp}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`,
    });
  } catch (error) {
    console.error("Forgot password mail error:", error.message);
  }

  return {
    statusCode: 200,
    message: GENERIC_FORGOT_MESSAGE,
    data: null,
  };
}

async function verifyOtp(email, otp) {
  const safeEmail = normalizedEmail(email);
  const user = await User.findOne({ email: safeEmail });

  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    return {
      statusCode: 400,
      message: "Invalid or expired OTP",
      data: null,
    };
  }

  if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
    return {
      statusCode: 429,
      message: "Too many OTP attempts. Please request a new OTP.",
      data: null,
    };
  }

  if (isExpired(user.resetOtpExpiresAt)) {
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    user.resetOtpAttempts = 0;
    await user.save();

    return {
      statusCode: 400,
      message: "Invalid or expired OTP",
      data: null,
    };
  }

  const incomingHash = hashValue(`${safeEmail}:${String(otp || "")}`);

  if (incomingHash !== user.resetOtpHash) {
    user.resetOtpAttempts += 1;
    await user.save();

    if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      return {
        statusCode: 429,
        message: "Too many OTP attempts. Please request a new OTP.",
        data: null,
      };
    }

    return {
      statusCode: 401,
      message: "Invalid OTP",
      data: null,
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.resetTokenHash = hashValue(resetToken);
  user.resetTokenExpiresAt = addMinutes(RESET_TOKEN_EXPIRES_MINUTES);
  user.resetOtpHash = null;
  user.resetOtpExpiresAt = null;
  user.resetOtpAttempts = 0;
  user.resetOtpResendAfter = null;

  await user.save();

  return {
    statusCode: 200,
    message: "OTP verified successfully",
    data: {
      resetToken,
      expiresInSeconds: RESET_TOKEN_EXPIRES_MINUTES * 60,
    },
  };
}

async function resetPassword(email, resetToken, newPassword) {
  const safeEmail = normalizedEmail(email);
  const user = await User.findOne({ email: safeEmail });

  if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
    return {
      statusCode: 401,
      message: "Invalid or expired reset token",
      data: null,
    };
  }

  if (isExpired(user.resetTokenExpiresAt)) {
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    return {
      statusCode: 401,
      message: "Invalid or expired reset token",
      data: null,
    };
  }

  const incomingTokenHash = hashValue(String(resetToken || ""));
  if (incomingTokenHash !== user.resetTokenHash) {
    return {
      statusCode: 401,
      message: "Invalid or expired reset token",
      data: null,
    };
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);

  user.resetOtpHash = null;
  user.resetOtpExpiresAt = null;
  user.resetOtpAttempts = 0;
  user.resetOtpResendAfter = null;
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;

  await user.save();

  return {
    statusCode: 200,
    message: "Password reset successful",
    data: null,
  };
}

module.exports = {
  forgotPassword,
  verifyOtp,
  resetPassword,
};
