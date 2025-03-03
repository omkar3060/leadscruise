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
const Payment = require("./models/Payment");
const paymentRoutes = require("./routes/paymentRoutes");
const billingDetailsRoutes = require("./routes/billingDetailsRoutes");
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
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

    const options = req.body;
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }

    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});


app.post("/order/validate", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      return res.json({ success: true, msg: "success", orderId: razorpay_order_id, paymentId: razorpay_payment_id });
    } else {
      return res.status(400).json({ success: false, error: "Invalid signature" });
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
      const subscriptionDuration = getSubscriptionDuration(latestPayment.subscription_type); // Helper function for duration in days
      const subscriptionEndDate = new Date(latestPayment.created_at);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDuration);

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

  // Spawn a new Python process to validate credentials
  const pythonProcess = spawn("python3", ["login_check.py", mobileNumber, password]);

  let result = "";
  let error = "";

  // Collect Python script output
  pythonProcess.stdout.on("data", (data) => {
    result += data.toString();
  });

  // Collect Python script errors
  pythonProcess.stderr.on("data", (data) => {
    error += data.toString();
  });

  // Handle script execution completion
  pythonProcess.on("close", async (code) => {
    if (code === 0) {
      try {
        // Hash password before saving

        // Find user by email and update mobileNumber and password
        let user = await User.findOne({ email });

        if (!user) {
          return res.status(404).json({ status: "error", message: "User not found" });
        }

        user.mobileNumber = mobileNumber;
        user.savedPassword = password; 

        await user.save();

        return res.json({ status: "success", message: "Task executed and details saved!" });
      } catch (dbError) {
        console.error("Database error:", dbError);
        return res.status(500).json({ status: "error", message: "Database error" });
      }
    } else {
      return res.status(500).json({
        status: "error",
        message: `Python script failed with error: ${error.trim()}`,
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

const UserLeadCounter = mongoose.model("UserLeadCounter", userLeadCounterSchema);

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
      const lastUpdated = user.lastUpdatedMaxCaptures ? new Date(user.lastUpdatedMaxCaptures) : null;
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

      return res.json({ message: "Max captures set successfully", user: newUser });
    }
  } catch (error) {
    console.error("Error updating max captures:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/get-max-captures", async (req, res) => {
  try {
    const { user_mobile_number } = req.query;

    const user = await UserLeadCounter.findOne({ user_mobile_number });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      maxCaptures: user.maxCaptures,
      lastUpdatedMaxCaptures: user.lastUpdatedMaxCaptures
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

    const lastResetDate = lastResetEntry ? new Date(lastResetEntry.lastReset) : null;
    const now = new Date();

    // Get today's 7:00 AM
    const today7AM = new Date();
    today7AM.setHours(7, 0, 0, 0);

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

// Schedule cron job to run every day at 7 AM
cron.schedule("0 7 * * *", resetLeadCounters);

const activePythonProcesses = new Map(); // Store active processes by user_mobile_number

app.post("/api/cycle", async (req, res) => {
  console.log("Received raw data:", JSON.stringify(req.body, null, 2));
  let { sentences, wordArray, h2WordArray, mobileNumber, password, uniqueId, userEmail } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ status: "error", message: "Empty request body. Ensure the request has a JSON payload." });
  }

  if (!Array.isArray(sentences) || !Array.isArray(wordArray) || !Array.isArray(h2WordArray)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid input format. sentences, wordArray, and h2WordArray should be arrays.",
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

  let userCounter = await UserLeadCounter.findOne({ user_mobile_number: mobileNumber });

  if (!userCounter) {
    userCounter = new UserLeadCounter({ user_mobile_number: mobileNumber, leadCount: 0 });
    await userCounter.save();
  }

  if (userCounter.leadCount >= userCounter.maxCaptures) {
    return res.status(403).json({ status: "error", message: "Lead limit reached. Cannot capture more leads today." });
  }

  const inputData = JSON.stringify({
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
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
    console.log("Python script stdout:", data.toString());
    result += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });

  // Periodically check if lead limit is exceeded
  const leadCheckInterval = setInterval(async () => {
    let updatedUserCounter = await UserLeadCounter.findOne({ user_mobile_number: mobileNumber });

    if (updatedUserCounter.leadCount >= updatedUserCounter.maxCaptures) {
      console.log("Lead limit exceeded! Killing Python script...");
      pythonProcess.kill("SIGTERM"); // Kill the script
      activePythonProcesses.delete(uniqueId);
      clearInterval(leadCheckInterval);
      cleanupDisplay(uniqueId); // Cleanup display lock file
      res.status(403).json({ status: "error", message: "Lead limit reached. Cannot capture more leads today." });
    }
  }, 3000); // Check every 3 seconds

  pythonProcess.on("close", async (code) => {
    clearInterval(leadCheckInterval); // Stop checking when script completes
    activePythonProcesses.delete(uniqueId); // Remove from tracking

    console.log(`Python script exited with code: ${code}`);

    // Cleanup display lock file
    cleanupDisplay(uniqueId);

    // Reset user status and remove startTime when the script stops
    await User.findOneAndUpdate(
      { email: userEmail },
      { status: "Stopped", startTime: null },
      { new: true }
    );

    if (code === 0) {
      res.json({ status: "success", message: result.trim() });
    } else {
      res.status(500).json({
        status: "error",
        message: `Python script failed: ${error.trim()}`,
      });
    }
  });
});

// API to stop the script
app.post("/api/stop", async (req, res) => {
  const { userEmail, uniqueId } = req.body;
  if (!uniqueId || !userEmail) {
    return res.status(400).json({ status: "error", message: "uniqueId and Email are required." });
  }

  const user = await User.findOne({ email: userEmail });
  if (!user || !user.startTime) {
    return res.status(404).json({ status: "error", message: "No running process found for this user." });
  }

  const startTime = new Date(user.startTime);
  const currentTime = new Date();
  const elapsedTime = Math.floor((currentTime - startTime) / 1000); // in seconds

  if (elapsedTime < 300) { // Less than 5 minutes
    return res.status(403).json({
      status: "error",
      message: `Please wait at least ${Math.ceil((300 - elapsedTime) / 60)} more minutes before stopping.`,
    });
  }

  const pythonProcess = activePythonProcesses.get(uniqueId);
  if (pythonProcess) {
    console.log("Stopping Python script...");
    pythonProcess.kill("SIGTERM");
    activePythonProcesses.delete(uniqueId);
    cleanupDisplay(uniqueId); // Cleanup display lock file
  }

  // Reset user status and startTime in DB
  await User.findOneAndUpdate(
    { email: userEmail },
    { status: "Stopped", startTime: null },
    { new: true }
  );

  res.json({ status: "success", message: "Script stopped successfully after 5 minutes." });
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

// Define Schema
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  mobile: { type: String, required: true },
  user_mobile_number: { type: String, required: true },
  lead_bought: { type: String },
  createdAt: { type: Date, default: Date.now } // Store the current date
});

const Lead = mongoose.model("Lead", leadSchema);

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
      return res.status(403).json({ error: "Lead limit reached. Cannot capture more leads today." });
    }

    // Store the new lead
    const newLead = new Lead({ name, email, mobile, user_mobile_number, lead_bought, createdAt: new Date() });
    await newLead.save();

    // Increment lead count
    userCounter.leadCount += 1;
    await userCounter.save();
    if (userCounter.leadCount >= userCounter.maxCaptures) {
      console.log("Lead limit reached for user:", user_mobile_number);
      return res.status(403).json({ error: "Lead limit reached. Cannot capture more leads today." });
    }

    console.log("Lead Data Stored:", newLead);
    res.json({ message: "Lead data stored successfully", lead: newLead });

  } catch (error) {
    console.error("Error saving lead:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const leads = await Lead.find({ user_mobile_number: mobileNumber }).sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
