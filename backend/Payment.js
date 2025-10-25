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
  days_remaining: { type: Number, default: null },
  
  // ✅ Existing autopay fields
  razorpay_subscription_id: { type: String, default: null },
  autopay_enabled: { type: Boolean, default: false },
  autopay_start_date: { type: Date, default: null },
  
  // ✅ NEW FIELDS - Add these for demo subscription functionality
  razorpay_customer_id: { type: String, default: null },
  trial_end_date: { type: Date, default: null },
  payment_method_collected: { type: Boolean, default: false },
  
  // ✅ Optional but recommended fields for better tracking
  is_demo: { type: Boolean, default: false },
  trial_converted: { type: Boolean, default: false },
  trial_converted_at: { type: Date, default: null },
  parent_payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  is_trial_conversion: { type: Boolean, default: false },
  cancelled_at: { type: Date, default: null },
  completed_at: { type: Date, default: null },
});

module.exports = mongoose.model("Payment", paymentSchema);