const Payment = require("../models/Payment");
const User = require("../models/userModel");
// Fetch the latest unique_id from the database and increment it
exports.latestId = async (req, res) => {
  try {
    const latestPayment = await Payment.findOne().sort({ unique_id: -1 });

    res.json({
      latestId: latestPayment ? latestPayment.unique_id + 1 : 153531,
    });
  } catch (error) {
    console.error("Error fetching latest payment ID:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Fetch payment records based on the user's email
exports.getPaymentsByEmail = async (req, res) => {
  console.log("Received email:", req.query.email);
  try {
    const { email } = req.query; // Get email from query params
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // First, find the user by email to get their phone number
    const User = require('../models/userModel');
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const phoneNumber = user.mobileNumber || user.phoneNumber;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: "User phone number not found" });
    }

    // Find payments using the contact/phone number
    const payments = await Payment.find({ contact: phoneNumber }).sort({ unique_id: -1 });
    console.log(payments);
    if (payments.length === 0) {
      return res.status(200).json({ message: "No payment records found" });
    }

    res.status(200).json(payments); // Send the retrieved payments
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllSubscriptions = async (req, res) => {
  try {
    // Fetch all payments
    const subscriptions = await Payment.find().sort({ createdAt: -1 });

    // Fetch user details and attach refId
    const subscriptionsWithRefId = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await User.findOne({ email: sub.email }, "refId"); // Get only refId

        return {
          ...sub.toObject(),
          refId: user && user.refId ? user.refId : "N/A", // Ensure "N/A" if refId is missing
          invoiceBase64: sub.invoice_pdf?.data
            ? `data:${sub.invoice_pdf.contentType};base64,${sub.invoice_pdf.data.toString("base64")}`
            : null,
        };
      })
    );

    res.status(200).json(subscriptionsWithRefId);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const isWithinDays = (date, days) => {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - days);
  return new Date(date) >= pastDate;
};

// Subscription Metrics API
const SUBSCRIPTION_DURATIONS = {
  "one-mo": 30,
  "three-mo": 60,
  "six-mo": 180,
  "year-mo": 365,
};

// Function to check if a subscription has expired
const isExpired = (sub) => {
  const expiryDate = new Date(sub.created_at);
  const duration = SUBSCRIPTION_DURATIONS[sub.subscription_type] || 30; // Default to 30 days
  expiryDate.setDate(expiryDate.getDate() + duration);
  return expiryDate < new Date(); // Expired if past today
};

// Subscription Metrics API
exports.getSubscriptionMetrics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const allPayments = await Payment.find();
    const allUsers = await User.find(); // Fetch all users

    const subscriptionsToday = allPayments.filter((sub) => {
      return new Date(sub.created_at).toDateString() === today.toDateString();
    });

    // Get Monday of the current week
    const startOfWeek = new Date();
    const day = startOfWeek.getDay(); // Sunday - Saturday : 0 - 6
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get Sunday of the current week
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const subscriptionsThisWeek = allPayments.filter((sub) => {
      const createdAt = new Date(sub.created_at);
      return createdAt >= startOfWeek && createdAt <= endOfWeek;
    });

    // Pending Billing: Users whose subscriptions have expired
    const pendingBilling = allPayments.filter((sub) => isExpired(sub));

    const expiringWithinThreeDays = allPayments.filter((sub) => {
      const expiryDate = new Date(sub.created_at);
      const duration = SUBSCRIPTION_DURATIONS[sub.subscription_type] || 30;
      expiryDate.setDate(expiryDate.getDate() + duration);
      return expiryDate <= threeDaysLater && expiryDate > today;
    });

    const expiredSubscriptions = allPayments.filter((sub) => {
      const expiryDate = new Date(sub.created_at);
      const duration = SUBSCRIPTION_DURATIONS[sub.subscription_type] || 30;
      expiryDate.setDate(expiryDate.getDate() + duration);
      return expiryDate < today; // Subscription expired before today
    });

    // Total Active Users = Users with valid subscriptions
    const activeUsers = allPayments.filter((sub) => !isExpired(sub));
    const totalActiveUsers = new Set(activeUsers.map((sub) => sub.email)).size;

    const totalUsers = allUsers.length; // Total users from User collection

    res.json({
      subscriptionsToday: subscriptionsToday.length,
      subscriptionsThisWeek: subscriptionsThisWeek.length,
      pendingBilling: pendingBilling.length,
      expiringWithinThreeDays: expiringWithinThreeDays.length,
      expiredSubscriptions: expiredSubscriptions.length,
      totalActiveUsers,
      totalUsers,
    });
  } catch (error) {
    console.error("Error fetching subscription metrics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};