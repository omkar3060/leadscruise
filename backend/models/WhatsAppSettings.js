const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: String,        // Stored filename on the server
  originalName: String,    // Original filename uploaded by the user
  path: String,            // File path on the server
  mimetype: String,        // File type (image/jpeg, application/pdf, etc.)
  size: Number             // File size in bytes
});

const whatsappSettingsSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: true,
    unique: true
  },
  whatsappNumber: {
    type: String
  },
  messages: [{
    type: String
  }],
  verificationCode: {
    type: String,
  },

  // === New fields added for LeadsCruise Connect integration ===
  qrPageUrl: {
    type: String,          // e.g., "https://connect.leadscruise.com/custom/qr-page/wa-919353050644-mhurhzz1/view"
  },
  pageId: {
    type: String,          // e.g., "wa-919353050644-mhurhzz1"
  },
  instanceName: {
    type: String,          // e.g., "wa-919353050644"
  },
  instanceToken: {
    type: String,          // e.g., "DFAFE6E8-BC2B-4E00-8B76-230661EE376C"
  },
  expiresAt: {
    type: Number,          // Unix timestamp (e.g., 1762877264509)
  },
  integration: {
    type: String,          // e.g., "WHATSAPP-BAILEYS"
    default: "WHATSAPP-BAILEYS"
  },
  status: {
    type: String,          // e.g., "CONNECTING", "CONNECTED"
    default: "CONNECTING"
  },
  // ===========================================================

  catalogueFiles: [fileSchema]  // Array of uploaded catalogue files
}, { timestamps: true });

const WhatsAppSettings = mongoose.model('WhatsAppSettings', whatsappSettingsSchema);

module.exports = WhatsAppSettings;
