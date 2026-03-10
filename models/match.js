// backedNodeBlik/models/match.js
const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    users: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
  },
  { timestamps: true }
);

// Always keep pair sorted so (A,B) == (B,A)
matchSchema.pre("validate", function (next) {
  if (Array.isArray(this.users) && this.users.length === 2) {
    this.users.sort((a, b) => a.toString().localeCompare(b.toString()));
  }
  next();
});

// ✅ Correct: unique on the PAIR (users[0], users[1])
matchSchema.index({ "users.0": 1, "users.1": 1 }, { unique: true });

module.exports = mongoose.model("Match", matchSchema);