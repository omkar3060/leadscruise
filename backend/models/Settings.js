const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, unique: true },
  sentences: { type: [String], default: [] },
  wordArray: { type: [String], default: [] },
  h2WordArray: { type: [String], default: [] },
  minOrder: { type: Number, default: 0 },
  leadTypes: { type: [String], default: [] },
  selectedStates: { type: [String], default: [] },
  initialSentences: { type: [String], default: [] },
  initialWordArray: { type: [String], default: [] },
  thresholdLevel: {
    type: String,
    enum: ['aggressive', 'mild_aggressive', 'medium', 'mild_accurate', 'accurate'],
    default: 'medium'
  },
  thresholdScore: { type: Number, default: 60 },
});

module.exports = mongoose.model("Settings", SettingsSchema);