require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/user");

function getConnectionString() {
  return process.env.CONNECTION_STRING || process.env.Connection_string || "";
}

function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    email: process.env.ADMIN_EMAIL || "admin@blink.local",
    password: process.env.ADMIN_PASSWORD || "admin12345",
    fullName: process.env.ADMIN_FULL_NAME || "System Admin",
  };
}

async function seedAdmin() {
  const connectionString = getConnectionString();
  const admin = getAdminConfig();

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Set CONNECTION_STRING in .env"
    );
  }

  if (admin.password.trim().length < 6) {
    throw new Error("ADMIN_PASSWORD must be at least 6 characters long");
  }

  await mongoose.connect(connectionString);

  const existing = await User.findOne({ email: admin.email });

  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(admin.password, salt);

    const created = new User({
      username: admin.username,
      email: admin.email,
      password: hashedPassword,
      fullName: admin.fullName,
      role: "admin",
      status: "active",
    });

    await created.save();
    console.log("Admin user created:", admin.email);
    return;
  }

  const updates = {};

  if (existing.role !== "admin") {
    updates.role = "admin";
  }

  if (existing.status !== "active") {
    updates.status = "active";
  }

  if (!existing.fullName) {
    updates.fullName = admin.fullName;
  }

  // Set SEED_ADMIN_RESET_PASSWORD=true to force-reset existing admin password.
  if (process.env.SEED_ADMIN_RESET_PASSWORD === "true") {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(admin.password, salt);
  }

  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: updates });
    console.log("Existing user promoted/updated as admin:", admin.email);
    return;
  }

  console.log("Admin user already exists and is up to date:", admin.email);
}

async function main() {
  try {
    await seedAdmin();
  } catch (error) {
    console.error("Failed to seed admin:", error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
