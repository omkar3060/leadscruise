const mongoose = require("mongoose");

const BillingDetailsSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  billingEmail: {type: String, required: true}, // Unique user identifier
  phone: { type: String, required: true },
  gst: { type: String, required: true },
  pan: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("BillingDetails", BillingDetailsSchema);
