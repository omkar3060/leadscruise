// models/Teammate.js
const mongoose = require('mongoose');

const teammateSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, unique: true },
  names: [{ type: String }],
  phones: [{ type: String }],
  statuses: [{ type: String }],
});

module.exports = mongoose.model('Teammate', teammateSchema);