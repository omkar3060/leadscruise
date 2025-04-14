const express = require('express');
const multer = require('multer');
const path = require('path');
const Email = require('../models/Email');
const { EmailAuthProvider } = require('firebase/auth');

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder to store PDFs
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// POST /api/upload-pdfs
router.post('/upload-email', upload.array('pdfs'), async (req, res) => {
  try {
    const files = req.files;
    const { message,userEmail } = req.body;

    if ((!files || files.length === 0) && !message.trim()) {
      return res.status(400).json({ message: 'No PDFs or message provided.' });
    }

    const pdfPaths = files.map(file => file.path);

    const newUpload = new Email({ message, pdfPaths, email:userEmail });
    await newUpload.save();

    res.status(200).json({ message: 'Upload successful.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
