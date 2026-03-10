function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPassword(password) {
  return typeof password === "string" && password.trim().length >= 8;
}

module.exports = {
  isValidEmail,
  isValidPassword,
};
