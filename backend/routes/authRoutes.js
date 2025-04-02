const express = require("express");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const cron = require("node-cron");
const axios = require("axios");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SECRET_KEY = process.env.SECRET_KEY;
const {
  signup,
  login,
  update,
  updateSavedPassword,
  checkemail,
  getStatus, updatePassword,
  getAllUsers,
  updateSheetsId,
  checkScriptStatus,
  stopScript,
  logout,
  forceLogout,
} = require("../controllers/authController");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail", // or your preferred email service
  auth: {
    user: "noreply.leadscruise@gmail.com", // your email
    pass: "cqemjscmupacnsdp", // your email password or app-specific password
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
router.post("/update-sheets-id", updateSheetsId);
router.post("/logout", logout);
router.post('/force-logout', forceLogout);

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

          await axios.post("http://localhost:5000/api/update-sheets-id", {
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
router.post("/stop-api-script", stopScript);

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
      from: "noreply.leadscruise@gmail.com", // Your sender email
      to: email,
      subject: "Password Reset Request",
      html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #444;">Hello ${email},</h2>
      <p>We received a request to reset the password for your account associated with this email. If you made this request, please click the button below to reset your password. This link is valid for <strong>1 hour</strong> and will expire after that time for security reasons.</p>
      <p>
        <a href="${resetLink}" style="background-color: #007bff; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
      </p>
      <p>If you did not request a password reset, you can ignore this email, and your account will remain secure. However, if you suspect any unauthorized activity, we recommend updating your password and enabling additional security measures.</p>
      <p>For any assistance, feel free to contact our support team at <a href="mailto:support@leadscruise.com">support@leadscruise.com</a>.</p>
      <p>Best regards,<br><strong>LEADSCRUISE TEAM</strong></p>
    </div>
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

router.get("/verify-session", async (req, res) => {
  try {
    // Extract token & sessionId from request headers
    const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
    const sessionId = req.headers["session-id"]; // Get session ID from request header
    console.log("🔹 Received Token:", token);
    console.log("🔹 Received Session ID:", sessionId);


    if (!token || !sessionId) {
      return res.status(401).json({ activeSession: false, message: "Token or Session ID missing" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, SECRET_KEY);
    if (!decoded) {
      return res.status(401).json({ activeSession: false, message: "Invalid token" });
    }

    // Find the user in the database
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(401).json({ activeSession: false, message: "User not found" });
    }

    // Check if the sessionId matches
    if (user.sessionId !== sessionId) {
      return res.status(401).json({ activeSession: false, message: "Session expired or logged in from another device" });
    }

    res.status(200).json({ activeSession: true, message: "Session is active" });
  } catch (error) {
    console.error("Session verification error:", error.message);
    return res.status(401).json({ activeSession: false, message: "Session verification failed" });
  }
});

module.exports = router;
