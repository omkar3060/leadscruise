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
// router.put("/update-whatsapp-number", async (req, res) => {
//   try {
//     const { mobileNumber, newWhatsappNumber } = req.body;

//     if (!mobileNumber || !newWhatsappNumber) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const updated = await WhatsAppSettings.findOneAndUpdate(
//       { mobileNumber },
//       {
//         $set: { whatsappNumber: newWhatsappNumber, verificationCode: "111" },
//       },
//       { new: true, upsert: true } // Add upsert: true
//     );

//     if (!updated) {
//       return res.status(404).json({ error: "Settings not found for this mobile number" });
//     }

//     res.status(200).json({
//       success: true,
//       message: "WhatsApp number updated successfully",
//       data: updated
//     });

//     // try {
//     //   // Create a promise to handle the Python process
//     //   const pythonProcessPromise = new Promise((resolve, reject) => {
//     //     let verificationCode = null;
//     //     let errorOutput = "";
//     //     let isCompleted = false;
//     //     let alreadyLoggedIn = false;

//     //     // Start the Python process
//     //     const pythonProcess = spawn('python3', [
//     //       'whatsapp_login.py',
//     //       newWhatsappNumber,
//     //     ]);

//     //     const rl = readline.createInterface({ input: pythonProcess.stdout });

//     //     rl.on('line', async (line) => {
//     //       console.log(`Python output: ${line}`);

//     //       // Check for "Already logged in" message
//     //       if (line.includes("Login successful! Chats found.")) {
//     //         alreadyLoggedIn = true;
//     //         verificationCode = "111";
//     //         console.log("Detected already logged in. Setting verification code to 111");

//     //         try {
//     //           // Update the verificationCode immediately in DB
//     //           await WhatsAppSettings.findOneAndUpdate(
//     //             { mobileNumber },
//     //             { verificationCode },
//     //             { new: true }
//     //           );
//     //           console.log("Verification code updated in DB (Already logged in case)");
//     //         } catch (dbError) {
//     //           console.error("Error updating verification code:", dbError);
//     //           // Continue execution even if DB update fails
//     //         }
//     //       }

//     //       // Handle specific errors that should be ignored
//     //       if (line.includes("504 Gateway Time-out") ||
//     //         line.includes("Failed to send data") ||
//     //         line.includes("Send button not found or not clickable")) {
//     //         console.warn("Detected known error but continuing execution:", line);
//     //         // These are expected errors we want to ignore
//     //       }

//     //       const codeMatch = line.match(/WHATSAPP_VERIFICATION_CODE:([A-Z0-9-]+)/);
//     //       if (codeMatch && codeMatch[1]) {
//     //         verificationCode = codeMatch[1];
//     //         console.log(`Verification code captured: ${verificationCode}`);

//     //         try {
//     //           // Update the verificationCode immediately in DB
//     //           await WhatsAppSettings.findOneAndUpdate(
//     //             { mobileNumber },
//     //             { verificationCode },
//     //             { new: true }
//     //           );
//     //           console.log("Verification code updated in DB");
//     //         } catch (dbError) {
//     //           console.error("Error updating verification code:", dbError);
//     //           // Continue execution even if DB update fails
//     //         }
//     //       }
//     //     });

//     //     pythonProcess.stderr.on('data', (data) => {
//     //       const errorMsg = data.toString();
//     //       errorOutput += errorMsg;
//     //       console.error(`Python error: ${errorMsg}`);
//     //     });

//     //     pythonProcess.on('close', (code) => {
//     //       if (isCompleted) return; // Prevent double resolution
//     //       isCompleted = true;

//     //       console.log(`WhatsApp script exited with code ${code}`);

//     //       if (code === 0 || code === null) {
//     //         // Consider both 0 and null (killed by timeout) as successful completions
//     //         resolve({ success: true, verificationCode, alreadyLoggedIn });
//     //       } else {
//     //         resolve({
//     //           success: false,
//     //           code,
//     //           error: errorOutput,
//     //           message: `WhatsApp script failed with code ${code}`
//     //         });
//     //       }
//     //     });

//     //     pythonProcess.on('error', (err) => {
//     //       if (isCompleted) return;
//     //       isCompleted = true;

//     //       console.error("Failed to start Python process:", err);
//     //       reject(err);
//     //     });

//     //     // Set a hard timeout to ensure we ALWAYS wait the full 10 minutes
//     //     // This guarantees we won't process another WhatsApp request until this one is done
//     //     const timeout = setTimeout(() => {
//     //       if (isCompleted) return;
//     //       isCompleted = true;

//     //       console.log("WhatsApp script reached the mandatory 10-minute timeout, completing process");
//     //       pythonProcess.kill();
//     //       resolve({
//     //         success: true,
//     //         timeout: true,
//     //         message: "WhatsApp script completed after full 10-minute wait",
//     //         verificationCode,
//     //         alreadyLoggedIn
//     //       });
//     //     }, 20 * 60 * 1000); // Full 20 minutes (1,200,000 ms)
//     //     // Clear the timeout if the process completes before timeout
//     //     pythonProcess.on('close', () => {
//     //       clearTimeout(timeout);
//     //     });
//     //   });

//     //   // Wait for the Python process to complete - this will block for up to 10 minutes
//     //   console.log("Waiting for WhatsApp script to complete (up to 10 minutes)...");
//     //   const result = await pythonProcessPromise;
//     //   console.log("WhatsApp script process completed:", result);

//     // } catch (pythonError) {
//     //   console.error("Error in WhatsApp script execution:", pythonError);
//     // }
//   } catch (err) {
//     console.error("Error updating WhatsApp number:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

router.put("/update-whatsapp-number", async (req, res) => {
  try {
    var { mobileNumber, newWhatsappNumber } = req.body;

    if (!mobileNumber || !newWhatsappNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create instanceName dynamically
    if (newWhatsappNumber.length < 10) {
      return res.status(400).json({ error: "Invalid WhatsApp number" });
    }
    else if (newWhatsappNumber.length === 10) {
      newWhatsappNumber = `91${newWhatsappNumber}`;
    }

    const instanceName = `wa-${newWhatsappNumber}`;
    const description = `LeadsCruise AI pairing for ${newWhatsappNumber}`;

    console.log("Creating LeadsCruise Connect QR page for instanceName:", instanceName);

    // Call external LeadsCruise Connect API
    const connectResponse = await fetch("https://connect.leadscruise.com/custom/qr-page", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": "81150b867e07bf0324f937b5897987e63010f33ffe01adb2582466f7cef6c718"
      },
      body: JSON.stringify({ instanceName, description })
    });

    const connectData = await connectResponse.json();

    if (!connectResponse.ok) {
      console.error("Connect API Error:", connectData);

      // Check if instance already exists
      if (connectData.response?.message?.[0]?.includes("already exists")) {
        // Check if we already have this WhatsApp number in DB
        const existingSettings = await WhatsAppSettings.findOne({
          mobileNumber
        });

        if (existingSettings && existingSettings.whatsappNumber === newWhatsappNumber) {
          // Already linked to this number
          return res.status(200).json({
            success: true,
            message: "WhatsApp number already linked",
            data: existingSettings,
            alreadyLinked: true
          });
        }
      }

      return res.status(500).json({
        error: "Failed to create WhatsApp QR page",
        details: connectData
      });
    }

    // Extract relevant data from response
    const { url, pageId, instance, expiresAt } = connectData;
    const token = instance?.token;

    // Save all info in DB
    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      {
        $set: {
          whatsappNumber: newWhatsappNumber,
          qrPageUrl: url,
          pageId,
          instanceName: instanceName,
          instanceToken: token,
          expiresAt
        }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "WhatsApp number linked successfully",
      data: updated,
      qrUrl: url, // frontend will open this URL only for new instances
      alreadyLinked: false
    });

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

router.put("/update-verification-code", async (req, res) => {
  try {
    const { mobileNumber, verificationCode } = req.body;

    if (!mobileNumber || !verificationCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updated = await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      { $set: { verificationCode } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "WhatsApp settings not found" });
    }

    res.status(200).json({
      success: true,
      message: "Verification code updated successfully",
      data: updated
    });

  } catch (err) {
    console.error("Error updating verification code:", err);
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
    const instanceName = record.instanceName;
    const instanceToken = record.instanceToken;

    // Call LeadsCruise Connect API to logout the instance
    if (instanceName && instanceToken) {
      try {
        const logoutResponse = await fetch(
          `https://connect.leadscruise.com/instance/logout/${instanceName}`,
          {
            method: "DELETE",
            headers: {
              "apikey": instanceToken
            }
          }
        );

        if (logoutResponse.ok) {
          console.log(`Successfully logged out instance: ${instanceName}`);
        } else {
          const logoutData = await logoutResponse.json();
          console.error("Logout API Error:", logoutData);
          // Continue with local cleanup even if API call fails
        }
      } catch (logoutError) {
        console.error("Error calling logout API:", logoutError);
        // Continue with local cleanup even if API call fails
      }
    }

    // Remove all WhatsApp related fields from database
    await WhatsAppSettings.findOneAndUpdate(
      { mobileNumber },
      {
        $unset: {
          whatsappNumber: "",
          verificationCode: "",
          qrPageUrl: "",
          pageId: "",
          instanceName: "",
          instanceToken: "",
          expiresAt: ""
        }
      }
    );

    const profileDir = path.join(
      __dirname,
      "..",
      "firefox_profiles",
      `whatsapp_${whatsappNumber}`
    );

    // Use fs-extra to remove the directory safely
    try {
      await fs.remove(profileDir);
      console.log(`Profile directory deleted: ${profileDir}`);
    } catch (dirError) {
      console.error("Error deleting profile directory:", dirError);
      // Continue even if directory deletion fails
    }

    res.json({
      message: "WhatsApp unlinked successfully",
      details: "Instance logged out, database cleared, and profile directory deleted"
    });
  } catch (err) {
    console.error("Error during WhatsApp unlinking:", err);
    res.status(500).json({ error: "Failed to unlink WhatsApp" });
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
router.get("/scripts/health", async (req, res) => {
  // Set a custom timeout of 15 minutes (in milliseconds)
  res.setTimeout(15 * 60 * 1000, () => {
    console.log("Request timed out after 15 minutes.");
    return res.status(504).json({ status: "❌ Timeout", message: "Scripts took too long to respond." });
  });

  isHealthCheckRunning = true;

  try {
    const settings = await WhatsAppSettings.find({});
    if (!settings || settings.length === 0) {
      return res.status(404).json({ message: "No WhatsApp settings found" });
    }

    cleanupDisplay(999999);

    let whatsappCheckPassed = false;

    for (let i = 0; i < settings.length; i++) {
      const number = settings[i].whatsappNumber || settings[i].mobileNumber;

      const success = await new Promise((resolve) => {
        const process = spawn("python3", ["whatsapp_health_check.py", number]);
        let result = false;

        process.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`Health check output for ${number}:`, output);
          if (output.toLowerCase().includes("success") || output.toLowerCase().includes("ok")) {
            result = true;
          }
        });

        process.stderr.on("data", (data) => {
          console.error(`Health check error for ${number}:`, data.toString());
        });

        process.on("close", () => resolve(result));
      });

      if (success) {
        whatsappCheckPassed = true;
        break;
      }
    }

    const mainScriptCheckPassed = await new Promise((resolve) => {
      const process = spawn("python3", ["main_script_health_check.py"]);
      let result = false;

      process.stdout.on("data", (data) => {
        const output = data.toString();
        console.log("Main script output:", output);
        if (output.toLowerCase().includes("success") || output.toLowerCase().includes("ok")) {
          result = true;
        }
      });

      process.stderr.on("data", (data) => {
        console.error("Main script error:", data.toString());
      });

      process.on("close", () => resolve(result));
    });

    // Return based on results
    if (whatsappCheckPassed && mainScriptCheckPassed) {
      return res.json({ status: "✅ Both WhatsApp and Main scripts are healthy." });
    } else if (whatsappCheckPassed) {
      return res.status(206).json({ status: "⚠️ Only the WhatsApp script is running correctly. Please check the Main script." });
    } else if (mainScriptCheckPassed) {
      return res.status(206).json({ status: "⚠️ Only the Main script is running correctly. Please check the WhatsApp script." });
    } else {
      return res.status(500).json({ status: "❌ Both script checks failed. Please investigate." });
    }
  } catch (error) {
    console.error("Health check error:", error);
    return res.status(500).json({ message: "Internal server error during health check." });
  } finally {
    isHealthCheckRunning = false;
  }
});

router.get("/get-whatsapp-number", async (req, res) => {
  try {
    const { mobileNumber } = req.query;
    console.log("Received request for WhatsApp number with mobileNumber:", mobileNumber);
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        error: "Mobile number is required",
      });
    }

    // Find settings by mobile number
    const settings = await WhatsAppSettings.findOne({ mobileNumber });
    console.log("Fetched settings:", settings);
    if (!settings) {
      return res.status(404).json({
        success: false,
        error: "No WhatsApp settings found for this mobile number",
      });
    }

    // Return only required fields
    return res.status(200).json({
      success: true,
      data: {
        whatsappNumber: settings.whatsappNumber,
        messages: settings.messages || [],
        verificationCode: settings.verificationCode || null,
      },
    });

  } catch (error) {
    console.error("Error fetching WhatsApp settings:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});


module.exports = router;
