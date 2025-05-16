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
const Settings = require('./models/Settings'); // adjust the path if needed
const paymentRoutes = require("./routes/paymentRoutes");
const emailRoutes = require("./routes/emailRoutes");
const billingDetailsRoutes = require("./routes/billingDetailsRoutes");
const axios = require('axios');
const { createServer } = require("http");
const { Server } = require("socket.io");
const referralRoutes = require("./routes/referralRoutes");
const statusRoutes = require("./routes/snapshRoutes");
const whatsappSettingsRoutes = require("./routes/whatsappSettingsRoutes");
const analyticsRouter = require("./routes/analytics.js");
const server = createServer(app); // ✅ Create HTTP server
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

    res.json({ success: true, message: "Payment details saved successfully" });
  } catch (error) {
    console.error("Error saving payment details:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// Helper function to get subscription duration in days based on type
function getSubscriptionDuration(subscription_type) {
  switch (subscription_type) {
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
// API Endpoint to check if a number exists in the database
app.post("/api/check-number", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    // Validate input
    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile number is required." });
    }

    // Check if the number exists in the userSchema
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
    } else {
      return res.json({ exists: false, message: "Number is not subscribed." });
    }
  } catch (error) {
    console.error("Error checking number:", error.message);
    res.status(500).json({
      message: "Error occurred while checking the number.",
      error: error.message,
    });
  }
});

app.post("/api/execute-task", async (req, res) => {
  const { mobileNumber, password, email } = req.body;

  if (!mobileNumber || !password || !email) {
    return res.status(400).json({
      status: "error",
      message: "Email, Mobile Number, and Password are required.",
    });
  }

  // Spawn a new Python process to execute the task
  const pythonProcess = spawn("python3", [
    "login_check.py",
    mobileNumber,
    password,
  ]);

  let result = "";
  let error = "";

  // Capture standard output (stdout)
  pythonProcess.stdout.on("data", (data) => {
    result += data.toString();
  });

  // Capture standard error (stderr)
  pythonProcess.stderr.on("data", (data) => {
    error += data.toString();
  });

  // Handle Python script execution completion
  pythonProcess.on("close", async (code) => {
    if (code === 0) {
      try {
        const extractedApiKey = result.trim(); // Get the API key from Python script output
        console.log("Extracted API Key:", extractedApiKey);

        let user = await User.findOne({ email });

        if (!user) {
          return res
            .status(404)
            .json({ status: "error", message: "User not found" });
        }

        // ✅ **Update user record with API Key**
        user.mobileNumber = mobileNumber;
        user.savedPassword = password;
        user.apiKey = extractedApiKey; // ✅ Store extracted API key
        await user.save();

        return res.json({
          status: "success",
          message: "API Key extracted and saved!",
          apiKey: extractedApiKey,
        });
      } catch (dbError) {
        console.error("Database error:", dbError);
        return res
          .status(500)
          .json({ status: "error", message: "Database error" });
      }
    } else {
      return res.status(500).json({
        status: "error",
        message: `AI failed with error: ${error.trim()}`,
      });
    }
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

    if (!user_mobile_number || maxCaptures < 1) {
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

const activePythonProcesses = new Map(); // Store active processes by user_mobile_number

const SUBSCRIPTION_DURATIONS = {
  "one-mo": 30,
  "three-mo": 60,
  "six-mo": 180,
  "year-mo": 365,
};

cron.schedule("0 6 * * *", async () => {
  console.log("Running scheduled task at 6:00 AM...");

  try {
    const usersToStart = await User.find({
      autoStartEnabled: true, // Add this flag per user to control auto-start
    });

    for (const user of usersToStart) {
      const settings = await Settings.findOne({ userEmail: user.email });

      if (
        !settings ||
        (!settings.sentences?.length && !settings.wordArray?.length && !settings.h2WordArray?.length)
      ) {
        console.log(`Skipping ${user.email}: No valid settings found.`);
        continue;
      }

      if (!user.mobileNumber || !user.savedPassword) {
        console.log(`Skipping ${user.email}: Missing credentials.`);
        continue;
      }

      // 3. Get the latest payment (based on created_at)
      const latestPayment = await Payment.findOne({ email: user.email })
        .sort({ created_at: -1 });

      if (!latestPayment || !latestPayment.unique_id) {
        console.log(`⚠️ Skipping ${user.email}: No valid unique_id found in payments.`);
        continue;
      }

      const latestUniqueId = latestPayment.unique_id;

      const subscriptionDays =
        SUBSCRIPTION_DURATIONS[latestPayment.subscription_type];
      if (!subscriptionDays) {
        console.log(`Skipping ${user.email}: Unknown subscription type.`);
        continue;
      }

      const expirationDate = new Date(latestPayment.created_at);
      expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

      // Check if the subscription is still active
      if (new Date() > expirationDate) {
        console.log(
          `Skipping ${user.email
          }: Subscription expired on ${expirationDate.toDateString()}.`
        );
        await User.updateOne({ email: user.email }, { status: "stopped" });
        continue;
      }

      try {
        await axios.post("https://api.leadscruise.com/api/cycle", {
          sentences: settings.sentences,
          wordArray: settings.wordArray,
          h2WordArray: settings.h2WordArray,
          mobileNumber: user.mobileNumber,
          password: user.savedPassword,
          userEmail: user.email,
          uniqueId: latestUniqueId,
        });
        console.log(`Started script for ${user.email}`);
      } catch (error) {
        console.error(`Failed to start script for ${user.email}:`, error.message);
      }
    }
  } catch (err) {
    console.error("Cron job error:", err.message);
  }
});

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

  if (!mobileNumber || !password || !userEmail || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Mobile number, Email, password, and uniqueId are required.",
    });
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

  if (userCounter.leadCount >= userCounter.maxCaptures) {
    console.log("Lead limit reached. Cannot capture more leads today.");
    await User.findOneAndUpdate(
      { email: userEmail },
      { autoStartEnabled: true },
      { new: true }
    );
    return res.status(403).json({
      status: "error",
      message: "Lead limit reached. Cannot capture more leads today.",
    });
  }

  const inputData = JSON.stringify({
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
    minOrder,
  });

  console.log("Spawning Python process for 'final_inside_script_server.py'...");

  const pythonProcess = spawn("python3", ["final_inside_script_server.py"]);

  // Store the Python process reference using `uniqueId`
  activePythonProcesses.set(uniqueId, pythonProcess);

  console.log("Sending data to Python script:", inputData);
  pythonProcess.stdin.write(inputData + "\n");
  pythonProcess.stdin.end();

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
    });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });
  let killedDueToLimit = false;
  // Periodically check if lead limit is exceeded
  const leadCheckInterval = setInterval(async () => {
    let updatedUserCounter = await UserLeadCounter.findOne({
      user_mobile_number: mobileNumber,
    });

    if (updatedUserCounter.leadCount >= updatedUserCounter.maxCaptures) {
      console.log("Lead limit exceeded! Killing Python script...");
      await User.findOneAndUpdate(
        { email: userEmail },
        { autoStartEnabled: true },
        { new: true }
      );
      killedDueToLimit = true;
      pythonProcess.kill("SIGINT"); // Kill the script
      activePythonProcesses.delete(uniqueId);
      clearInterval(leadCheckInterval);
      cleanupDisplay(uniqueId); // Cleanup display lock file
      res.status(403).json({
        status: "error",
        message: "Lead limit reached. Cannot capture more leads today.",
      });
    }
  }, 3000); // Check every 3 seconds

  pythonProcess.on("close", async (code) => {
    clearInterval(leadCheckInterval); // Stop checking when script completes
    activePythonProcesses.delete(uniqueId); // Remove from tracking

    console.log(`Python script exited with code: ${code}`);

    // Cleanup display lock file
    cleanupDisplay(uniqueId);

    // Reset user status and remove startTime when the script stops
    if (!killedDueToLimit) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { status: "Stopped", startTime: null, autoStartEnabled: false },
        { new: true }
      );
    }

    if (code === 0) {
      res.json({ status: "success", message: "Successfully executed!!" });
    } else {
      res.status(500).json({
        status: "error",
        message: `AI failed`,
      });
    }
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
    { status: "Stopped", startTime: null, autoStartEnabled: false },
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
    const user = await User.findOne({ email});
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
  createdAt: { type: Date, default: Date.now }, // Store the current date
});

const Lead = mongoose.model("Lead", leadSchema);
const WhatsAppSettings = require("./models/WhatsAppSettings"); 
// Endpoint to receive lead data from Selenium script and store in DB
app.post("/api/store-lead", async (req, res) => {
  try {
    const { name, email, mobile, user_mobile_number, lead_bought } = req.body;
    
    if (!name || !mobile || !user_mobile_number || !lead_bought) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Fetch user lead counter
    let userCounter = await UserLeadCounter.findOne({ user_mobile_number });
    if (!userCounter) {
      userCounter = new UserLeadCounter({ user_mobile_number, leadCount: 0 });
    }
    
    // Stop script if limit is reached
    if (userCounter.leadCount >= userCounter.maxCaptures) {
      console.log("Lead limit reached for user:", user_mobile_number);
      return res.status(403).json({
        error: "Lead limit reached. Cannot capture more leads today.",
      });
    }
    
    // Check for duplicate leads
    const existingLead = await Lead.findOne({
      mobile,
      user_mobile_number,
      lead_bought,
    });
    
    // If duplicate found within last X minutes
    if (existingLead) {
      const timeDiff = (new Date() - existingLead.createdAt) / 1000; // in seconds
      if (timeDiff < 300) { // e.g. within 5 minutes
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
    });
    await newLead.save();
    
    // Increment lead count
    userCounter.leadCount += 1;
    await userCounter.save();
    
    console.log("Lead Data Stored:", newLead);
    
    // Fetch WhatsApp settings
    const settings = await WhatsAppSettings.findOne({ mobileNumber: user_mobile_number });
    
    if (!settings || !settings.whatsappNumber || !settings.messages) {
      console.warn("No WhatsApp settings found for this user");
      return res.json({ message: "Lead data stored successfully", lead: newLead });
    } else {
      const receiverNumber = mobile; // Use the mobile number from the lead
      const messagesJSON = JSON.stringify(settings.messages);
      const whatsappNumber = settings.whatsappNumber;
      
      console.log("Launching WhatsApp script with parameters:");
      console.log("WhatsApp Number:", whatsappNumber);
      console.log("Receiver Number:", receiverNumber);
      
      // Do NOT respond to the client yet - we'll wait for the full WhatsApp process
      // to complete or timeout before responding
      
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
                  { mobileNumber: user_mobile_number },
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
      }
    }
  } catch (error) {
    console.error("Error saving lead:", error);
  }
});

// Endpoint to retrieve all leads from DB
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

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
