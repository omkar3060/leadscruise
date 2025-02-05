const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  unique_id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true,unique: true },
  contact: { type: String, required: true },
  order_id: { type: String, required: true, unique: true },
  payment_id: { type: String, required: true, unique: true },
  signature: { type: String, required: true },
  order_amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);