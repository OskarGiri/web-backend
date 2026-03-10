const authService = require("../services/auth.service");
const { isValidEmail, isValidPassword } = require("../middleware/validate");

function response(res, statusCode, message, data = null, success = statusCode < 400) {
  return res.status(statusCode).json({ success, message, data });
}

const forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email;

    if (!isValidEmail(email)) {
      return response(res, 400, "Valid email is required");
    }

    const result = await authService.forgotPassword(email);
    return response(res, result.statusCode, result.message, result.data);
  } catch (error) {
    console.error("Forgot password error:", error);
    return response(res, 500, "Unable to process forgot password request");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!isValidEmail(email)) {
      return response(res, 400, "Valid email is required");
    }

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return response(res, 400, "OTP must be a 6-digit string");
    }

    const result = await authService.verifyOtp(email, String(otp));
    return response(res, result.statusCode, result.message, result.data);
  } catch (error) {
    console.error("Verify OTP error:", error);
    return response(res, 500, "Unable to verify OTP");
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body || {};

    if (!isValidEmail(email)) {
      return response(res, 400, "Valid email is required");
    }

    if (!resetToken || typeof resetToken !== "string") {
      return response(res, 400, "resetToken is required");
    }

    if (!isValidPassword(newPassword)) {
      return response(res, 400, "newPassword must be at least 8 characters");
    }

    const result = await authService.resetPassword(email, resetToken, newPassword);
    return response(res, result.statusCode, result.message, result.data);
  } catch (error) {
    console.error("Reset password error:", error);
    return response(res, 500, "Unable to reset password");
  }
};

module.exports = {
  forgotPassword,
  verifyOtp,
  resetPassword,
};
