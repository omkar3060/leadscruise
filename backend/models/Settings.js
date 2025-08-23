const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, unique: true },
  sentences: { type: [String], default: [] },
  wordArray: { type: [String], default: [] },
  h2WordArray: { type: [String], default: [] },
  minOrder: { type: Number, default: 0 },
  leadTypes: { type: [String], default: [] },
  selectedStates: { type: [String], default: [] }, // <-- ADD THIS LINE
});

module.exports = mongoose.model("Settings", SettingsSchema);