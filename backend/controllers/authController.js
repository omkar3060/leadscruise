const User = require("../models/userModel");
const bcrypt = require("bcrypt");
exports.signup = async (req, res) => {
  try {
    const { refId, email, password, confPassword } = req.body;

    // Validate input
    if (!email || !password || !confPassword) {
      return res.status(400).json({ message: "All fields are required." });
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

    console.log("Hashed password:", hashedPassword);

    // Create a new user
    const newUser = new User({
      email,
      password: hashedPassword,
      refId,
      firstTime: true,
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
    if (!user)
      return res
        .status(400)
        .json({ message: "User not found. Please Signup!!!" });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials!" });

    // Check if it's the first-time login
    if (user.firstTime) {
      user.firstTime = false;
      await user.save();
      return res.json({
        success: true,
        message: "Welcome, first-time login!",
        firstTime: false,
        user: { email: user.email, mobileNumber: user.mobileNumber },
      });
    }

    // Send user data including mobileNumber
    res.json({
      success: true,
      message: "Login successful!",
      user: { email: user.email, mobileNumber: user.mobileNumber,savedPassword:user.savedPassword },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
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
    const { token, newPassword ,email} = req.body;
    console.log("Received password update request:", req.body);
    console.log(typeof(newPassword));
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
