const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, removeFile } = require("../controllers/whatsappSettingsController");

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

module.exports = router;
