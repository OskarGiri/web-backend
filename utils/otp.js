const crypto = require("crypto");

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = (10 ** length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function isExpired(dateValue) {
  if (!dateValue) return true;
  return new Date(dateValue).getTime() <= Date.now();
}

module.exports = {
  generateOtp,
  hashValue,
  isExpired,
};
