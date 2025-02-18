const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Debugging: Log received data
    console.log("Received signup request:", req.body);

    // Validate input fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already signed up. Please log in!!!" });
    }

    // Debugging: Log password before hashing
    console.log("Raw password:", password);

    // Hash the password (Ensure password is a string)
    const hashedPassword = await bcrypt.hash(password.toString(), 10);

    console.log("Hashed password:", hashedPassword);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstTime: true
    });

    await newUser.save();

    res.json({ message: "Sign-up successful!" });
  } catch (error) {
    console.error("Sign-up error:", error.message);
    res.status(500).json({ message: "Sign-up failed", error: error.message });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found. Please Signup!!!" });

    // Compare passwords
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials." });

    // Check if it's the first-time login
    if (user.firstTime) {
      user.firstTime = false;
      await user.save();
      return res.json({
        success: true,
        message: "Welcome, first-time login!",
        firstTime: false,
        user: { email: user.email, mobileNumber: user.mobileNumber, savedPassword: user.savedPassword }
      });
    }

    // Send user data including mobileNumber and savedPassword
    res.json({
      success: true,
      message: "Login successful!",
      user: { email: user.email, mobileNumber: user.mobileNumber, savedPassword: user.savedPassword }
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    console.log("Received password update request:", req.body);
    // Validate input
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required." });
    }

    // Find user in DB
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Password update error:", error.message);
    res.status(500).json({ message: "Password update failed." });
  }
};

exports.updateSavedPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    console.log("Received savedPassword update request:", req.body);

    // Validate input
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required." });
    }

    // Find user in DB
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Update savedPassword in DB
    user.savedPassword = newPassword;
    await user.save();

    res.json({ message: "Saved password updated successfully!" });
  } catch (error) {
    console.error("Saved password update error:", error.message);
    res.status(500).json({ message: "Saved password update failed." });
  }
};