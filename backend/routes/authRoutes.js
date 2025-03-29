const express = require("express");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const cron = require("node-cron");
const axios = require("axios");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const {
  signup,
  login,
  update,
  updateSavedPassword,
  checkemail,
  getStatus,updatePassword,
  getAllUsers,
  updateSheetsId,
  checkScriptStatus,
  stopScript,
  logout
} = require("../controllers/authController");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail", // or your preferred email service
  auth: {
    user: "kulkarnishashank962@gmail.com", // your email
    pass: "lhrurqqhljtumyqb", // your email password or app-specific password
  },
});

// Store reset tokens (in production, use a database)
const resetTokens = new Map();

router.post("/signup", signup);
router.post("/login", login);
router.post("/reset-password", update);
router.post("/update-saved-password", updateSavedPassword);
router.post("/check-email", checkemail);
router.get("/get-status/:email", getStatus);
router.post("/update-password", updatePassword);
router.get("/users", getAllUsers);
router.post("/update-sheets-id",updateSheetsId);
router.post("/logout",logout);

const SUBSCRIPTION_DURATIONS = {
  "one-mo": 30,
  "three-mo": 60,
  "six-mo": 180,
  "year-mo": 365,
};

cron.schedule(
  "0 * * * *", // Runs every hour
  async () => {
    console.log("Running scheduled task: Updating Sheets IDs...");

    try {
      // Get users with valid API key & Sheets ID
      const eligibleUsers = await User.find(
        { apiKey: { $ne: null }, sheetsId: { $ne: null } }, 
        "email apiKey sheetsId"
      );

      console.log(`Found ${eligibleUsers.length} users with valid API and Sheets ID.`);

      let processedCount = 0;

      for (const user of eligibleUsers) {
        // Get latest payment record for the user
        const lastPayment = await Payment.findOne({ email: user.email }).sort({ created_at: -1 });

        if (!lastPayment) {
          console.log(`Skipping ${user.email}: No payment record found.`);
          continue;
        }

        // Calculate expiration date
        const subscriptionDays = SUBSCRIPTION_DURATIONS[lastPayment.subscription_type];
        if (!subscriptionDays) {
          console.log(`Skipping ${user.email}: Unknown subscription type.`);
          continue;
        }

        const expirationDate = new Date(lastPayment.created_at);
        expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

        // Check if the subscription is still active
        if (new Date() > expirationDate) {
          console.log(`Skipping ${user.email}: Subscription expired on ${expirationDate.toDateString()}.`);
          continue;
        }

        try {
          console.log(`Updating Sheets ID for: ${user.email}`);

          await axios.post("https://api.leadscruise.com/api/update-sheets-id", {
            email: user.email,
            apiKey: user.apiKey,
            sheetsId: user.sheetsId,
            throughUpdate: 0,
          });

          console.log(`Successfully updated Sheets ID for ${user.email}`);
          processedCount++;
        } catch (error) {
          console.error(`Error updating Sheets ID for ${user.email}:`, error.message);
        }
      }

      console.log(`Completed processing. Updated ${processedCount} users.`);
    } catch (error) {
      console.error("Error fetching users:", error.message);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);
router.post("/check-script-status", checkScriptStatus);
router.post("/stop-api-script",stopScript);

router.get("/get-latest-id", async (req, res) => {
  try {
    const latestPayment = await Payment.findOne().sort({ unique_id: -1 });

    res.json({
      latestId: latestPayment ? latestPayment.unique_id + 1 : 153531,
    });
  } catch (error) {
    console.error("Error fetching latest payment ID:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/send-reset-email", async (req, res) => {
  const { email } = req.body;

  try {
    // Generate a unique reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store the token with the email (with expiration)
    resetTokens.set(resetToken, {
      email,
      expires: Date.now() + 3600000, // 1 hour expiration
    });

    // Create your custom reset link
    const resetLink = `https://app.leadscruise.com/reset-password?token=${resetToken}&email=${encodeURIComponent(
      email
    )}`;

    // Email template
    const mailOptions = {
      from: "kulkarnishashank962@gmail.com", // your sender email
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending reset email:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/get-api-key/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

router.put("/update-api-key", async (req, res) => {
  const { email, newApiKey } = req.body;

  try {
    const user = await User.findOneAndUpdate({ email }, { apiKey: newApiKey }, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "API Key updated successfully!" });
  } catch (error) {
    console.error("Error updating API Key:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
