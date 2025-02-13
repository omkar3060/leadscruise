const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  unique_id: { type: Number, required: true, unique: true },
  email: { type: String, required: true },
  contact: { type: String, required: true },
  order_id: { type: String, required: true, unique: true },
  payment_id: { type: String, required: true, unique: true },
  signature: { type: String, required: true },
  order_amount: { type: Number, required: true },
  subscription_type: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  invoice_pdf: { data: Buffer, contentType: String }, // Store PDF as binary data
});

module.exports = mongoose.model("Payment", paymentSchema);
