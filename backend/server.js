const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const { spawn } = require("child_process");
const app = express();
const bcrypt = require("bcrypt");
const settingsRoutes = require("./routes/settingsRoutes");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const fs = require("fs");
const readline = require('readline');
const Payment = require("./models/Payment");
const IndiaMartAnalytics = require("./models/IndiaMARTAnalytics");
const Referral = require("./models/Referral");
const Support = require("./models/Support");
const Settings = require('./models/Settings');
const BillingDetails = require('./models/billingDetails');
const WhatsappSettings = require('./models/WhatsAppSettings');
const paymentRoutes = require("./routes/paymentRoutes");
const emailRoutes = require("./routes/emailRoutes");
const billingDetailsRoutes = require("./routes/billingDetailsRoutes");
const axios = require('axios');
const { createServer } = require("http");
const { Server } = require("socket.io");
const referralRoutes = require("./routes/referralRoutes");
const statusRoutes = require("./routes/snapshRoutes");
const supportRoutes = require("./routes/support");
const whatsappSettingsRoutes = require("./routes/whatsappSettingsRoutes");
const analyticsRouter = require("./routes/analytics.js");
const teammateRoutes = require('./routes/teammates');
const server = createServer(app); // ✅ Create HTTP server
server.setTimeout(15 * 60 * 1000);
const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: "https://app.leadscruise.com",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);

app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["https://app.leadscruise.com", "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);
const User = require("./models/userModel");
console.log("Attempting to connect to MongoDB with URI:", process.env.MONGODB_URI);
// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

//RazorPay handlers

app.post("/order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });
    console.log("Order request options:", req.body);
    const options = req.body;
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }
    console.log("Generated order:", order);
    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.post("/order/validate", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      return res.json({
        success: true,
        msg: "success",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Invalid signature" });
    }
  } catch (error) {
    console.error("Error validating payment:", error);
    return res.status(500).json({ success: false, error: "Validation failed" });
  }
});

// Route to save payment details to MongoDB
app.post("/api/save-payment", async (req, res) => {
  try {
    const {
      unique_id,
      email,
      contact,
      order_id,
      payment_id,
      signature,
      order_amount,
      subscription_type,
    } = req.body;

    // Fetch the latest subscription for this email (assuming the latest one is the most relevant)
    const latestPayment = await Payment.findOne({ email })
      .sort({ created_at: -1 })
      .exec();

    let created_at = Date.now();

    if (latestPayment) {
      // Check if the last subscription is still active
      const subscriptionDuration = getSubscriptionDuration(
        latestPayment.subscription_type
      ); // Helper function for duration in days
      const subscriptionEndDate = new Date(latestPayment.created_at);
      subscriptionEndDate.setDate(
        subscriptionEndDate.getDate() + subscriptionDuration
      );

      const today = new Date();

      if (subscriptionEndDate > today) {
        // Last subscription is still active, start the new one after the current ends
        created_at = subscriptionEndDate.getTime() + 1; // Start the next day after expiry
      }
    }

    const payment = new Payment({
      unique_id,
      email,
      contact,
      order_id,
      payment_id,
      signature,
      order_amount,
      subscription_type,
      created_at,
    });

    await payment.save();

    await User.findOneAndUpdate(
      { email },                          // find user by email
      { $set: { mobileNumber: contact } }, // update mobileNumber
      { new: true, upsert: false }        // don't create a new user if not exists
    );

    res.json({ success: true, message: "Payment details saved successfully" });
  } catch (error) {
    console.error("Error saving payment details:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.get("/api/has-used-demo", async (req, res) => {
  try {
    const { contact } = req.query;

    if (!contact) {
      return res.status(400).json({ error: "Missing contact number" });
    }

    const existingDemo = await Payment.findOne({
      contact,
      subscription_type: "1-day",
    });

    if (existingDemo) {
      return res.json({ used: true });
    } else {
      return res.json({ used: false });
    }
  } catch (error) {
    console.error("Error checking demo usage:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper function to get subscription duration in days based on type
function getSubscriptionDuration(subscription_type) {
  switch (subscription_type) {
    case "1-day":
      return 1;
    case "3-days":
      return 3;
    case "One Month":
      return 30;
    case "6 Months":
      return 180;
    case "Yearly":
      return 365;
    default:
      return 30; // Default fallback
  }
}

// Routes
app.use("/api", authRoutes);
app.use("/api", settingsRoutes);
app.use("/api", paymentRoutes);
app.use("/api/billing", billingDetailsRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api", emailRoutes);
app.use("/api", statusRoutes);
app.use("/api/whatsapp-settings", whatsappSettingsRoutes);
app.use("/api/analytics", analyticsRouter);
app.use("/api/support", supportRoutes);
app.use('/api/teammates', teammateRoutes);

app.post("/api/check-number", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile number is required." });
    }

    if (mobileNumber === "9579797269") {
      return res.json({ code:0, message: "Number is not subscribed." });
    }

    // Step 1: DB check
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.json({
        exists: true,
        message: "Number is subscribed with us earlier.",
        user: {
          refId: existingUser.refId,
          username: existingUser.username,
          email: existingUser.email,
          status: existingUser.status,
          role: existingUser.role,
        },
      });
    }

    // Step 2: Run Python script
    const python = spawn("python3", ["indiamart_link_check.py", mobileNumber]);

    // Capture Python stdout (your print statements)
    python.stdout.on("data", (data) => {
      console.log(`Python stdout: ${data.toString()}`);
    });

    // Capture Python errors
    python.stderr.on("data", (data) => {
      console.error(`Python stderr: ${data.toString()}`);
    });

    // Handle exit
    python.on("exit", (code) => {
      console.log(`Python script exited with code ${code}`);

      // Cleanup Xvfb display after script execution
      cleanupDisplay("100000");

      if (code === 0) {
        return res.json({ exists: false, otp: "request_button", code: 0 });
      } else if (code === 1) {
        return res.json({ exists: false, otp: "fields_visible", code: 1 });
      } else {
        return res.json({ exists: false, otp: "unknown_state", code: 2 });
      }
    });
  } catch (error) {
    console.error("Error checking number:", error.message);
    res.status(500).json({
      message: "Error occurred while checking the number.",
      error: error.message,
    });
  }
});

const otpRequests = new Map();
const otpFailures = new Map();

const activePythonProcesses = new Map();

app.post("/api/execute-task", async (req, res) => {
  // Set a higher timeout for this specific response
  res.setTimeout(900000); // 15 minutes

  const { mobileNumber, email, uniqueId, password } = req.body;

  if (!mobileNumber || !email || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Email and Mobile Number are required.",
    });
  }

  // Generate a random 6-digit password
  const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated password for IndiaMART:", newPassword);

  // Spawn a new Python process to execute the task
  const pythonProcess = spawn("python3", [
    "login_check.py",
    mobileNumber,
    newPassword,
    uniqueId,
    password,
  ], {
    timeout: 900000 // 15 minutes timeout
  });
  activePythonProcesses.set(uniqueId, pythonProcess);
  let result = "";
  let error = "";

  // Capture standard output (stdout) and log to console
  pythonProcess.stdout.on("data", (data) => {
    const output = data.toString();
    result += output;
    console.log("Python stdout:", output.trim());
    if (output.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for unique_id:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null,
        type: "login" // Default type
      });
    }

    if (output.includes("PASSWORD_OTP_REQUEST_INITIATED")) {
      console.log("Password change OTP request detected for unique_id:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null,
        type: "password_change" // Specific type for password change
      });
    }

    if (output.includes("OTP_FAILED_INCORRECT")) {
      console.log("Incorrect OTP detected for", uniqueId);
      otpFailures.set(uniqueId, true);
    }
  });

  // Capture standard error (stderr) and log to console
  pythonProcess.stderr.on("data", (data) => {
    const errorOutput = data.toString();
    error += errorOutput;
    console.error("Python stderr:", errorOutput.trim());
  });

  // Handle Python script execution completion
  pythonProcess.on("close", async (code) => {
    console.log(`Python process exited with code: ${code}`);
    activePythonProcesses.delete(uniqueId);
    cleanupDisplay(uniqueId);
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);

    // Clear any pending OTP state
    console.log(`Cleaned up OTP state for uniqueId: ${uniqueId}`);
    if (code === 0) {
      try {
        // Parse the result from Python script
        const resultText = result.trim();

        // Extract JSON between separators
        const startMarker = "===RESULT_START===";
        const endMarker = "===RESULT_END===";
        const startIndex = resultText.indexOf(startMarker);
        const endIndex = resultText.indexOf(endMarker);

        let extractedData;
        if (startIndex !== -1 && endIndex !== -1) {
          // Extract JSON between markers
          const jsonString = resultText.substring(startIndex + startMarker.length, endIndex).trim();
          try {
            extractedData = JSON.parse(jsonString);
            console.log("Successfully parsed JSON result:", extractedData);
          } catch (parseError) {
            console.error("Error parsing JSON between markers:", parseError);
            console.error("JSON string was:", jsonString);
            throw parseError;
          }
        } else {
          console.error("Could not find result markers in output");
          console.error("Full output:", resultText);
        }

        const { companyName, mobileNumbers, preferredCategories, messageTemplates, newPassword } = extractedData;
        console.log("Extracted Company Name:", companyName);
        console.log("Extracted Mobile Numbers:", mobileNumbers);
        console.log("Extracted Categories:", preferredCategories);
        console.log("Generated Message Templates:", messageTemplates);
        console.log("New Password:", newPassword);

        // Find the user
        let user = await User.findOne({ email });
        if (!user) {
          return res.status(404).json({
            status: "error",
            message: "User not found"
          });
        }

        // Update user record with mobile number
        user.mobileNumber = mobileNumber;

        if (mobileNumber && mobileNumber === "9579797269") {
          try {
            // Create Settings entry
            const settingsData = {
              userEmail: email,
              sentences: [
                "Thank You for the enquiry",
                "Please contact the sales team +91-9900333143, +91-9503213927 , +91-9284706164",
                "Once the enquiry is being closed kindly review us with ratings."
              ],
              wordArray: [
                "Spider Couplings",
                "Servo Couplings",
                "Gear Couplings",
                "Flexible Shaft Couplings",
                "Rigid Couplings",
                "Flexible Couplings",
                "Torque limiter",
                "PU Spider Coupling",
                "Disc Coupling",
                "Encoder Coupling",
                "Flange coupling",
                "Aluminum Flexible Coupling",
                "Full Gear Coupling",
                "Jaw Couplings",
                "Couplings",
                "Stainless Steel Couplings",
                "Flexible Coupling"
              ],
              h2WordArray: [
                "Hero Splendor Rubber Coupling",
                "Capsule Couple",
                "Ape Coupling Rubber",
                "18mm Sujata Mixer Rubber Coupler",
                "Quick Release Bolt",
                "Quick Release Couplings",
                "Aluminium Encoder Coupling, for Automation, Size: 1 Inch",
                "Piaggio Ape Rubber Joint Coupling, 30 piece"
              ],
              minOrder: 0,
              leadTypes: []
            };

            await Settings.create(settingsData);

            // Create BillingDetails entry
            const billingData = {
              email: email,
              billingEmail: email, // Using the same email as billing email initially
              phone: mobileNumber,
              gst: "27ARFPJ3439G1ZT",
              pan: "ARFPJ3439G",
              name: "FOCUS ENGINEERING PRODUCTS",
              address: "SR NO 677, BEHIND VISHWAVILAS HOTEL, LANDEWADI, BHOSARI-411039"
            };

            await BillingDetails.create(billingData);

            console.log("Settings and BillingDetails created for mobile number:", mobileNumber);
          } catch (error) {
            console.error("Error creating Settings/BillingDetails:", error.message);
            // Don't fail the signup if Settings/BillingDetails creation fails
          }
        }

        // Add company name and mobile numbers to user if available
        if (companyName) {
          user.companyName = companyName;
        }
        if (mobileNumbers && mobileNumbers.length > 0) {
          user.companyMobileNumbers = mobileNumbers;
        }

        // Save new password if it was successfully changed
        if (newPassword) {
          user.savedPassword = newPassword;
          console.log("New password saved to user record");
        }

        await user.save();
        console.log("User record updated successfully");

        // Update or create settings record with preferred categories and message templates
        if ((preferredCategories && preferredCategories.length > 0) || (messageTemplates && messageTemplates.length > 0)) {
          try {
            // Find existing settings or create new one
            let settings = await Settings.findOne({ userEmail: email });

            if (!settings) {
              // Create new settings record
              settings = new Settings({
                userEmail: email,
                wordArray: preferredCategories || [],
                sentences: messageTemplates || [],
                h2WordArray: [],
                minOrder: 0,
                leadTypes: []
              });
              console.log("Creating new settings record for user:", email);
            } else {
              // Update existing settings
              if (preferredCategories && preferredCategories.length > 0) {
                settings.wordArray = preferredCategories;
                console.log("Updated wordArray with preferred categories");
              }

              if (messageTemplates && messageTemplates.length > 0) {
                settings.sentences = messageTemplates;
                console.log("Updated sentences with message templates");
              }

              console.log("Updating existing settings record for user:", email);
            }

            await settings.save();
            console.log(`Successfully saved settings - Categories: ${preferredCategories ? preferredCategories.length : 0}, Templates: ${messageTemplates ? messageTemplates.length : 0}`);

          } catch (settingsError) {
            console.error("Error saving settings:", settingsError);
            // Don't fail the whole request if settings save fails
          }
        }
        // After successfully saving settings
        try {
          const leadNamePlaceholder = "{lead_name}";
          const productPlaceholder = "{lead_product_requested}";

          const whatsappMessage = `Hi ${leadNamePlaceholder},
Thank you for contacting ${companyName}. 📬
 
✅ You can post your requirements details for this number 
else 
✅ You can contact ${mobileNumbers && mobileNumbers.length > 0 ? mobileNumbers.join(", ") : mobileNumber} or send a mail at {leadscruise_email} for more details on your enquiry of ${productPlaceholder}

We typically respond within some minutes!`;

          // Upsert WhatsApp settings for the user's mobile number
          await WhatsappSettings.findOneAndUpdate(
            { mobileNumber }, // match by main mobileNumber
            {
              $set: {
                whatsappNumber: mobileNumber,
              },
              $addToSet: {
                messages: whatsappMessage // avoid duplicates
              }
            },
            { upsert: true, new: true }
          );

          console.log(`WhatsApp message saved for ${mobileNumber}`);
        } catch (whatsAppError) {
          console.error("Error saving WhatsApp settings:", whatsAppError);
        }


        return res.json({
          status: "success",
          message: "Company profile and categories extracted successfully!",
        });

      } catch (dbError) {
        console.error("Database error:", dbError);
        return res.status(500).json({
          status: "error",
          message: "Database error"
        });
      }
    } else {
      return res.status(500).json({
        status: "error",
        message: `Python script failed with exit code ${code}. Error: ${error.trim()}`,
      });
    }
  });

  // Handle process errors
  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python process:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to start Python process",
    });
  });
});

const userLeadCounterSchema = new mongoose.Schema({
  user_mobile_number: { type: String, required: true, unique: true },
  leadCount: { type: Number, default: 0 },
  lastReset: { type: Date, default: Date.now },
  maxCaptures: { type: Number, default: 7 },
  lastUpdatedMaxCaptures: { type: Date, default: null }, // Track last update time
});

const UserLeadCounter = mongoose.model(
  "UserLeadCounter",
  userLeadCounterSchema
);

app.post("/api/update-max-captures", async (req, res) => {
  try {
    console.log("Received Data:", req.body); // Debugging

    const { user_mobile_number, maxCaptures } = req.body;

    if (!user_mobile_number || maxCaptures < 0) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const user = await UserLeadCounter.findOne({ user_mobile_number });

    if (user) {
      // Ensure lastUpdated is a valid Date
      const lastUpdated = user.lastUpdatedMaxCaptures
        ? new Date(user.lastUpdatedMaxCaptures)
        : null;
      const now = new Date();

      if (lastUpdated && now - lastUpdated < 24 * 60 * 60 * 1000) {
        return res.status(403).json({
          message: "You can update Max Captures only once every 24 hours.",
        });
      }

      user.maxCaptures = maxCaptures;
      user.lastUpdatedMaxCaptures = now;
      user.markModified("maxCaptures");
      await user.save({ validateBeforeSave: false }); // Force update

      console.log("Updated User:", user); // Debugging
      return res.json({ message: "Max captures updated successfully", user });
    } else {
      const newUser = new UserLeadCounter({
        user_mobile_number,
        maxCaptures,
        lastUpdatedMaxCaptures: new Date(),
      });
      await newUser.save();
      console.log("New User Created:", newUser); // Debugging

      return res.json({
        message: "Max captures set successfully",
        user: newUser,
      });
    }
  } catch (error) {
    console.error("Error updating max captures:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// GET endpoint to fetch the user's selected states
app.get("/api/get-states", async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }
    const settings = await Settings.findOne({ userEmail });
    if (!settings) {
      return res.json({ states: [] });
    }
    res.json({ states: settings.selectedStates || [] });
  } catch (error) {
    console.error("Error fetching states:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST endpoint to update the user's selected states
app.post("/api/update-states", async (req, res) => {
  try {
    const { userEmail, states } = req.body;
    if (!userEmail || !Array.isArray(states)) {
      return res.status(400).json({ message: "Invalid request data" });
    }
    const updatedSettings = await Settings.findOneAndUpdate(
      { userEmail: userEmail },
      { $set: { selectedStates: states } },
      { new: true, upsert: true }
    );
    res.json({
      message: "States updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating states:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/api/get-max-captures", async (req, res) => {
  try {
    const { user_mobile_number } = req.query;

    let user = await UserLeadCounter.findOne({ user_mobile_number });

    // ✅ If the user is not found, create a new record with default values
    if (!user) {
      user = new UserLeadCounter({ user_mobile_number });
      await user.save();
    }

    res.json({
      maxCaptures: user.maxCaptures,
      lastUpdatedMaxCaptures: user.lastUpdatedMaxCaptures,
    });
  } catch (error) {
    console.error("Error fetching max captures:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const cron = require("node-cron");
async function resetLeadCounters() {
  try {
    console.log("Checking if lead counters need reset...");

    // Get the last reset time from one document
    const lastResetEntry = await UserLeadCounter.findOne({}, "lastReset");

    const lastResetDate = lastResetEntry
      ? new Date(lastResetEntry.lastReset)
      : null;
    const now = new Date();

    // Get today's 7:00 AM
    const today7AM = new Date();
    today7AM.setHours(5, 0, 0, 0);

    // If last reset was before today's 7 AM, reset counters
    if (!lastResetDate || lastResetDate < today7AM) {
      console.log("Resetting lead counters...");
      await UserLeadCounter.updateMany({}, { leadCount: 0, lastReset: now });
      console.log("Lead counters reset successfully.");
    } else {
      console.log("Lead counters were already reset today. No action needed.");
    }
  } catch (error) {
    console.error("Error resetting lead counters:", error);
  }
}

resetLeadCounters();

// Schedule cron job to run every day at 5 AM
cron.schedule("0 5 * * *", resetLeadCounters);

const SUBSCRIPTION_DURATIONS = {
  "one-mo": 30,
  "three-mo": 60,
  "six-mo": 180,
  "year-mo": 365,
};

// cron.schedule("0 6 * * *", async () => {
//   console.log("Running scheduled task at 6:00 AM...");

//   try {
//     const usersToStart = await User.find({
//       autoStartEnabled: true, // Add this flag per user to control auto-start
//     });

//     for (const user of usersToStart) {
//       const settings = await Settings.findOne({ userEmail: user.email });

//       if (
//         !settings ||
//         (!settings.sentences?.length && !settings.wordArray?.length && !settings.h2WordArray?.length)
//       ) {
//         console.log(`Skipping ${user.email}: No valid settings found.`);
//         continue;
//       }

//       if (!user.mobileNumber || !user.savedPassword) {
//         console.log(`Skipping ${user.email}: Missing credentials.`);
//         continue;
//       }

//       // 3. Get the latest payment (based on created_at)
//       const latestPayment = await Payment.findOne({ email: user.email })
//         .sort({ created_at: -1 });

//       if (!latestPayment || !latestPayment.unique_id) {
//         console.log(`⚠️ Skipping ${user.email}: No valid unique_id found in payments.`);
//         continue;
//       }

//       const latestUniqueId = latestPayment.unique_id;

//       const subscriptionDays =
//         SUBSCRIPTION_DURATIONS[latestPayment.subscription_type];
//       if (!subscriptionDays) {
//         console.log(`Skipping ${user.email}: Unknown subscription type.`);
//         continue;
//       }

//       const expirationDate = new Date(latestPayment.created_at);
//       expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

//       // Check if the subscription is still active
//       if (new Date() > expirationDate) {
//         console.log(
//           `Skipping ${user.email
//           }: Subscription expired on ${expirationDate.toDateString()}.`
//         );
//         await User.updateOne({ email: user.email }, { status: "stopped" });
//         continue;
//       }

//       try {
//         await axios.post("https://api.leadscruise.com/api/cycle", {
//           sentences: settings.sentences,
//           wordArray: settings.wordArray,
//           h2WordArray: settings.h2WordArray,
//           mobileNumber: user.mobileNumber,
//           password: user.savedPassword,
//           userEmail: user.email,
//           uniqueId: latestUniqueId,
//           minOrder: settings.minOrder,
//           leadTypes: settings.leadTypes,
//         });
//         console.log(`Started script for ${user.email}`);
//       } catch (error) {
//         console.error(`Failed to start script for ${user.email}:`, error.message);
//       }
//     }
//   } catch (err) {
//     console.error("Cron job error:", err.message);
//   }
// });

app.post("/api/cycle", async (req, res) => {
  console.log("Received raw data:", JSON.stringify(req.body, null, 2));
  let {
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
    userEmail,
    minOrder,
    leadTypes,
    selectedStates,
  } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Empty request body. Ensure the request has a JSON payload.",
    });
  }

  if (
    !Array.isArray(sentences) ||
    !Array.isArray(wordArray) ||
    !Array.isArray(h2WordArray)
  ) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid input format. sentences, wordArray, and h2WordArray should be arrays.",
    });
  }

  if (!mobileNumber || !userEmail || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Mobile number, Email, and uniqueId are required.",
    });
  }

  if (!password) {
    try {
      const userFromDb = await User.findOne({ email: userEmail });
      if (!userFromDb) {
        return res.status(404).json({
          status: "error",
          message: "User not found in database.",
        });
      }
      password = userFromDb.savedPassword; // use saved plain password
      console.log(`Password taken from DB for ${userEmail}`);
    } catch (err) {
      console.error("Error fetching password from DB:", err);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch password from database.",
      });
    }
  }

  // Get current time
  const startTime = new Date();

  // Update user status to "Running" and store the start time
  await User.findOneAndUpdate(
    { email: userEmail },
    { status: "Running", startTime },
    { new: true, upsert: true }
  );

  let userCounter = await UserLeadCounter.findOne({
    user_mobile_number: mobileNumber,
  });

  if (!userCounter) {
    userCounter = new UserLeadCounter({
      user_mobile_number: mobileNumber,
      leadCount: 0,
    });
    await userCounter.save();
  }
  let leadCount = userCounter.leadCount, maxCaptures = userCounter.maxCaptures;

  const inputData = JSON.stringify({
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
    minOrder,
    leadTypes,
    selectedStates,
    leadCount,
    maxCaptures,
  });

  console.log("Spawning Python process for 'final_inside_script_server.py'...");

  const pythonProcess = spawn("python3", ["-u", "final_inside_script_server.py"]);

  // Store the Python process reference using `uniqueId`
  activePythonProcesses.set(uniqueId, pythonProcess);

  console.log("Sending data to Python script:", inputData);
  pythonProcess.stdin.write(inputData + "\n");

  let result = "";
  let error = "";

  pythonProcess.stdout.on("data", (data) => {
    const dataString = data.toString();
    console.log("Python script stdout:", data.toString());
    result += data.toString();
    // Check for buyer balance information
    if (dataString.includes("BUYER_BALANCE:")) {
      const balanceMatch = dataString.match(/BUYER_BALANCE:(\d+)/);
      if (balanceMatch && balanceMatch[1]) {
        const balance = parseInt(balanceMatch[1], 10);

        // Update user's balance in the database
        User.findOneAndUpdate(
          { email: userEmail },
          { buyerBalance: balance },
          { new: true }
        ).then((updatedUser) => {
          console.log(`Updated buyer balance for ${userEmail} to ${balance}`);
        }).catch(err => {
          console.error("Error updating buyer balance:", err);
        });
      }
    }

    // Check for zero balance alert
    if (dataString.includes("ZERO_BALANCE_DETECTED")) {
      // Just log this for now, the balance update above will handle setting to 0
      console.log("Zero balance detected for user:", userEmail);
    }

    // Check for OTP request from Python script
    if (dataString.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for uniqueId:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null
      });
    }

    if (dataString.includes("OTP_FAILED_INCORRECT")) {
      console.log("Incorrect OTP detected for", uniqueId);
      otpFailures.set(uniqueId, true);
    }

    // Check for routing instructions from Python script
    if (dataString.includes("ROUTE_TO:")) {
      const routeMatch = dataString.match(/ROUTE_TO:(.+)/);
      if (routeMatch && routeMatch[1]) {
        const route = routeMatch[1].trim();
        console.log(`Python script requests routing to: ${route}`);

        // Store the route information for the frontend to handle
        if (route === "/execute-task") {
          // Update user status to indicate login issue
          (async () => {
            await User.findOneAndUpdate(
              { email: userEmail },
              { status: "Stopped", autoStartEnabled: false },
              { new: true }
            );

            // Send specific response for login issue
            if (!responseSent) {
              res.status(400).json({
                status: "error",
                message: "Enter password button not found. Please login to your leads provider account first.",
                route: "/execute-task"
              });
              responseSent = true;
            }

            // Kill the Python process since we're handling the response
            pythonProcess.kill("SIGINT");
            activePythonProcesses.delete(uniqueId);
            cleanupDisplay(uniqueId);
          })();
          return;
        }
      }
    }

  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });
  let killedDueToLimit = false;
  // Periodically check if lead limit is exceeded

  let responseSent = false; // Flag to track if response has been sent

  pythonProcess.on("close", async (code) => {
    pythonProcess.stdin.end();
    activePythonProcesses.delete(uniqueId); // Remove from tracking
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    console.log(`Python script exited with code: ${code}`);

    // Cleanup display lock file
    cleanupDisplay(uniqueId);

    // Reset user status and remove startTime when the script stops
    if (!killedDueToLimit) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { status: "Stopped", startTime: new Date(), autoStartEnabled: false },
        { new: true }
      );
    }

    // Only send response if one hasn't been sent already
    if (!responseSent) {
      if (code === 0) {
        res.json({ status: "success", message: "Successfully executed!!" });
      } else {
        res.status(500).json({
          status: "error",
          message: `AI failed`,
        });
      }
      responseSent = true;
    }
  });
});

app.get("/api/check-otp-request/:uniqueId", (req, res) => {
  const { uniqueId } = req.params;
  const otpRequest = otpRequests.get(uniqueId);

  if (otpRequest && !otpRequest.otpReceived) {
    res.json({
      otpRequired: true,
      requestId: otpRequest.requestId,
      type: otpRequest.type || "login"
    });
  } else {
    res.json({
      otpRequired: false
    });
  }
});

app.get("/api/check-otp-failure/:uniqueId", (req, res) => {
  const { uniqueId } = req.params;
  if (otpFailures.has(uniqueId)) {
    return res.json({ otpFailed: true });
  } else {
    return res.json({ otpFailed: false });
  }
});

// New endpoint to submit OTP
app.post("/api/submit-otp", async (req, res) => {
  const { otp, userEmail, uniqueId, requestId } = req.body;

  if (!otp || !uniqueId || !requestId) {
    return res.status(400).json({
      status: "error",
      message: "OTP, uniqueId, and requestId are required."
    });
  }

  const otpRequest = otpRequests.get(uniqueId);

  if (!otpRequest || otpRequest.requestId !== requestId) {
    return res.status(400).json({
      status: "error",
      message: "Invalid OTP request."
    });
  }

  // Update the OTP request with the received OTP
  otpRequest.otp = otp;
  otpRequest.otpReceived = true;
  otpRequests.set(uniqueId, otpRequest);

  // Send OTP to Python script
  const pythonProcess = activePythonProcesses.get(uniqueId);
  if (pythonProcess && !pythonProcess.killed) {
    try {
      const otpData = JSON.stringify({ type: "OTP_RESPONSE", otp: otp });
      pythonProcess.stdin.write(otpData + "\n");
      console.log(`Sent OTP ${otp} to Python process for uniqueId: ${uniqueId}, type: ${otpRequest.type || "login"}`);
    } catch (error) {
      console.error("Error sending OTP to Python process:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to send OTP to automation script."
      });
    }
  } else {
    return res.status(400).json({
      status: "error",
      message: "Automation script is not running."
    });
  }

  res.json({
    status: "success",
    message: "OTP submitted successfully."
  });
});

// API to stop the script
app.post("/api/stop", async (req, res) => {
  const { userEmail, uniqueId } = req.body;
  if (!uniqueId || !userEmail) {
    return res
      .status(400)
      .json({ status: "error", message: "uniqueId and Email are required." });
  }

  const user = await User.findOne({ email: userEmail });
  if (!user || !user.startTime) {
    if (user) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { autoStartEnabled: false },
        { new: true }
      );
    }
    return res.status(404).json({
      status: "error",
      message: "No running AI found for this user.",
    });
  }

  const startTime = new Date(user.startTime);
  const currentTime = new Date();
  const elapsedTime = Math.floor((currentTime - startTime) / 1000); // in seconds

  if (elapsedTime < 300) {
    return res.status(403).json({
      status: "error",
      message: `Please wait at least ${Math.ceil(
        (300 - elapsedTime) / 60
      )} more minutes before stopping.`,
    });
  }

  const pythonProcess = activePythonProcesses.get(uniqueId);
  if (pythonProcess) {
    console.log("Sending SIGINT (Ctrl+C) to Python script...");
    activePythonProcesses.delete(uniqueId);
    cleanupDisplay(uniqueId);
    pythonProcess.kill("SIGINT"); // Send SIGINT to allow graceful shutdown
  }

  // Reset user status and startTime in DB
  await User.findOneAndUpdate(
    { email: userEmail },
    { status: "Stopped", startTime: new Date(), autoStartEnabled: false },
    { new: true }
  );

  res.json({ status: "success", message: "Stopped Sucessfully" });
});

/**
 * Cleanup function to remove /tmp/.X<DISPLAY>-lock
 * based on the uniqueId's assigned display number.
 */
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

app.get("/api/user/balance", async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      buyerBalance: user.buyerBalance,
      hasZeroBalance: user.buyerBalance === 0
    });
  } catch (error) {
    console.error("Error fetching user balance:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Define Schema
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  mobile: { type: String, required: true },
  user_mobile_number: { type: String, required: true },
  lead_bought: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Lead = mongoose.model("Lead", leadSchema);
const WhatsAppSettings = require("./models/WhatsAppSettings");
// Endpoint to receive lead data from Selenium script and store in DB
app.post("/api/store-lead", async (req, res) => {
  try {
    const { name, email, mobile, user_mobile_number, lead_bought, address } = req.body;

    if (!name || !mobile || !user_mobile_number || !lead_bought) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch or create user lead counter
    let userCounter = await UserLeadCounter.findOne({ user_mobile_number });
    if (!userCounter) {
      userCounter = new UserLeadCounter({
        user_mobile_number,
        leadCount: 0,
        maxCaptures: 10, // or set a default if needed
      });
    }

    // Check for duplicate lead within last 4 days
    const existingLead = await Lead.findOne({
      name,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
    });

    if (existingLead) {
      const timeDiff = (new Date() - existingLead.createdAt) / 1000; // in seconds
      if (timeDiff < 345600) { // within 4 days
        console.log("Duplicate lead detected. Skipping.");
        return res.status(409).json({ error: "Duplicate lead detected" });
      }
    }

    // Store the new lead
    const newLead = new Lead({
      name,
      email,
      mobile,
      user_mobile_number,
      lead_bought,
      createdAt: new Date(),
      address,
    });
    await newLead.save();

    // Increment lead count
    userCounter.leadCount += 1;
    await userCounter.save();

    console.log("Lead Data Stored:", newLead);

    return res.json({
      message: "Lead data stored successfully",
      lead: newLead,
    });

  } catch (error) {
    console.error("Error saving lead:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/get-all-leads", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }); // Sort by latest leads first
    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/get-leads/:mobileNumber", async (req, res) => {
  try {
    const { mobileNumber } = req.params;

    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    // Fetch leads that match the mobileNumber
    const leads = await Lead.find({ user_mobile_number: mobileNumber }).sort({
      createdAt: -1,
    });

    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const FetchedLead = mongoose.model("FetchedLead", leadSchema, "fetchedleads");

app.post("/api/store-fetched-lead", async (req, res) => {
  try {
    const { name, email, mobile, user_mobile_number, lead_bought, timestamp_text, uniqueId, address } = req.body;

    if (!name || !mobile || !user_mobile_number || !lead_bought || !timestamp_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check for duplicate leads     
    const existingLead = await FetchedLead.findOne({
      name,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
    });

    // If duplicate found, stop the Python script for this user
    if (existingLead) {
      console.log("Duplicate lead detected. Stopping script for user:", user_mobile_number);

      // Find and terminate the Python process for this user
      const processKey = uniqueId ? uniqueId + 100000 : null;
      if (processKey && activePythonProcesses.has(processKey)) {
        const pythonProcess = activePythonProcesses.get(processKey);

        // Try graceful termination first
        try {
          pythonProcess.kill('SIGTERM');

          // If graceful termination doesn't work after 2 seconds, force kill
          setTimeout(() => {
            if (activePythonProcesses.has(processKey)) {
              console.log(`Force killing Python process for uniqueId: ${uniqueId}`);
              pythonProcess.kill('SIGKILL');
            }
          }, 2000);

        } catch (error) {
          console.error("Error terminating Python process:", error);
          // Force kill if SIGTERM fails
          pythonProcess.kill('SIGKILL');
        }

        // Remove from active processes
        activePythonProcesses.delete(processKey);

        // Clean up OTP requests
        if (uniqueId && otpRequests.has(uniqueId)) {
          otpRequests.delete(uniqueId);
          otpFailures.delete(uniqueId);
        }

        // Cleanup display lock file
        cleanupDisplay(uniqueId);

        console.log(`Python process terminated for uniqueId: ${uniqueId}`);
      }

      return res.status(409).json({
        error: "DUPLICATE_LEAD_STOP_SCRIPT",
        message: "Lead fetching stopped due to duplicate detection",
        action: "script_terminated"
      });
    }

    // Store the new lead     
    const newLead = new FetchedLead({
      name,
      email,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
      createdAt: timestamp_text ? new Date(timestamp_text) : new Date(),
    });
    await newLead.save();

    console.log("Lead Data Stored:", newLead);

    // Fetch WhatsApp settings
    const settings = await WhatsAppSettings.findOne({ mobileNumber: user_mobile_number });
    const user = await User.findOne({ mobileNumber: user_mobile_number });

    if (!settings || !settings.whatsappNumber || !settings.messages) {
      console.warn("No WhatsApp settings found for this user");
      return res.json({ message: "Lead data stored successfully", lead: newLead });
    }

    const receiverNumber = mobile; // Use the mobile number from the lead
    let templateMessage = settings.messages[0];
    templateMessage = templateMessage
      .replace("{lead_name}", name)
      .replace("{lead_product_requested}", lead_bought)
      .replace("{leadscruise_email}", user?.email || "support@leadscruise.com");

    // Update WhatsApp settings messages to send the updated one
    const messagesJSON = JSON.stringify([templateMessage]);
    const whatsappNumber = settings.whatsappNumber;

    console.log("Launching WhatsApp script with parameters:");
    console.log("WhatsApp Number:", whatsappNumber);
    console.log("Receiver Number:", receiverNumber);

    // Process the WhatsApp messaging and WAIT for completion
    try {
      // Create a promise to handle the Python process
      const pythonProcessPromise = new Promise((resolve, reject) => {
        let verificationCode = null;
        let errorOutput = "";
        let isCompleted = false;

        // Start the Python process
        const pythonProcess = spawn('python3', [
          'whatsapp.py',
          whatsappNumber,
          messagesJSON,
          receiverNumber,
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
                { mobileNumber: user_mobile_number }, // Fixed: changed from mobileNumber to user_mobile_number
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

          // Don't fail for specific errors that we want to tolerate
          if (errorMsg.includes("Send button not found or not clickable")) {
            console.warn("Send button issue detected, continuing with process");
            // We don't want to fail the entire process for this error
          }
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

      // NOW respond to the client after WhatsApp script has fully completed
      return res.json({
        message: "Lead data stored successfully and WhatsApp messaging completed",
        lead: newLead,
        whatsapp: result
      });

    } catch (pythonError) {
      console.error("Error in WhatsApp script execution:", pythonError);

      // Return response even if WhatsApp script fails
      return res.json({
        message: "Lead data stored successfully but WhatsApp messaging failed",
        lead: newLead,
        whatsapp: { success: false, error: pythonError.message }
      });
    }

  } catch (error) {
    console.error("Error saving lead:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/start-fetching-leads", async (req, res) => {
  console.log("Received raw data:", JSON.stringify(req.body, null, 2));
  let {
    mobileNumber,
    password,
    uniqueId,
    userEmail,
  } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Empty request body. Ensure the request has a JSON payload.",
    });
  }

  if (!mobileNumber || !password || !userEmail || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Mobile number, Email, password, and uniqueId are required.",
    });
  }

  // Get current time
  const startTime = new Date();
  const inputData = JSON.stringify({
    mobileNumber,
    password,
    uniqueId,
  });

  console.log("Spawning Python process for 'lead_fetch_script.py'...");
  const pythonProcess = spawn("python3", ["-u", "lead_fetch_script.py"]);

  // Store the Python process reference using `uniqueId`
  const processKey = uniqueId + 100000;
  activePythonProcesses.set(processKey, pythonProcess);

  console.log("Sending data to Python script:", inputData);
  pythonProcess.stdin.write(inputData + "\n");

  let result = "";
  let error = "";

  pythonProcess.stdout.on("data", (data) => {
    const dataString = data.toString();
    console.log("Python script stdout:", data.toString());
    result += data.toString();

    // Check for OTP request from Python script
    if (dataString.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for uniqueId:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null
      });
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });

  pythonProcess.on("close", async (code) => {
    pythonProcess.stdin.end();
    activePythonProcesses.delete(processKey); // Remove from tracking
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    console.log(`Python script exited with code: ${code}`);

    // Cleanup display lock file
    cleanupDisplay(uniqueId);

    if (code === 0) {
      res.json({ status: "success", message: "Successfully executed!!" });
    } else if (code === null || code === 15) { // SIGTERM signal
      res.json({
        status: "terminated",
        message: "Script terminated due to duplicate lead detection"
      });
    } else {
      res.status(500).json({
        status: "error",
        message: `AI failed`,
      });
    }
  });

  // Handle process termination errors
  pythonProcess.on('error', (err) => {
    console.error('Python process error:', err);
    activePythonProcesses.delete(processKey);
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    cleanupDisplay(uniqueId);
  });
});

app.get("/api/get-user-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Get total count
    const totalLeads = await FetchedLead.countDocuments({
      user_mobile_number: userMobile
    });

    // Fetch all leads without pagination
    const leads = await FetchedLead.find({
      user_mobile_number: userMobile
    })
      .sort({ createdAt: -1 }) // Sort by newest first
      .select('name email mobile lead_bought createdAt address'); // Select only needed fields

    res.status(200).json({
      success: true,
      leads,
      totalLeads
    });

  } catch (error) {
    console.error("Error fetching user leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Keep the count endpoint if needed elsewhere
app.get("/api/get-user-leads-count/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    const count = await FetchedLead.countDocuments({
      user_mobile_number: userMobile
    });

    res.status(200).json({
      success: true,
      count
    });

  } catch (error) {
    console.error("Error fetching leads count:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Optional: Get leads with filters (date range, lead source, etc.)
app.get("/api/get-filtered-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;
    const {
      page = 1,
      limit = 10,
      leadSource,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Build filter query
    let filterQuery = { user_mobile_number: userMobile };

    // Filter by lead source
    if (leadSource) {
      filterQuery.lead_bought = leadSource;
    }

    // Filter by date range
    if (startDate || endDate) {
      filterQuery.createdAt = {};
      if (startDate) {
        filterQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filterQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Search in name, email, or mobile
    if (search) {
      filterQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalLeads = await FetchedLead.countDocuments(filterQuery);

    // Fetch leads with filters and pagination
    const leads = await FetchedLead.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name email mobile lead_bought createdAt');

    const totalPages = Math.ceil(totalLeads / parseInt(limit));

    res.status(200).json({
      success: true,
      leads,
      totalLeads,
      totalPages,
      currentPage: parseInt(page),
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      filters: {
        leadSource,
        startDate,
        endDate,
        search
      }
    });

  } catch (error) {
    console.error("Error fetching filtered leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Export leads to CSV
app.get("/api/export-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;
    const { leadSource, startDate, endDate } = req.query;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Build filter query
    let filterQuery = { user_mobile_number: userMobile };

    if (leadSource) {
      filterQuery.lead_bought = leadSource;
    }

    if (startDate || endDate) {
      filterQuery.createdAt = {};
      if (startDate) {
        filterQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filterQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Fetch all leads matching the filter
    const leads = await FetchedLead.find(filterQuery)
      .sort({ createdAt: -1 })
      .select('name email mobile lead_bought createdAt');

    // Convert to CSV format
    const csvHeader = 'Name,Email,Mobile,Lead Source,Date\n';
    const csvRows = leads.map(lead => {
      const date = new Date(lead.createdAt).toLocaleDateString();
      return `"${lead.name}","${lead.email || ''}","${lead.mobile}","${lead.lead_bought}","${date}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${userMobile}_${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(csvContent);

  } catch (error) {
    console.error("Error exporting leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

app.post('/api/reset-user-data', async (req, res) => {//start 26-8(7)
  try {
    const { userEmail, userMobile } = req.body;

    if (!userEmail || !userMobile) {
      return res.status(400).json({ success: false, message: "User email and mobile are required" });
    }
    if (userEmail === "demo@leadscruise.com") {
        return res.status(403).json({ success: false, message: "Demo account cannot be modified" });
    }

    const user = await User.findOne({ email: userEmail });

    if (!user) {
        await Lead.deleteMany({ user_mobile_number: userMobile });
        await FetchedLead.deleteMany({ user_mobile_number: userMobile });
        await Settings.deleteOne({ userEmail: userEmail });
        return res.status(200).json({ success: true, message: "User not found, but associated data cleared." });
    }

    // Delete all related data
    await Promise.all([
      BillingDetails.deleteOne({ email: user.email }),
      IndiaMartAnalytics.deleteMany({ userId: user._id }),
      Payment.deleteMany({ email: user.email }),
      Referral.deleteOne({ email: user.email }),
      Settings.deleteOne({ userEmail: user.email }),
      Support.deleteMany({ email: user.email }),
      WhatsappSettings.deleteOne({ mobileNumber: user.mobileNumber }),
      Lead.deleteMany({ user_mobile_number: user.mobileNumber }),
      FetchedLead.deleteMany({ user_mobile_number: user.mobileNumber }),
    ]);

    // --- THIS IS THE FIX ---
    // Instead of user.save(), we issue a direct update to unset the password.
    // This bypasses the validation that was causing the error.
    await User.updateOne(
      { _id: user._id },
      { $unset: { savedPassword: "" } } // Removes the savedPassword field
    );

    res.status(200).json({ success: true, message: "User data, settings, and password have been reset successfully" });

  } catch (err) {
    console.error('Reset user data error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});// end 26-8(7)

app.delete("/api/delete-user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete from all collections
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      BillingDetails.deleteOne({ email: user.email }),
      IndiaMartAnalytics.deleteMany({ userId: user._id }),
      Payment.deleteMany({ email: user.email }),
      Referral.deleteOne({ email: user.email }),
      Settings.deleteOne({ userEmail: user.email }),
      Support.deleteMany({ email: user.email }),
      WhatsappSettings.deleteOne({ mobileNumber: user.mobileNumber }),
      Lead.deleteMany({ user_mobile_number: user.mobileNumber }),
      FetchedLead.deleteMany({ user_mobile_number: user.mobileNumber }),
    ]);

    res.json({ message: "User and all related data deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
