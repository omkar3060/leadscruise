const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    refId: { type: String, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstTime: { type: Boolean, default: true },
    mobileNumber: { type: String, sparse: true },
    savedPassword: { type: String },
    status: { type: String, default: "Stopped" },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    startTime: { type: Date },
    apiKey: { type: String },
    sheetsId: { type: String },
    phoneNumber: { type: String },
    lastLogin: { type: Date },

    // ✅ Web session fields (existing)
    activeToken: { type: String, default: null },
    sessionId: { type: String, default: null },

    // ✅ Desktop session fields (new)
    desktopToken: { type: String, default: null },
    desktopSessionId: { type: String, default: null },

    adminPassword: { type: String },
    autoStartEnabled: { type: Boolean, default: false },
    buyerBalance: { type: Number, default: null },
    firstInvoiceDownloadTime: { type: Date, default: null },
    isExclusive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
