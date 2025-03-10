const BillingDetails = require("../models/billingDetails");

// 🔹 Update or Insert Billing Details
exports.updateBillingDetails = async (req, res) => {
  const { email, phone, gst, pan, name, address, billingEmail } = req.body;
  console.log("body",req.body);
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required!" });
  }

  try {
    const updatedBilling = await BillingDetails.findOneAndUpdate(
      { email }, // Find by email
      { phone, gst, pan, name, address, billingEmail }, // Update fields
      { new: true, upsert: true } // Create if not exists
    );
    console.log("updatedBilling",updatedBilling);
    res.status(200).json({ success: true, message: "Billing details updated successfully!", data: updatedBilling });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating billing details", error });
  }
};

// 🔹 Get Billing Details by Email
exports.getBillingDetails = async (req, res) => {
  const { email } = req.params;

  try {
    const billingDetails = await BillingDetails.findOne({ email });

    if (!billingDetails) {
      return res.status(404).json({ success: false, message: "No billing details found" });
    }

    res.status(200).json({ success: true, data: billingDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching billing details", error });
  }
};
