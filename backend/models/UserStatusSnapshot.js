// models/UserStatusSnapshot.js
const mongoose = require("mongoose");

const userStatusSnapshotSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["Running", "Stopped", "Paused"],
    default: "Stopped",
  },
});

module.exports = mongoose.model("UserStatusSnapshot", userStatusSnapshotSchema);
