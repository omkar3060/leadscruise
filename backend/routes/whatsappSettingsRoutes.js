const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, removeFile } = require("../controllers/whatsappSettingsController");
const WhatsAppSettings = require("../models/WhatsAppSettings");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

router.post(
  '/save',
  upload.array('catalogueFiles', 5), // Allow up to 5 files
  saveSettings
);
router.get("/get", getSettings);
router.delete('/remove-file', removeFile);
router.put("/update-whatsapp-number", async (req, res) => {
  try {
    const { mobileNumber, newWhatsappNumber } = req.body;

    if (!mobileNumber || !newWhatsappNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      {
        $set: { whatsappNumber: newWhatsappNumber },
        $unset: { verificationCode: "" }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Settings not found for this mobile number" });
    }

    res.json({ message: "WhatsApp number updated successfully", data: updated });
  } catch (err) {
    console.error("Error updating WhatsApp number:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get('/verification-code/:mobileNumber', async (req, res) => {
  try {
    const { mobileNumber } = req.params;
    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    const settings = await WhatsAppSettings.findOne({ mobileNumber });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    res.json({ verificationCode: settings.verificationCode || null });

  } catch (err) {
    console.error("Error fetching verification code:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
