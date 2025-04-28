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

    const parsedMessages = typeof messages === 'string' ? JSON.parse(messages) : messages;

    if (!mobileNumber || !whatsappNumber || !parsedMessages || parsedMessages.length === 0) {
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
      return res.status(400).json({ error: "All fields are required" });
    }

    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      { whatsappNumber, messages: parsedMessages },
      { upsert: true, new: true }
    );

    // const receiverNumber = "9741076333";
    // const messagesJSON = JSON.stringify(parsedMessages);

    // console.log("Launching WhatsApp script with parameters:");
    // console.log("WhatsApp Number:", whatsappNumber);
    // console.log("Receiver Number:", receiverNumber);

    // let verificationCode = null; // 👈 define once here

    // // Start the Python process
    // const pythonProcess = spawn('python3', [
    //   'whatsapp.py',
    //   whatsappNumber,
    //   messagesJSON,
    //   receiverNumber,
    // ]);

    // const rl = readline.createInterface({ input: pythonProcess.stdout });

    // rl.on('line', async (line) => {
    //   console.log(`Python output: ${line}`);

    //   const codeMatch = line.match(/WHATSAPP_VERIFICATION_CODE:([A-Z0-9-]+)/);
    //   if (codeMatch && codeMatch[1]) {
    //     verificationCode = codeMatch[1]; // 👈 just assign, no const

    //     console.log(`Verification code captured: ${verificationCode}`);

    //     // Update the verificationCode immediately in DB
    //     await WhatsAppSettings.findOneAndUpdate(
    //       { mobileNumber },
    //       { verificationCode },
    //       { new: true }
    //     );

    //     console.log("Verification code updated in DB");
    //   }
    // });

    // pythonProcess.stderr.on('data', (data) => {
    //   console.error(`Python error: ${data}`);
    // });

    // pythonProcess.on('close', (code) => {
    //   console.log(`WhatsApp script exited with code ${code}`);
    //   // Do not reject or resolve anything, let it stay running
    // });

    // // ✅ Send response IMMEDIATELY after starting the Python script
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
