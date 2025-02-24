const express = require("express");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const crypto = require("crypto");
const {
  signup,
  login,
  update,
  updateSavedPassword,
  checkemail,
  getStatus,
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
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(
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



// router.post("/reset-password", async (req, res) => {
//   const { token, newPassword, email } = req.body;

//   // const tokenData = resetTokens.get(token);
//   // if (!tokenData || tokenData.expires < Date.now()) {
//   //   return res.status(400).json({
//   //     success: false,
//   //     message: "Invalid or expired reset token",
//   //   });
//   // }

//   try {
//     // Update password in your database here
//     const user = await User.findOne({ email });
//     user.password = newPassword;
//     await user.save();

//     // // Remove used token
//     // resetTokens.delete(token);

//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });
module.exports = router;
