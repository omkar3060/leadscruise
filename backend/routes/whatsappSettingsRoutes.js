const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, removeFile, getTodaysMessageCount } = require("../controllers/whatsappSettingsController");
const WhatsAppSettings = require("../models/WhatsAppSettings");
const multer = require('multer');
const fs = require("fs-extra");
const path = require("path");
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
router.get("/get-message-count", getTodaysMessageCount);
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
      { new: true, upsert: true } // Add upsert: true
    );

    if (!updated) {
      return res.status(404).json({ error: "Settings not found for this mobile number" });
    }

    res.status(200).json({
      success: true,
      message: "WhatsApp number updated successfully",
      data: updated
    });

    try {
      // Create a promise to handle the Python process
      const pythonProcessPromise = new Promise((resolve, reject) => {
        let verificationCode = null;
        let errorOutput = "";
        let isCompleted = false;
        let alreadyLoggedIn = false;

        // Start the Python process
        const pythonProcess = spawn('python3', [
          'whatsapp_login.py',
          newWhatsappNumber,
        ]);

        const rl = readline.createInterface({ input: pythonProcess.stdout });

        rl.on('line', async (line) => {
          console.log(`Python output: ${line}`);

          // Check for "Already logged in" message
          if (line.includes("Login successful! Chats found.")) {
            alreadyLoggedIn = true;
            verificationCode = "111";
            console.log("Detected already logged in. Setting verification code to 111");

            try {
              // Update the verificationCode immediately in DB
              await WhatsAppSettings.findOneAndUpdate(
                { mobileNumber },
                { verificationCode },
                { new: true }
              );
              console.log("Verification code updated in DB (Already logged in case)");
            } catch (dbError) {
              console.error("Error updating verification code:", dbError);
              // Continue execution even if DB update fails
            }
          }

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
            resolve({ success: true, verificationCode, alreadyLoggedIn });
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
            verificationCode,
            alreadyLoggedIn
          });
        }, 20 * 60 * 1000); // Full 20 minutes (1,200,000 ms)
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

router.put("/whatsapp-logout", async (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ error: "mobileNumber is required" });
  }

  try {
    const record = await WhatsAppSettings.findOne({ mobileNumber });

    if (!record || !record.whatsappNumber) {
      return res.status(404).json({ error: "No WhatsApp number linked with this mobile number" });
    }

    const whatsappNumber = record.whatsappNumber;

    await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      { $unset: { verificationCode: "" } }
    );

    const profileDir = path.join(
      __dirname,
      "..",
      "firefox_profiles",
      `whatsapp_${whatsappNumber}`
    );

    // Use fs-extra to remove the directory safely
    await fs.remove(profileDir);

    res.json({ message: "WhatsApp unlinked and associated profile directory deleted successfully" });
  } catch (err) {
    console.error("Error during WhatsApp unlinking:", err);
    res.status(500).json({ error: "Failed to unlink WhatsApp and delete profile directory" });
  }
});

function cleanupDisplay(uniqueId) {
  const displayNumber = `X${uniqueId}`; // Assuming `uniqueId` is mapped to display number
  const lockFilePath = `/tmp/.${displayNumber}-lock`;

  if (fs.existsSync(lockFilePath)) {
    try {
      fs.unlinkSync(lockFilePath);
      console.log(`Removed display lock file: ${lockFilePath}`);
    } catch (err) {
      console.error(`Failed to remove ${lockFilePath}:`, err);
    }
  }
}

let isHealthCheckRunning = false;
let lastHealthCheckResult = null;
let lastHealthCheckTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 5 minutes

const performHealthCheck = async () => {
  if (isHealthCheckRunning) return;

  isHealthCheckRunning = true;
  try {
    const settings = await WhatsAppSettings.find({});
    if (!settings || settings.length === 0) {
      lastHealthCheckResult = {
        status: "❌ No WhatsApp settings found.",
        code: 404,
        time: Date.now()
      };
      return;
    }

    cleanupDisplay(999999);
    let whatsappCheckPassed = false;

    for (const setting of settings) {
      const number = setting.whatsappNumber || setting.mobileNumber;
      const success = await runWithTimeout("python3", ["whatsapp_health_check.py", number]);
      if (success) {
        whatsappCheckPassed = true;
        break;
      }
    }

    const mainScriptCheckPassed = await runWithTimeout("python3", ["main_script_health_check.py"]);

    let status = "", code = 200;
    if (whatsappCheckPassed && mainScriptCheckPassed) {
      status = "✅ Both WhatsApp and Main scripts are healthy.";
    } else if (whatsappCheckPassed) {
      status = "⚠️ Only WhatsApp script passed. Check Main script.";
      code = 206;
    } else if (mainScriptCheckPassed) {
      status = "⚠️ Only Main script passed. Check WhatsApp script.";
      code = 206;
    } else {
      status = "❌ Both script checks failed.";
      code = 500;
    }

    lastHealthCheckResult = { status, code, time: Date.now() };
  } catch (err) {
    console.error("Health check error:", err);
    lastHealthCheckResult = {
      status: "❌ Internal server error during health check.",
      code: 500,
      time: Date.now()
    };
  } finally {
    isHealthCheckRunning = false;
  }
};

router.get("/scripts/health", async (req, res) => {
  const now = Date.now();

  // Use cached result if recent
  if (now - lastHealthCheckTime < CACHE_DURATION_MS && lastHealthCheckResult) {
    return res.status(lastHealthCheckResult.code).json({
      status: lastHealthCheckResult.status,
      cached: true,
      time: new Date(lastHealthCheckResult.time).toISOString()
    });
  }

  // Trigger fresh health check in background
  lastHealthCheckTime = now;
  performHealthCheck();

  // Immediately respond with current status or in-progress message
  if (lastHealthCheckResult) {
    return res.status(lastHealthCheckResult.code).json({
      status: lastHealthCheckResult.status + " (fresh check in progress)",
      cached: true,
      time: new Date(lastHealthCheckResult.time).toISOString()
    });
  } else {
    return res.status(202).json({
      status: "⏳ Health check is running for the first time. Please retry in a few seconds.",
    });
  }
});

function runWithTimeout(command, args = [], timeout = 300000) {
  return new Promise((resolve) => {
    const process = spawn(command, args);
    let result = false;
    let killed = false;

    const timer = setTimeout(() => {
      process.kill("SIGTERM");
      killed = true;
    }, timeout);

    process.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("Output:", output);
      if (output.toLowerCase().includes("success") || output.toLowerCase().includes("ok")) {
        result = true;
      }
    });

    process.stderr.on("data", (data) => {
      console.error("Error:", data.toString());
    });

    process.on("close", () => {
      clearTimeout(timer);
      resolve(killed ? false : result);
    });
  });
}

module.exports = router;
