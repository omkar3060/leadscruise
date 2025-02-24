const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  refId: String,
  username: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstTime: { type: Boolean, default: true },
  mobileNumber: { type: String, unique: true, sparse: true },
  savedPassword: { type: String }, // Store encrypted password
});

const User = mongoose.model("User", userSchema);
module.exports = User;