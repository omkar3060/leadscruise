const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Import dotenv at the top
const Payment = require("../models/Payment");
const { spawn } = require("child_process");
const SECRET_KEY = process.env.SECRET_KEY; // Load from .env file
const crypto = require('crypto');

exports.signup = async (req, res) => {
  try {
    const { refId, email, mobileNumber, password, confPassword } = req.body;
    console.log("Received sign-up request:", req.body);
    // Validate input
    if (!email || !password || !confPassword) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    if (password !== confPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already signed up. Please log in!!!" });
    }

    // Debugging: Log password before hashing
    console.log("Raw password:", password);

    // Hash the password (Ensure password is a string)
    const hashedPassword = await bcrypt.hash(password.toString(), 10);
    const adminPassword = "6daa726eda58b3c3c061c3ef0024ffaa";
    const hashedAdminPassword = adminPassword;

    console.log("Hashed password:", hashedPassword);

    // Create a new user
    const newUser = new User({
      email,
      password: hashedPassword,
      adminPassword: hashedAdminPassword,
      refId,
      firstTime: true,
      phoneNumber: mobileNumber,
    });

    await newUser.save();
    const token = jwt.sign({ email: newUser.email }, SECRET_KEY, {
      expiresIn: "1h",
    });

    res.json({ message: "Sign-up successful!", token });
  } catch (error) {
    console.error("Sign-up error:", error.message);
    res.status(500).json({ message: "Sign-up failed", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, emailVerified } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found. Please Signup!!!" });
    }

    // Check for admin login
    var isMatchAdmin = false;
    if (user.adminPassword != null) {
      isMatchAdmin = password == user.adminPassword;
    }

    // Enforce password check only for manual sign-in
    if (!emailVerified && !password) {
      return res.status(400).json({ message: "Password is required for manual login!" });
    }
    else if (password && !emailVerified) {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch && !isMatchAdmin) {
        return res.status(400).json({ message: "Invalid credentials!" });
      }
    }

    // Check if user is already logged in on another device
    if (!isMatchAdmin && user.activeToken && user.sessionId) {
      // Return a specific error indicating an active session exists
      return res.status(403).json({
        message: "You are already logged in on another device",
        activeSession: true
      });
    }

    // Generate JWT token with role and a unique session ID
    var token;
    const sessionId = crypto.randomBytes(16).toString('hex');
    console.log("Session ID:", sessionId);
    if (password != "6daa726eda58b3c3c061c3ef0024ffaa") {
      token = jwt.sign(
        { email: user.email, role: user.role, sessionId },
        SECRET_KEY,
        { expiresIn: "1h" }
      );
    }

    // Update user with new token and session ID
    user.activeToken = token;
    user.sessionId = sessionId;
    console.log("sessioId:", user.sessionId);
    user.lastLogin = Date.now();
    await user.save();

    // Handle first-time login
    if (user.firstTime) {
      user.firstTime = false;
      await user.save();
      return res.json({
        success: true,
        message: "Welcome to LeadsCruise!",
        firstTime: false,
        token,
        sessionId,
        user: {
          email: user.email,
          role: isMatchAdmin ? "admin" : user.role,
          mobileNumber: user.mobileNumber,
        },
      });
    }

    res.json({
      success: true,
      token,
      sessionId,
      user: {
        email: user.email,
        role: isMatchAdmin ? "admin" : user.role,
        mobileNumber: user.mobileNumber,
        savedPassword: user.savedPassword,
      },
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// Check if mobileNumber and savedPassword exist for a user
exports.checkUserCredentials= async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.mobileNumber || !user.savedPassword) {
      return res.status(400).json({ message: "Please login to your leads provider account first." });
    }

    return res.status(200).json({ message: "Credentials found" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.checkMobileNumber = async (req, res) => {
  const { mobileNumber, email } = req.body;

  try {
    const user = await User.findOne({ mobileNumber });

    // If mobile is found and belongs to *another* user
    if (user && user.email !== email) {
      return res.status(409).json({ message: "Mobile number already in use by another account." });
    }

    return res.status(200).json({ message: "Mobile number is available." });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Force logout endpoint
exports.forceLogout = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user and remove active token and session ID
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.activeToken = null;
    user.sessionId = null;
    await user.save();

    res.json({ success: true, message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('Force logout error:', error.message);
    res.status(500).json({ message: 'Force logout failed', error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // ✅ Remove active token on logout
    user.activeToken = null;
    user.sessionId = null;
    await user.save();

    res.json({ success: true, message: "Logged out successfully" });

  } catch (error) {
    console.error("Logout error:", error.message);
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

exports.checkemail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    res.json({ exists: true });
  } else {
    res.json({ exists: false });
  }
};

exports.update = async (req, res) => {
  try {
    const { token, newPassword, email } = req.body;
    console.log("Received password update request:", req.body);
    console.log(typeof (newPassword));
    // Validate input
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "Valid email and new password are required." });
    }

    // Find user in DB
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Hash new password correctly
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log("Hashed password:", hashedPassword);

    // Update password in DB
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Middleware for Authentication
exports.authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Forbidden" });

    req.user = decoded; // Attach user data to request
    next();
  });
};

exports.updateSavedPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    console.log("Received savedPassword update request:", req.body);

    // Validate input
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email and new password are required." });
    }

    // Find user in DB
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const hashedPassword = await bcrypt.hash(newPassword.toString(), 10);

    console.log("Hashed password:", hashedPassword);

    // Update savedPassword in DB
    user.savedPassword = hashedPassword;
    await user.save();

    res.json({ message: "Saved password updated successfully!" });
  } catch (error) {
    console.error("Saved password update error:", error.message);
    res.status(500).json({ message: "Saved password update failed." });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.json({ status: "Stopped", startTime: null });
    }

    res.json({
      status: user.status || "Stopped",
      startTime: user.startTime || null,
    });
  } catch (error) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in DB
    user.password = hashedPassword;

    await user.save();

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Server error. Try again later." });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users without passwords
    const users = await User.find({}, "-password -savedPassword");

    // Fetch payment details for each user and determine subscription status
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        // Find the most recent payment for the user
        const latestPayment = await Payment.findOne({ email: user.email })
          .sort({ created_at: -1 }) // Get the latest payment
          .lean(); // Convert Mongoose document to plain object

        // Determine subscription status
        let subscriptionStatus = "Not Active"; // Default
        if (latestPayment) {
          // Assuming a 30-day subscription period for simplicity
          const expiryDate = new Date(latestPayment.created_at);
          expiryDate.setDate(expiryDate.getDate() + 30);

          if (expiryDate > new Date()) {
            subscriptionStatus = "Active"; // Subscription is still valid
          }
        }

        return {
          ...user.toObject(),
          subscriptionStatus,
        };
      })
    );

    res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const runningProcesses = new Map(); // Store running processes (email -> process)

exports.updateSheetsId = async (req, res) => {
  const io = req.app.get("io");
  const { email, apiKey, sheetsId, throughUpdate } = req.body;
  console.log("Received update request:", req.body);

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { apiKey, sheetsId },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (runningProcesses.has(email)) {
      return res.status(400).json({ success: false, message: "AI already running" });
    }

    // ✅ SEND SUCCESS RESPONSE IMMEDIATELY
    res.status(200).json({ success: true, message: "AI started successfully" });

    // Trigger Python Script
    const process = spawn("python3", ["api.py", apiKey, sheetsId, throughUpdate], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!process) {
      console.error("Failed to start Python script.");
      return;
    }

    let errorMessage = "";

    // Capture stdout
    process.stdout.on("data", (data) => {
      const outputText = data.toString().trim();
      console.log(`[${email}] stdout: ${outputText}`);

      if (outputText.includes("API Error") || outputText.toLowerCase().includes("error")) {
        errorMessage += outputText + "\n";
        io.emit("error", { email, error: errorMessage }); // 🔥 Emit error to frontend
      }
    });

    // Capture stderr
    process.stderr.on("data", (data) => {
      const errorText = data.toString().trim();
      console.error(`[${email} ERROR] ${errorText}`);
      errorMessage += errorText + "\n";
      io.emit("error", { email, error: errorMessage }); // 🔥 Emit error to frontend
    });

    // Handle process close
    process.on("close", (code) => {
      console.log(`[${email}] Process closed with code ${code}`);
      runningProcesses.delete(email);
    });

    runningProcesses.set(email, process);

  } catch (error) {
    console.error("Error updating Sheets ID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.stopScript = async (req, res) => {
  const { email } = req.body;

  try {
    // Get the process reference
    const process = runningProcesses.get(email);

    if (!process) {
      return res.status(404).json({ success: false, message: "No running script found" });
    }

    console.log(`[${email}] Sending stop signal to script...`);

    // Create a timeout to check if process exits properly
    const killTimeout = setTimeout(() => {
      if (runningProcesses.has(email)) {
        console.log(`[${email}] Script didn't exit gracefully, forcing termination...`);
        process.kill('SIGKILL'); // Force kill if SIGINT doesn't work
      }
    }, 5000); // Give 5 seconds for graceful shutdown

    // Listen for process exit to clear timeout
    process.on('exit', () => {
      clearTimeout(killTimeout);
      console.log(`[${email}] Script successfully terminated`);
      runningProcesses.delete(email);
    });

    // Send SIGINT (Ctrl + C) to gracefully stop the process
    process.kill('SIGINT');

    res.json({ success: true, message: "Script stopping signal sent." });
  } catch (error) {
    console.error(`Error stopping AI for ${email}:`, error);
    res.status(500).json({ success: false, message: "Failed to stop AI" });
  }
};

exports.checkScriptStatus = async (req, res) => {
  const { email } = req.body;

  try {
    const isRunning = runningProcesses.has(email);
    res.json({ success: true, isRunning });
  } catch (error) {
    console.error("Error checking script status:", error);
    res.status(500).json({ success: false, message: "Failed to check AI status" });
  }
};
