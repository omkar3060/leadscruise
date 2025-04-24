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

// Modified controller
exports.saveSettings = async (req, res) => {
  try {
    // This will be executed after multer middleware processes files
    const { mobileNumber, whatsappNumber, customMessage } = req.body;

    if (!mobileNumber || !whatsappNumber || !customMessage) {
      // Delete uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
      return res.status(400).json({ error: "All fields are required" });
    }

    // Process file information to save in database
    const catalogueFiles = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size
    })) : [];

    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      {
        whatsappNumber,
        customMessage,
        catalogueFiles
      },
      { upsert: true, new: true }
    );

    const { spawn } = require('child_process');
    const receiverNumber = "9741076333"; // Constant receiver number
    
    // Convert catalogueFiles to JSON string for passing to script
    const catalogueFilesJSON = JSON.stringify(catalogueFiles);
    
    console.log("Launching WhatsApp script with parameters:");
    console.log("WhatsApp Number:", whatsappNumber);
    console.log("Custom Message:", customMessage);
    console.log("Receiver Number:", receiverNumber);
    console.log("Catalogue Files Count:", catalogueFiles.length);

    // Set stdio option to 'inherit' to show output in the parent process terminal
    const pythonProcess = spawn('python', [
      'whatsapp.py',
      whatsappNumber,
      customMessage,
      catalogueFilesJSON,
      receiverNumber
    ], {
      stdio: ['ignore', 'inherit', 'inherit']
    });

    // Alternative approach using event listeners if inherit doesn't work
    // This keeps the original code but ensures it doesn't buffer output
    pythonProcess.stdout && pythonProcess.stdout.on('data', (data) => {
      process.stdout.write(`WhatsApp script: ${data}`);
    });

    pythonProcess.stderr && pythonProcess.stderr.on('data', (data) => {
      process.stderr.write(`WhatsApp script error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`WhatsApp script exited with code ${code}`);
    });

    res.json({ message: "Settings saved successfully", data: updated });
  } catch (err) {
    console.error("Error saving WhatsApp settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const { mobileNumber } = req.query;

    if (!mobileNumber) {
      return res.status(400).json({ error: "mobileNumber is required" });
    }

    const settings = await WhatsAppSettings.findOne({ mobileNumber });

    if (!settings) {
      return res.status(404).json({ error: "No settings found" });
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
