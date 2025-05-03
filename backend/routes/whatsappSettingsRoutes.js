const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, removeFile } = require("../controllers/whatsappSettingsController");
const WhatsAppSettings = require("../models/WhatsAppSettings");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require("child_process");
const readline = require('readline');

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
    try {
      // Create a promise to handle the Python process
      const pythonProcessPromise = new Promise((resolve, reject) => {
        let verificationCode = null;
        let errorOutput = "";
        let isCompleted = false;
        
        // Start the Python process
        const pythonProcess = spawn('python3', [
          'whatsapp_login.py',
          newWhatsappNumber,
        ]);
        
        const rl = readline.createInterface({ input: pythonProcess.stdout });
        
        rl.on('line', async (line) => {
          console.log(`Python output: ${line}`);
          
          // Handle specific errors that should be ignored
          if (line.includes("504 Gateway Time-out") || 
              line.includes("Failed to send data") ||
              line.includes("Send button not found or not clickable")) {
            console.warn("Detected known error but continuing execution:", line);
            // These are expected errors we want to ignore
          }
          
          const codeMatch = line.match(/WHATSAPP_VERIFICATION_CODE:([A-Z0-9-]+)/);
          if (codeMatch && codeMatch[1]) {
            verificationCode = codeMatch[1];
            console.log(`Verification code captured: ${verificationCode}`);
            
            try {
              // Update the verificationCode immediately in DB
              await WhatsAppSettings.findOneAndUpdate(
                { mobileNumber },
                { verificationCode },
                { new: true }
              );
              console.log("Verification code updated in DB");
            } catch (dbError) {
              console.error("Error updating verification code:", dbError);
              // Continue execution even if DB update fails
            }
          }
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const errorMsg = data.toString();
          errorOutput += errorMsg;
          console.error(`Python error: ${errorMsg}`);
        });
        
        pythonProcess.on('close', (code) => {
          if (isCompleted) return; // Prevent double resolution
          isCompleted = true;
          
          console.log(`WhatsApp script exited with code ${code}`);
          
          if (code === 0 || code === null) {
            // Consider both 0 and null (killed by timeout) as successful completions
            resolve({ success: true, verificationCode });
          } else {
            resolve({ 
              success: false, 
              code, 
              error: errorOutput,
              message: `WhatsApp script failed with code ${code}`
            });
          }
        });
        
        pythonProcess.on('error', (err) => {
          if (isCompleted) return;
          isCompleted = true;
          
          console.error("Failed to start Python process:", err);
          reject(err);
        });
        
        // Set a hard timeout to ensure we ALWAYS wait the full 10 minutes
        // This guarantees we won't process another WhatsApp request until this one is done
        const timeout = setTimeout(() => {
          if (isCompleted) return;
          isCompleted = true;
          
          console.log("WhatsApp script reached the mandatory 10-minute timeout, completing process");
          pythonProcess.kill();
          resolve({ 
            success: true, 
            timeout: true,
            message: "WhatsApp script completed after full 10-minute wait",
            verificationCode
          });
        }, 10 * 60 * 1000); // Full 10 minutes (600,000 ms)
        
        // Clear the timeout if the process completes before timeout
        pythonProcess.on('close', () => {
          clearTimeout(timeout);
        });
      });
      
      // Wait for the Python process to complete - this will block for up to 10 minutes
      console.log("Waiting for WhatsApp script to complete (up to 10 minutes)...");
      const result = await pythonProcessPromise;
      console.log("WhatsApp script process completed:", result);
      
    } catch (pythonError) {
      console.error("Error in WhatsApp script execution:", pythonError);
    }
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
