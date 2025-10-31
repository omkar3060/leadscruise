const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    refId: { type: String, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstTime: { type: Boolean, default: true },
    mobileNumber: { type: String, sparse: true },
    savedPassword: { type: String }, // Store encrypted password
    status: { type: String, default: "Stopped" },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    startTime: { type: Date },
    apiKey: { type: String },
    sheetsId: { type: String }, // New field
    phoneNumber: { type: String },
    lastLogin: { type: Date },
    activeToken: { type: String, default: null },
    sessionId: { type: String, default: null }, // Added for session management
    adminPassword: { type: String},
    autoStartEnabled: {type: Boolean,default: false},
    buyerBalance: { type: Number, default: null },
    firstInvoiceDownloadTime: { type: Date, default: null },
    // Add this field to your User schema
isExclusive: {
  type: Boolean,
  default: false
},
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const User = mongoose.model("User", userSchema);
module.exports = User;
