const WhatsAppSettings = require("../models/WhatsAppSettings");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter to accept only images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];

  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, GIF and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Modified controller
exports.saveSettings = async (req, res) => {
  try {
    const { mobileNumber, whatsappNumber, messages } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    let parsedMessages = undefined;
    if (messages) {
      parsedMessages = typeof messages === 'string' ? JSON.parse(messages) : messages;
    }

    const updateFields = {};
    if (whatsappNumber) updateFields.whatsappNumber = whatsappNumber;
    if (parsedMessages) updateFields.messages = parsedMessages;

    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    res.json({
      message: "Settings saved successfully.",
      data: updated,
    });

  } catch (err) {
    console.error("Error saving WhatsApp settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getSettings = async (req, res) => {
  try {
    // Change from req.params to req.query
    const { mobileNumber } = req.query;

    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    const settings = await WhatsAppSettings.findOne({ mobileNumber });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    res.json({ data: settings });
  } catch (err) {
    console.error("Error fetching WhatsApp settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.removeFile = async (req, res) => {
  try {
    const { mobileNumber, fileId } = req.body;

    if (!mobileNumber || !fileId) {
      return res.status(400).json({ error: "Mobile number and file ID are required" });
    }

    // Find the settings document
    const settings = await WhatsAppSettings.findOne({ mobileNumber });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    // Find the file in the catalogueFiles array
    const fileToRemove = settings.catalogueFiles.id(fileId);

    if (!fileToRemove) {
      return res.status(404).json({ error: "File not found" });
    }

    // Remove the file from the filesystem
    try {
      const fs = require('fs');
      if (fs.existsSync(fileToRemove.path)) {
        fs.unlinkSync(fileToRemove.path);
      }
    } catch (err) {
      console.error("Error deleting file from filesystem:", err);
      // Continue even if file delete fails
    }

    // Remove the file from the database
    settings.catalogueFiles.pull(fileId);
    await settings.save();

    res.json({ message: "File removed successfully" });

  } catch (err) {
    console.error("Error removing file:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getTodaysMessageCount = async (req, res) => {
  try {
    const { mobileNumber } = req.query;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const settings = await WhatsAppSettings.findOne({ mobileNumber });

    if (!settings) {
      return res.status(404).json({ message: "No WhatsApp settings found" });
    }

    res.json({ messageCount: settings.messages.length });
  } catch (error) {
    console.error("Error fetching today's message count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};