const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    refId: { type: String, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstTime: { type: Boolean, default: true },
    mobileNumber: { type: String, unique: true, sparse: true },
    savedPassword: { type: String }, // Store encrypted password
    status: { type: String, default: "Stopped", enum: ["Active", "Stopped"] },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    startTime: { type: Date },
    apiKey: { type: String },
    phoneNumber: { type: String },
    lastLogin: { type: Date },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const User = mongoose.model("User", userSchema);
module.exports = User;
