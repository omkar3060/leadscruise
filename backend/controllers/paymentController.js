const Payment = require("../models/Payment");

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

    const payments = await Payment.find({ email }); // Query the database

    if (payments.length === 0) {
      return res.status(404).json({ message: "No payment records found" });
    }

    res.status(200).json(payments); // Send the retrieved payments
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
