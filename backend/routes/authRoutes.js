const express = require("express");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const cron = require("node-cron");
const axios = require("axios");
const crypto = require("crypto");
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
const Payment = require("../models/Payment");

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

cron.schedule(
  "30 18 * * *", // Cron expression for 12:00 AM daily
  async () => {
    console.log("Running scheduled task: Updating Sheets IDs at 12:00 AM...");

    try {
      const users = await User.find({}, "email apiKey sheetsId");
      console.log(`Found ${users.length} users. Processing updates...`);
      const throughUpdate=0;
      for (const user of users) {
        try {
          console.log(`Updating Sheets ID for: ${user.email}`);

          await axios.post("https://api.leadscruise.com/api/update-sheets-id", {
            email: user.email,
            apiKey: user.apiKey,
            sheetsId: user.sheetsId,
            throughUpdate,
          });

          console.log(`Successfully updated Sheets ID for ${user.email}`);
        } catch (error) {
          console.error(`Error updating Sheets ID for ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata", // Set to India Standard Time (modify if needed)
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

module.exports = router;
