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
    type: String,
    required: true
  },
  messages: [{
    type: String,
    required: true
  }],
  catalogueFiles: [fileSchema]  // Array of files
}, { timestamps: true });

const WhatsAppSettings = mongoose.model('WhatsAppSettings', whatsappSettingsSchema);

module.exports = WhatsAppSettings;