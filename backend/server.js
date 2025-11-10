const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const { spawn } = require("child_process");
const app = express();
const bcrypt = require("bcrypt");
const settingsRoutes = require("./routes/settingsRoutes");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const fs = require("fs");
const readline = require('readline');
const Payment = require("./models/Payment");
const IndiaMartAnalytics = require("./models/IndiaMARTAnalytics");
const Referral = require("./models/Referral");
const Support = require("./models/Support");
const Settings = require('./models/Settings');
const BillingDetails = require('./models/billingDetails');
const WhatsappSettings = require('./models/WhatsAppSettings');
const WhatsAppMessageQueue = require('./models/WhatsAppMessageQueue');
const paymentRoutes = require("./routes/paymentRoutes");
const emailRoutes = require("./routes/emailRoutes");
const billingDetailsRoutes = require("./routes/billingDetailsRoutes");
const axios = require('axios');
const { createServer } = require("http");
const { Server } = require("socket.io");
const referralRoutes = require("./routes/referralRoutes");
const statusRoutes = require("./routes/snapshRoutes");
const supportRoutes = require("./routes/support");
const whatsappSettingsRoutes = require("./routes/whatsappSettingsRoutes");
const analyticsRouter = require("./routes/analytics.js");
const teammateRoutes = require('./routes/teammates');
const path = require("path");
const os = require("os");
const server = createServer(app); // ✅ Create HTTP server
server.setTimeout(15 * 60 * 1000);
const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: "https://app.leadscruise.com",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);

app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["https://app.leadscruise.com", "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);
const User = require("./models/userModel");
console.log("Attempting to connect to MongoDB with URI:", process.env.MONGODB_URI);
// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

//RazorPay handlers

app.post("/order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });
    console.log("Order request options:", req.body);
    const options = req.body;
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }
    console.log("Generated order:", order);
    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.post("/order/validate", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      return res.json({
        success: true,
        msg: "success",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Invalid signature" });
    }
  } catch (error) {
    console.error("Error validating payment:", error);
    return res.status(500).json({ success: false, error: "Validation failed" });
  }
});

// Route to save payment details to MongoDB
app.post("/api/save-payment", async (req, res) => {
  try {
    const {
      unique_id,
      email,
      contact,
      order_id,
      payment_id,
      signature,
      order_amount,
      subscription_type,
    } = req.body;

    // Fetch the latest subscription for this email (assuming the latest one is the most relevant)
    const latestPayment = await Payment.findOne({ email })
      .sort({ created_at: -1 })
      .exec();

    let created_at = Date.now();

    if (latestPayment) {
      // Check if the last subscription is still active
      const subscriptionDuration = getSubscriptionDuration(
        latestPayment.subscription_type
      ); // Helper function for duration in days
      const subscriptionEndDate = new Date(latestPayment.created_at);
      subscriptionEndDate.setDate(
        subscriptionEndDate.getDate() + subscriptionDuration
      );

      const today = new Date();

      if (subscriptionEndDate > today) {
        // Last subscription is still active, start the new one after the current ends
        created_at = subscriptionEndDate.getTime() + 1; // Start the next day after expiry
      }
    }

    const payment = new Payment({
      unique_id,
      email,
      contact,
      order_id,
      payment_id,
      signature,
      order_amount,
      subscription_type,
      created_at,
    });

    await payment.save();

    await User.findOneAndUpdate(
      { email },                          // find user by email
      { $set: { mobileNumber: contact } }, // update mobileNumber
      { new: true, upsert: false }        // don't create a new user if not exists
    );

    res.json({ success: true, message: "Payment details saved successfully" });
  } catch (error) {
    console.error("Error saving payment details:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});
// Track first invoice download
app.post("/api/track-invoice-download", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Only set if it's the first time
    if (!user.firstInvoiceDownloadTime) {
      user.firstInvoiceDownloadTime = new Date();
      await user.save();

      console.log(`First invoice download tracked for ${email} at ${user.firstInvoiceDownloadTime}`);

      return res.json({
        success: true,
        message: "First download tracked",
        firstDownloadTime: user.firstInvoiceDownloadTime
      });
    }

    return res.json({
      success: true,
      message: "Download already tracked",
      firstDownloadTime: user.firstInvoiceDownloadTime
    });

  } catch (error) {
    console.error("Error tracking invoice download:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// Get first download time for a user
app.get("/api/get-first-download-time/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      firstDownloadTime: user.firstInvoiceDownloadTime,
      hasDownloaded: !!user.firstInvoiceDownloadTime
    });

  } catch (error) {
    console.error("Error fetching download time:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});
// Add this endpoint to your server.js file

app.get("/api/check-edit-eligibility/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // If no first download time, editing is allowed
    if (!user.firstInvoiceDownloadTime) {
      return res.json({
        success: true,
        canEdit: true,
        reason: "no_download_yet"
      });
    }

    // Calculate if 2 days (48 hours) have passed
    const firstDownloadTime = new Date(user.firstInvoiceDownloadTime);
    const now = new Date();
    const hoursPassed = (now - firstDownloadTime) / (1000 * 60 * 60);
    const twoDaysInHours = 48;

    const canEdit = hoursPassed < twoDaysInHours;
    const hoursRemaining = canEdit ? Math.ceil(twoDaysInHours - hoursPassed) : 0;

    res.json({
      success: true,
      canEdit,
      firstDownloadTime: user.firstInvoiceDownloadTime,
      hoursPassed: Math.floor(hoursPassed),
      hoursRemaining,
      reason: canEdit ? "within_48_hours" : "exceeded_48_hours"
    });

  } catch (error) {
    console.error("Error checking edit eligibility:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// Add endpoint for paid subscription (for users who already used demo)
app.post("/api/create-paid-subscription", async (req, res) => {
  try {
    const { email, contact, referralId, amount } = req.body;

    if (!email || !contact || !amount) {
      return res.status(400).json({
        success: false,
        error: "Email, contact, and amount are required"
      });
    }

    // Validate referral ID
    try {
      const refRes = await axios.get(
        `https://api.leadscruise.com/api/referrals/check-referral/${referralId.trim()}`
      );
      if (!refRes.data.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid Referral ID"
        });
      }
    } catch (err) {
      console.error("Error validating referral:", err);
      return res.status(400).json({
        success: false,
        error: "Unable to verify Referral ID"
      });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Create Razorpay subscription (immediate start)
    const subscription = await razorpay.subscriptions.create({
      plan_id: "plan_RXH4298xyYVdUt",
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      addons: [],
      notes: {
        referral_id: referralId,
        subscription_type: "monthly-subscription",
        customer_email: email,
        customer_contact: contact
      },
      notify_info: {
        notify_phone: contact,
        notify_email: email
      }
    });

    console.log("Created paid Razorpay subscription:", subscription.id);

    res.json({
      success: true,
      message: "Subscription created successfully",
      subscription: subscription
    });

  } catch (error) {
    console.error("Error creating paid subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription",
      details: error.message
    });
  }
});

// 1. Create ₹1 authorization order
app.post("/api/create-demo-order", async (req, res) => {
  try {
    const { email, contact, referralId } = req.body;
    console.log("Create demo order request:", req.body);
    // ✅ Validation checks - ADD THESE
    if (!email || !contact) {
      return res.status(400).json({
        success: false,
        error: "Email and contact are required"
      });
    }

    if (!referralId) {
      return res.status(400).json({
        success: false,
        error: "Referral ID is required"
      });
    }

    // ✅ Validate referral ID
    try {
      const refRes = await axios.get(
        `https://api.leadscruise.com/api/referrals/check-referral/${referralId.trim()}`
      );
      if (!refRes.data.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid Referral ID"
        });
      }
    } catch (err) {
      console.error("Error validating referral:", err);
      return res.status(400).json({
        success: false,
        error: "Unable to verify Referral ID"
      });
    }

    // ✅ Check if user already used demo
    const existingDemo = await Payment.findOne({
      contact,
      subscription_type: "7-days",
    });

    if (existingDemo) {
      return res.status(400).json({
        success: false,
        error: "You have already used the 7-day demo subscription"
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // ✅ Create ₹1 order for payment method authorization
    const order = await razorpay.orders.create({
      amount: 100, // ₹1 in paisa (will be refunded)
      currency: "INR",
      receipt: `DEMO-AUTH-${Date.now()}`,
      notes: {
        email: email,
        contact: contact,
        referral_id: referralId,
        type: "demo_authorization"
      }
    });

    console.log("✅ Demo authorization order created:", order.id);

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      email: email,
      contact: contact,
      referralId: referralId
    });

  } catch (error) {
    console.error("Error creating demo order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create authorization order",
      details: error.message
    });
  }
});

// 2. After successful ₹1 payment, create subscription
app.post("/api/activate-demo-after-auth", async (req, res) => {
  try {
    const { email, contact, referralId, payment_id, order_id } = req.body;

    if (!email || !contact || !payment_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Get payment details
    const payment = await razorpay.payments.fetch(payment_id);

    console.log("Payment fetched:", payment_id, "Status:", payment.status);

    if (payment.status !== 'captured') {
      return res.status(400).json({
        success: false,
        error: "Payment not captured"
      });
    }

    // Create customer with saved payment method
    const customer = await razorpay.customers.create({
      name: email.split('@')[0],
      email: email,
      contact: contact,
    });

    console.log("Customer created:", customer.id);

    // Create token from the payment
    const token = await razorpay.customers.addToken(customer.id, {
      method: payment.method,
      card: payment.card ? { id: payment.card.id } : undefined,
      vpa: payment.vpa || undefined,
    });

    console.log("Token added for customer:", customer.id);

    const currentTime = Math.floor(Date.now() / 1000);
    const trialEndTime = currentTime + (7 * 24 * 60 * 60);

    // Create subscription with saved token
    const subscription = await razorpay.subscriptions.create({
      plan_id: "plan_RXH4298xyYVdUt",
      customer_id: customer.id,
      quantity: 1,
      total_count: 12,
      start_at: trialEndTime,
      customer_notify: 1,
      addons: [],
      notes: {
        referral_id: referralId,
        demo_user: "true",
        subscription_type: "7-day-trial"
      }
    });

    console.log("✅ Subscription created:", subscription.id);

    // Refund the ₹1 authorization amount
    try {
      await razorpay.payments.refund(payment_id, {
        amount: 100,
        notes: {
          reason: "Demo authorization refund"
        }
      });
      console.log("✅ ₹1 refunded for payment:", payment_id);
    } catch (refundError) {
      console.error("⚠ Refund failed (non-critical):", refundError);
      // Continue even if refund fails - user can contact support
    }

    // Save payment record
    const getNextPaymentIdResponse = await axios.get(
      "https://api.leadscruise.com/api/get-latest-id"
    );
    const uniqueId = getNextPaymentIdResponse.data.latestId;

    const demoPayment = new Payment({
      unique_id: uniqueId,
      email,
      contact,
      order_id: order_id || `DEMO-${Date.now()}`,
      payment_id: payment_id,
      signature: "DEMO-TRIAL",
      order_amount: 0,
      subscription_type: "7-days",
      razorpay_subscription_id: subscription.id,
      razorpay_customer_id: customer.id,
      autopay_enabled: true,
      trial_end_date: new Date(trialEndTime * 1000).toISOString(),
      created_at: Date.now(),
      payment_method_collected: true,
    });

    await demoPayment.save();

    await User.findOneAndUpdate(
      { email },
      { $set: { mobileNumber: contact } },
      { new: true, upsert: false }
    );

    console.log(`✅ Demo activated successfully for ${email}`);

    res.json({
      success: true,
      message: "Demo activated with autopay",
      subscription_id: subscription.id,
      trial_end_date: new Date(trialEndTime * 1000).toISOString(),
    });

  } catch (error) {
    console.error("Error activating demo:", error);
    res.status(500).json({
      success: false,
      error: "Failed to activate demo",
      details: error.message
    });
  }
});

// Add this endpoint to your server.js file
app.post("/api/cancel-subscription", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Prevent demo account from cancelling
    if (email === "demo@leadscruise.com") {
      return res.status(403).json({ error: 'Demo account cannot cancel subscription' });
    }

    // Get user's latest payment with active autopay (MongoDB/Mongoose syntax)
    const latestPayment = await Payment.findOne({
      email: email,
      autopay_enabled: true
    }).sort({ created_at: -1 });

    if (!latestPayment) {
      return res.status(404).json({ error: 'No active autopay subscription found' });
    }

    const subscriptionId = latestPayment.razorpay_subscription_id;

    // Cancel subscription on Razorpay if subscription ID exists
    if (subscriptionId) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_SECRET,
        });

        await razorpay.subscriptions.cancel(subscriptionId);
        console.log(`✅ Razorpay subscription ${subscriptionId} cancelled successfully for ${email}`);
      } catch (razorpayError) {
        console.error('⚠ Error cancelling Razorpay subscription:', razorpayError);
        // Continue with database update even if Razorpay cancellation fails
      }
    }

    // Update database - disable autopay (MongoDB/Mongoose syntax)
    const updateResult = await Payment.updateMany(
      { razorpay_subscription_id: subscriptionId },
      { $set: { autopay_enabled: false } }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} payment records for ${email}`);

    // Calculate expiry date based on subscription type
    const subscriptionDays = getSubscriptionDuration(latestPayment.subscription_type);
    const expirationDate = new Date(latestPayment.created_at);
    expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

    // Format the expiry date
    const formattedExpiryDate = expirationDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      expiryDate: formattedExpiryDate,
      subscriptionId: subscriptionId
    });

  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

// ✅ CORRECT: Demo payment uses "7-days", autopay uses "one-mo"

app.post("/api/create-demo-subscription", async (req, res) => {
  try {
    const { email, contact, referralId } = req.body;

    if (!email || !contact) {
      return res.status(400).json({
        success: false,
        error: "Email and contact are required"
      });
    }

    // Validate referral ID
    try {
      const refRes = await axios.get(
        `https://api.leadscruise.com/api/referrals/check-referral/${referralId.trim()}`
      );
      if (!refRes.data.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid Referral ID"
        });
      }
    } catch (err) {
      console.error("Error validating referral:", err);
      return res.status(400).json({
        success: false,
        error: "Unable to verify Referral ID"
      });
    }

    // Check if user already used demo
    const existingDemo = await Payment.findOne({
      contact,
      subscription_type: "7-days", // ✅ Consistent with getSubscriptionDuration
    });

    if (existingDemo) {
      return res.status(400).json({
        success: false,
        error: "You have already used the 7-day demo subscription"
      });
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Create or get customer
    let customer;
    try {
      const customers = await razorpay.customers.all({
        email: email,
      });

      if (customers.items && customers.items.length > 0) {
        customer = customers.items[0];
        console.log("Found existing customer:", customer.id);
      } else {
        customer = await razorpay.customers.create({
          name: email.split('@')[0],
          email: email,
          contact: contact,
          notes: {
            referral_id: referralId,
          }
        });
        console.log("Created new customer:", customer.id);
      }
    } catch (customerError) {
      console.error("Customer creation error:", customerError);
      return res.status(500).json({
        success: false,
        error: "Failed to create customer account"
      });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const trialEndTime = currentTime + (7 * 24 * 60 * 60); // 7 days from now

    // Create subscription with 7-day trial
    const subscription = await razorpay.subscriptions.create({
      plan_id: "plan_RXH4298xyYVdUt", // Your monthly plan
      customer_id: customer.id,
      quantity: 1,
      total_count: 12, // 12 monthly cycles
      customer_notify: 1,
      addons: [],
      notes: {
        referral_id: referralId,
        subscription_type: "7-day-trial", // ✅ Just metadata, not used in duration calculation
        customer_email: email,
        customer_contact: contact,
        trial_days: "7"
      },
      notify_info: {
        notify_phone: contact,
        notify_email: email
      },
      start_at: trialEndTime, // First charge after 7 days
    });

    console.log("✅ Created subscription:", subscription.id);

    // Get next payment ID
    const getNextPaymentIdResponse = await axios.get(
      "https://api.leadscruise.com/api/get-latest-id"
    );
    const uniqueId = getNextPaymentIdResponse.data.latestId;

    // ✅ IMPORTANT: Save demo payment with "7-days" type
    const timestamp = Date.now();
    const payment = new Payment({
      unique_id: uniqueId,
      email,
      contact,
      order_id: `DEMO-${timestamp}`,
      payment_id: `DEMO-${timestamp}`,
      signature: "DEMO-TRIAL",
      order_amount: 0,
      subscription_type: "7-days", // ✅ This matches getSubscriptionDuration()
      razorpay_subscription_id: subscription.id,
      razorpay_customer_id: customer.id,
      autopay_enabled: true,
      autopay_start_date: new Date(trialEndTime * 1000).toISOString(),
      trial_end_date: new Date(trialEndTime * 1000).toISOString(),
      created_at: Date.now(),
    });

    await payment.save();

    // Update user
    await User.findOneAndUpdate(
      { email },
      { $set: { mobileNumber: contact } },
      { new: true, upsert: false }
    );

    console.log(`✅ Demo subscription created for ${email}`);

    res.json({
      success: true,
      message: `7-day FREE demo activated! You will be automatically charged ₹3999+GST/month starting from ${new Date(trialEndTime * 1000).toLocaleDateString('en-IN')}`,
      subscription_id: subscription.id,
      customer_id: customer.id,
      trial_end_date: new Date(trialEndTime * 1000).toISOString(),
    });

  } catch (error) {
    console.error("Error creating demo subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create demo subscription",
      details: error.message
    });
  }
});

// ✅ Webhook creates "one-mo" payment for autopay charges
app.post("/api/razorpay-webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📨 Webhook: ${event}`);

    if (event === 'subscription.charged') {
      const subscriptionEntity = payload.subscription.entity;
      const paymentEntity = payload.payment.entity;

      const subscriptionId = subscriptionEntity.id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount;
      const status = paymentEntity.status;

      if (status !== 'captured') {
        return res.json({ status: "acknowledged" });
      }

      const demoPayment = await Payment.findOne({
        razorpay_subscription_id: subscriptionId
      });

      if (demoPayment) {
        const getNextPaymentIdResponse = await axios.get(
          "https://api.leadscruise.com/api/get-latest-id"
        );
        const uniqueId = getNextPaymentIdResponse.data.latestId;

        // ✅ Create monthly payment with "one-mo" type
        const newPayment = new Payment({
          unique_id: uniqueId,
          email: demoPayment.email,
          contact: demoPayment.contact,
          order_id: `AUTOPAY-${Date.now()}`,
          payment_id: paymentId,
          signature: "AUTOPAY",
          order_amount: amount,
          subscription_type: "one-mo", // ✅ This matches getSubscriptionDuration()
          razorpay_subscription_id: subscriptionId,
          razorpay_customer_id: demoPayment.razorpay_customer_id,
          autopay_enabled: true,
          created_at: Date.now(),
          parent_payment_id: demoPayment._id,
          is_trial_conversion: true,
        });

        await newPayment.save();
        console.log(`✅ Monthly autopay payment recorded for ${demoPayment.email}`);

        // Send invoice
        try {
          await axios.post("https://api.leadscruise.com/api/send-invoice-email", {
            email: demoPayment.email,
            unique_id: uniqueId
          });
        } catch (emailError) {
          console.error("❌ Email failed:", emailError);
        }

        // Mark demo as converted
        await Payment.updateOne(
          { _id: demoPayment._id },
          {
            $set: {
              trial_converted: true,
              trial_converted_at: new Date()
            }
          }
        );
      }
    }

    if (event === 'subscription.cancelled') {
      const subscriptionId = payload.subscription.entity.id;
      await Payment.updateMany(
        { razorpay_subscription_id: subscriptionId },
        { $set: { autopay_enabled: false, cancelled_at: new Date() } }
      );
    }

    if (event === 'subscription.completed') {
      const subscriptionId = payload.subscription.entity.id;
      await Payment.updateMany(
        { razorpay_subscription_id: subscriptionId },
        { $set: { autopay_enabled: false, completed_at: new Date() } }
      );
    }

    res.json({ status: "ok" });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

app.get("/api/has-used-demo", async (req, res) => {
  try {
    const { contact } = req.query;

    if (!contact) {
      return res.status(400).json({ error: "Missing contact number" });
    }

    const existingDemo = await Payment.findOne({
      contact,
      subscription_type: "7-days",
    });

    if (existingDemo) {
      return res.json({ used: true });
    } else {
      return res.json({ used: false });
    }
  } catch (error) {
    console.error("Error checking demo usage:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper function to get subscription duration in days based on type
function getSubscriptionDuration(subscription_type) {
  switch (subscription_type) {
    case "7-days":
      return 7;
    case "3-days":
      return 3;
    case "One Month":
      return 30;
    case "6 Months":
      return 180;
    case "year-mo":
      return 365;
    default:
      return 30; // Default fallback
  }
}

// Routes
app.use("/api", authRoutes);
app.use("/api", settingsRoutes);
app.use("/api", paymentRoutes);
app.use("/api/billing", billingDetailsRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api", emailRoutes);
app.use("/api", statusRoutes);
app.use("/api/whatsapp-settings", whatsappSettingsRoutes);
app.use("/api/analytics", analyticsRouter);
app.use("/api/support", supportRoutes);
app.use('/api/teammates', teammateRoutes);

// Add this after your other route definitions (after line ~200)

const nodemailer = require('nodemailer');

// Configure email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // Change to your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email sending route for invoice notifications
app.post('/api/send-invoice-email', async (req, res) => {
  try {
    const { email, unique_id } = req.body;

    if (!email || !unique_id) {
      return res.status(400).json({
        success: false,
        message: 'Email and Order ID are required'
      });
    }

    console.log(`Sending invoice email to ${email} for order ${unique_id}`);

    // Fetch payment details to get more info
    const payment = await Payment.findOne({ unique_id });
    let subscriptionType = "Subscription";
    let orderAmount = "";

    if (payment) {
      subscriptionType = payment.subscription_type || "Subscription";
      orderAmount = payment.order_amount ? `₹${payment.order_amount / 100}` : "";
    }

    // Email content
    const mailOptions = {
      from: `"Leadscruise" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Invoice Ready - Order #${unique_id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 30px 25px;
            }
            .content h2 {
              color: #667eea;
              font-size: 22px;
              margin-bottom: 15px;
            }
            .content p {
              margin-bottom: 15px;
              font-size: 15px;
            }
            .order-details {
              background-color: #f8f9fa;
              padding: 20px;
              border-left: 4px solid #667eea;
              margin: 20px 0;
              border-radius: 5px;
            }
            .order-details h3 {
              margin-top: 0;
              color: #667eea;
              font-size: 16px;
            }
            .order-details p {
              margin: 8px 0;
              font-size: 14px;
            }
            .order-details strong {
              color: #333;
            }
            .cta-button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .cta-button:hover {
              opacity: 0.9;
            }
            .steps {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .steps h3 {
              color: #667eea;
              margin-top: 0;
              font-size: 16px;
            }
            .steps ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .steps li {
              margin: 8px 0;
              font-size: 14px;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              border-top: 1px solid #e0e0e0;
            }
            .footer p {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            .footer .social-links {
              margin-top: 15px;
            }
            .footer .social-links a {
              color: #667eea;
              text-decoration: none;
              margin: 0 10px;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 Invoice Generated</h1>
            </div>
            <div class="content">
              <h2>Dear Customer,</h2>
              <p>Great news! Your invoice has been successfully generated and is now ready for download.</p>
              
              <div class="order-details">
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${unique_id}</p>
                ${subscriptionType ? `<p><strong>Subscription:</strong> ${subscriptionType}</p>` : ''}
                ${orderAmount ? `<p><strong>Amount:</strong> ${orderAmount}</p>` : ''}
                <p><strong>Status:</strong> <span style="color: #28a745;">✓ Invoice Ready</span></p>
              </div>
              
              <div class="steps">
                <h3>How to Access Your Invoice:</h3>
                <ul>
                  <li>Log in to your Leadscruise account</li>
                  <li>Navigate to your Dashboard</li>
                  <li>Click on "Subscriptions" or "Billing"</li>
                  <li>Find your order and download the invoice</li>
                </ul>
              </div>
              
              <center>
                <a href="https://app.leadscruise.com/login" class="cta-button">Access Your Account</a>
              </center>
              
              <p style="margin-top: 25px;">If you have any questions about your invoice or subscription, our support team is here to help.</p>
              
              <p style="margin-top: 20px;">Thank you for choosing Leadscruise!</p>
              
              <p style="margin-top: 15px; color: #666;">Best regards,<br>
              <strong style="color: #667eea;">The Leadscruise Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email notification. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} Leadscruise. All rights reserved.</p>
              <div class="social-links">
                <a href="https://app.leadscruise.com">Visit Website</a> | 
                <a href="mailto:support@leadscruise.com">Contact Support</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    const info = await emailTransporter.sendMail(mailOptions);

    console.log(`✅ Invoice email sent successfully to ${email}:`, info.messageId);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('❌ Error sending invoice email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

app.post("/api/check-number", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: "Mobile number is required." });
    }

    if (mobileNumber === "9579797269") {
      return res.json({ code: 0, message: "Number is not subscribed." });
    }

    // Step 1: DB check
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.json({
        exists: true,
        message: "Number is subscribed with us earlier.",
        user: {
          refId: existingUser.refId,
          username: existingUser.username,
          email: existingUser.email,
          status: existingUser.status,
          role: existingUser.role,
        },
      });
    }

    // Step 2: Run Python script
    const python = spawn("python3", ["indiamart_link_check.py", mobileNumber]);

    // Capture Python stdout (your print statements)
    python.stdout.on("data", (data) => {
      console.log(`Python stdout: ${data.toString()}`);
    });

    // Capture Python errors
    python.stderr.on("data", (data) => {
      console.error(`Python stderr: ${data.toString()}`);
    });

    // Handle exit
    python.on("exit", (code) => {
      console.log(`Python script exited with code ${code}`);

      // Cleanup Xvfb display after script execution
      cleanupDisplay("100000");

      if (code === 0) {
        return res.json({ exists: false, otp: "request_button", code: 0 });
      } else if (code === 1) {
        return res.json({ exists: false, otp: "fields_visible", code: 1 });
      } else {
        return res.json({ exists: false, otp: "unknown_state", code: 2 });
      }
    });
  } catch (error) {
    console.error("Error checking number:", error.message);
    res.status(500).json({
      message: "Error occurred while checking the number.",
      error: error.message,
    });
  }
});

const otpRequests = new Map();
const otpFailures = new Map();

const activePythonProcesses = new Map();
// Add this endpoint to your server.js file (around line 1400-1500)

app.get("/api/get-active-subscriptions", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find all payments for this user
    const allPayments = await Payment.find({ email })
      .sort({ created_at: -1 })
      .exec();

    if (!allPayments || allPayments.length === 0) {
      return res.json({
        success: true,
        hasActiveSubscription: false,
        canDownloadReports: false,
        activeSubscriptions: [],
        message: "No subscriptions found"
      });
    }

    const now = new Date();
    const activeSubscriptions = [];

    // Check each payment to see if it's still active
    for (const payment of allPayments) {
      const subscriptionDays = getSubscriptionDuration(payment.subscription_type);
      const expirationDate = new Date(payment.created_at);
      expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

      // If subscription is still active
      if (now < expirationDate) {
        activeSubscriptions.push({
          type: payment.subscription_type,
          startDate: payment.created_at,
          expirationDate: expirationDate.toISOString(),
          daysRemaining: Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // Determine if user can download reports
    // User can download reports if they have ANY active subscription that is NOT one-mo or three-mo
    const canDownloadReports = activeSubscriptions.some(sub => 
      sub.type !== 'one-mo' && 
      sub.type !== 'three-mo' && 
      sub.type !== '7-days'
    );

    res.json({
      success: true,
      hasActiveSubscription: activeSubscriptions.length > 0,
      canDownloadReports,
      activeSubscriptions,
      totalActiveSubscriptions: activeSubscriptions.length
    });

  } catch (error) {
    console.error("Error fetching active subscriptions:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});
app.post("/api/execute-task", async (req, res) => {
  // Set a higher timeout for this specific response
  res.setTimeout(900000); // 15 minutes

  const { mobileNumber, email, uniqueId, password } = req.body;

  if (!mobileNumber || !email || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Email and Mobile Number are required.",
    });
  }

  // Generate a random 6-digit password
  const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated password for IndiaMART:", newPassword);

  // Spawn a new Python process to execute the task
  const pythonProcess = spawn("python3", [
    "login_check.py",
    mobileNumber,
    newPassword,
    uniqueId,
    password,
  ], {
    timeout: 900000 // 15 minutes timeout
  });
  activePythonProcesses.set(uniqueId, pythonProcess);
  let result = "";
  let error = "";

  // Capture standard output (stdout) and log to console
  pythonProcess.stdout.on("data", (data) => {
    const output = data.toString();
    result += output;
    console.log("Python stdout:", output.trim());
    if (output.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for unique_id:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null,
        type: "login" // Default type
      });
    }

    if (output.includes("PASSWORD_OTP_REQUEST_INITIATED")) {
      console.log("Password change OTP request detected for unique_id:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null,
        type: "password_change" // Specific type for password change
      });
    }

    if (output.includes("OTP_FAILED_INCORRECT")) {
      console.log("Incorrect OTP detected for", uniqueId);
      otpFailures.set(uniqueId, true);
    }
  });

  // Capture standard error (stderr) and log to console
  pythonProcess.stderr.on("data", (data) => {
    const errorOutput = data.toString();
    error += errorOutput;
    console.error("Python stderr:", errorOutput.trim());
  });

  // Handle Python script execution completion
  pythonProcess.on("close", async (code) => {
    console.log(`Python process exited with code: ${code}`);
    activePythonProcesses.delete(uniqueId);
    cleanupDisplay(uniqueId);
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);

    // Clear any pending OTP state
    console.log(`Cleaned up OTP state for uniqueId: ${uniqueId}`);
    if (code === 0) {
      try {
        // Parse the result from Python script
        const resultText = result.trim();

        // Extract JSON between separators
        const startMarker = "===RESULT_START===";
        const endMarker = "===RESULT_END===";
        const startIndex = resultText.indexOf(startMarker);
        const endIndex = resultText.indexOf(endMarker);

        let extractedData;
        if (startIndex !== -1 && endIndex !== -1) {
          // Extract JSON between markers
          const jsonString = resultText.substring(startIndex + startMarker.length, endIndex).trim();
          try {
            extractedData = JSON.parse(jsonString);
            console.log("Successfully parsed JSON result:", extractedData);
          } catch (parseError) {
            console.error("Error parsing JSON between markers:", parseError);
            console.error("JSON string was:", jsonString);
            throw parseError;
          }
        } else {
          console.error("Could not find result markers in output");
          console.error("Full output:", resultText);
        }

        const { companyName, mobileNumbers, preferredCategories, messageTemplates, newPassword } = extractedData;
        console.log("Extracted Company Name:", companyName);
        console.log("Extracted Mobile Numbers:", mobileNumbers);
        console.log("Extracted Categories:", preferredCategories);
        console.log("Generated Message Templates:", messageTemplates);
        console.log("New Password:", newPassword);

        // Find the user
        let user = await User.findOne({ email });
        if (!user) {
          return res.status(404).json({
            status: "error",
            message: "User not found"
          });
        }

        // Update user record with mobile number
        user.mobileNumber = mobileNumber;

        if (mobileNumber && mobileNumber === "9579797269") {
          try {
            // Create Settings entry
            const settingsData = {
              userEmail: email,
              sentences: [
                "Thank You for the enquiry",
                "Please contact the sales team +91-9900333143, +91-9503213927 , +91-9284706164",
                "Once the enquiry is being closed kindly review us with ratings."
              ],
              wordArray: [
                "Spider Couplings",
                "Servo Couplings",
                "Gear Couplings",
                "Flexible Shaft Couplings",
                "Rigid Couplings",
                "Flexible Couplings",
                "Torque limiter",
                "PU Spider Coupling",
                "Disc Coupling",
                "Encoder Coupling",
                "Flange coupling",
                "Aluminum Flexible Coupling",
                "Full Gear Coupling",
                "Jaw Couplings",
                "Couplings",
                "Stainless Steel Couplings",
                "Flexible Coupling"
              ],
              h2WordArray: [
                "Hero Splendor Rubber Coupling",
                "Capsule Couple",
                "Ape Coupling Rubber",
                "18mm Sujata Mixer Rubber Coupler",
                "Quick Release Bolt",
                "Quick Release Couplings",
                "Aluminium Encoder Coupling, for Automation, Size: 1 Inch",
                "Piaggio Ape Rubber Joint Coupling, 30 piece"
              ],
              minOrder: 0,
              leadTypes: []
            };

            await Settings.create(settingsData);

            // Create BillingDetails entry
            const billingData = {
              email: email,
              billingEmail: email, // Using the same email as billing email initially
              phone: mobileNumber,
              gst: "27ARFPJ3439G1ZT",
              pan: "ARFPJ3439G",
              name: "FOCUS ENGINEERING PRODUCTS",
              address: "SR NO 677, BEHIND VISHWAVILAS HOTEL, LANDEWADI, BHOSARI-411039"
            };

            await BillingDetails.create(billingData);

            console.log("Settings and BillingDetails created for mobile number:", mobileNumber);
          } catch (error) {
            console.error("Error creating Settings/BillingDetails:", error.message);
            // Don't fail the signup if Settings/BillingDetails creation fails
          }
        }

        // Add company name and mobile numbers to user if available
        if (companyName) {
          user.companyName = companyName;
        }
        if (mobileNumbers && mobileNumbers.length > 0) {
          user.companyMobileNumbers = mobileNumbers;
        }

        // Save new password if it was successfully changed
        if (newPassword) {
          user.savedPassword = newPassword;
          console.log("New password saved to user record");
        }

        await user.save();
        console.log("User record updated successfully");

        // Update or create settings record with preferred categories and message templates
        if ((preferredCategories && preferredCategories.length > 0) || (messageTemplates && messageTemplates.length > 0)) {
          try {
            // Find existing settings or create new one
            let settings = await Settings.findOne({ userEmail: email });

            if (!settings) {
              // Create new settings record
              settings = new Settings({
                userEmail: email,
                wordArray: preferredCategories || [],
                sentences: messageTemplates || [],
                h2WordArray: [],
                minOrder: 0,
                leadTypes: [],
                initialWordArray: preferredCategories || [],
                initialSentences: messageTemplates || [],
              });
              console.log("Creating new settings record for user:", email);
            } else {
              // Update existing settings
              if (preferredCategories && preferredCategories.length > 0) {
                settings.wordArray = preferredCategories;
                console.log("Updated wordArray with preferred categories");
              }

              if (messageTemplates && messageTemplates.length > 0) {
                settings.sentences = messageTemplates;
                console.log("Updated sentences with message templates");
              }

              console.log("Updating existing settings record for user:", email);
            }

            await settings.save();
            console.log(`Successfully saved settings - Categories: ${preferredCategories ? preferredCategories.length : 0}, Templates: ${messageTemplates ? messageTemplates.length : 0}`);

          } catch (settingsError) {
            console.error("Error saving settings:", settingsError);
            // Don't fail the whole request if settings save fails
          }
        }
        // After successfully saving settings
        try {
          const leadNamePlaceholder = "{lead_name}";
          const productPlaceholder = "{lead_product_requested}";

          const whatsappMessage = `Hi ${leadNamePlaceholder},
Thank you for contacting ${companyName}. 
 
✅ You can post your requirements details for this number 
else 
✅ You can contact ${mobileNumbers && mobileNumbers.length > 0 ? mobileNumbers.join(" , ") : mobileNumber} or send a mail at {leadscruise_email} for more details on your enquiry of ${productPlaceholder}

We typically respond within some minutes!`;

          // Upsert whatsapp settings for the user's mobile number
          await WhatsappSettings.findOneAndUpdate(
            { mobileNumber }, // match by main mobileNumber
            {
              $set: {
                whatsappNumber: mobileNumber,
              },
              $addToSet: {
                messages: whatsappMessage // avoid duplicates
              }
            },
            { upsert: true, new: true }
          );

          console.log(`WhatsApp message saved for ${mobileNumber}`);
        } catch (whatsAppError) {
          console.error("Error saving whatsapp settings:", whatsAppError);
        }


        return res.json({
          status: "success",
          message: "Company profile and categories extracted successfully!",
        });

      } catch (dbError) {
        console.error("Database error:", dbError);
        return res.status(500).json({
          status: "error",
          message: "Database error"
        });
      }
    } else {
      return res.status(500).json({
        status: "error",
        message: `Python script failed with exit code ${code}. Error: ${error.trim()}`,
      });
    }
  });

  // Handle process errors
  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python process:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to start Python process",
    });
  });
});

const userLeadCounterSchema = new mongoose.Schema({
  user_mobile_number: { type: String, required: true, unique: true },
  leadCount: { type: Number, default: 0 },
  lastReset: { type: Date, default: Date.now },
  maxCaptures: { type: Number, default: 7 },
  lastUpdatedMaxCaptures: { type: Date, default: null }, // Track last update time
});

const UserLeadCounter = mongoose.model(
  "UserLeadCounter",
  userLeadCounterSchema
);
// Add this endpoint after your other user-related routes (around line 1400-1500)

app.get("/api/get-user-subscription", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find the latest payment for this user
    const latestPayment = await Payment.findOne({ email })
      .sort({ created_at: -1 })
      .exec();

    if (!latestPayment) {
      return res.status(404).json({
        success: false,
        message: "No subscription found for this user"
      });
    }

    // Check if subscription is still active
    const subscriptionDays = getSubscriptionDuration(latestPayment.subscription_type);
    const expirationDate = new Date(latestPayment.created_at);
    expirationDate.setDate(expirationDate.getDate() + subscriptionDays);
    
    const isActive = new Date() < expirationDate;

    res.json({
      success: true,
      subscriptionPlan: latestPayment.subscription_type,
      isActive,
      expirationDate: expirationDate.toISOString(),
      createdAt: latestPayment.created_at
    });

  } catch (error) {
    console.error("Error fetching user subscription:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});
app.post("/api/update-max-captures", async (req, res) => {
  try {
    console.log("Received Data:", req.body); // Debugging

    const { user_mobile_number, maxCaptures } = req.body;

    if (!user_mobile_number || maxCaptures < 0) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const user = await UserLeadCounter.findOne({ user_mobile_number });

    if (user) {
      // Ensure lastUpdated is a valid Date
      const lastUpdated = user.lastUpdatedMaxCaptures
        ? new Date(user.lastUpdatedMaxCaptures)
        : null;
      const now = new Date();

      // 🕒 Allow update only if 1 hour has passed since the last update
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

      if (lastUpdated && now - lastUpdated < ONE_HOUR) {
        const minutesLeft = Math.ceil((ONE_HOUR - (now - lastUpdated)) / 60000);
        return res.status(403).json({
          message: `You can update Max Captures only once every hour. Try again in ${minutesLeft} minute(s).`,
        });
      }

      user.maxCaptures = maxCaptures;
      user.lastUpdatedMaxCaptures = now;
      user.markModified("maxCaptures");
      await user.save({ validateBeforeSave: false });

      console.log("Updated User:", user);
      return res.json({ message: "Max captures updated successfully", user });
    } else {
      const newUser = new UserLeadCounter({
        user_mobile_number,
        maxCaptures,
        lastUpdatedMaxCaptures: new Date(),
      });
      await newUser.save();

      console.log("New User Created:", newUser);
      return res.json({
        message: "Max captures set successfully",
        user: newUser,
      });
    }
  } catch (error) {
    console.error("Error updating max captures:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET endpoint to fetch the user's selected states
app.get("/api/get-states", async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }
    const settings = await Settings.findOne({ userEmail });
    if (!settings) {
      return res.json({ states: [] });
    }
    res.json({ states: settings.selectedStates || [] });
  } catch (error) {
    console.error("Error fetching states:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST endpoint to update the user's selected states
app.post("/api/update-states", async (req, res) => {
  try {
    const { userEmail, states } = req.body;
    if (!userEmail || !Array.isArray(states)) {
      return res.status(400).json({ message: "Invalid request data" });
    }
    const updatedSettings = await Settings.findOneAndUpdate(
      { userEmail: userEmail },
      { $set: { selectedStates: states } },
      { new: true, upsert: true }
    );
    res.json({
      message: "States updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating states:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/api/restore-initial-settings", async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const settings = await Settings.findOne({ userEmail });
    if (!settings) {
      return res.status(404).json({ message: "No settings found to restore." });
    }

    // --- THIS IS THE FIX ---
    // Check if the initial data fields actually exist before trying to use them.
    if (!settings.initialSentences || !settings.initialWordArray) {
      return res.status(400).json({ message: "No initial settings backup found for this user." });
    }

    // Copy the initial data back to the main fields
    settings.sentences = settings.initialSentences;
    settings.wordArray = settings.initialWordArray;

    await settings.save(); // Save the changes

    res.json({
      message: "Settings have been successfully reverted to their initial state.",
      settings: settings,
    });

  } catch (error) {
    console.error("Error restoring initial settings:", error);
    res.status(500).json({ message: "Server error while restoring settings." });
  }
});
app.get("/api/get-max-captures", async (req, res) => {
  try {
    const { user_mobile_number } = req.query;

    let user = await UserLeadCounter.findOne({ user_mobile_number });

    // ✅ If the user is not found, create a new record with default values
    if (!user) {
      user = new UserLeadCounter({ user_mobile_number });
      await user.save();
    }

    res.json({
      maxCaptures: user.maxCaptures,
      lastUpdatedMaxCaptures: user.lastUpdatedMaxCaptures,
    });
  } catch (error) {
    console.error("Error fetching max captures:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const cron = require("node-cron");
async function resetLeadCounters() {
  try {
    console.log("Checking if lead counters need reset...");

    // Get the last reset time from one document
    const lastResetEntry = await UserLeadCounter.findOne({}, "lastReset");

    const lastResetDate = lastResetEntry
      ? new Date(lastResetEntry.lastReset)
      : null;
    const now = new Date();

    // Get today's 7:00 AM
    const today7AM = new Date();
    today7AM.setHours(5, 0, 0, 0);

    // If last reset was before today's 7 AM, reset counters
    if (!lastResetDate || lastResetDate < today7AM) {
      console.log("Resetting lead counters...");
      await UserLeadCounter.updateMany({}, { leadCount: 0, lastReset: now });
      console.log("Lead counters reset successfully.");
    } else {
      console.log("Lead counters were already reset today. No action needed.");
    }
  } catch (error) {
    console.error("Error resetting lead counters:", error);
  }
}

resetLeadCounters();

// Schedule cron job to run every day at 5 AM
cron.schedule("0 5 * * *", resetLeadCounters);
// Function to check subscription validity and stop expired users
const checkSubscriptionsAndStop = async () => {
  try {
    console.log("Running subscription check at 5 AM...");
    
    // Get all payments with their subscription details
    const payments = await Payment.find({}).sort({ created_at: -1 });
    
    // Group payments by email to get the latest subscription for each user
    const userSubscriptions = new Map();
    
    payments.forEach(payment => {
      if (!userSubscriptions.has(payment.email)) {
        const subscriptionDays = SUBSCRIPTION_DURATIONS[payment.subscription_type] || 0;
        const createdDate = new Date(payment.created_at);
        const expiryDate = new Date(createdDate.getTime() + subscriptionDays * 24 * 60 * 60 * 1000);
        const currentDate = new Date();
        const daysRemaining = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
        
        userSubscriptions.set(payment.email, {
          email: payment.email,
          uniqueId: payment.unique_id, // ✅ Store the unique_id from payment
          expiryDate,
          daysRemaining,
          hasValidSubscription: daysRemaining > 0,
          subscriptionType: payment.subscription_type
        });
      }
    });
    
    // Find all users with active status or running processes
    const activeUsers = await User.find({ 
      status: { $ne: "Stopped" }
    });
    
    console.log(`Found ${activeUsers.length} active users to check`);
    
    // Check each active user's subscription
    for (const user of activeUsers) {
      const subscription = userSubscriptions.get(user.email);
      
      // If no subscription found or subscription expired
      if (!subscription || !subscription.hasValidSubscription) {
        console.log(`User ${user.email} has expired/no subscription. Stopping service...`);
        
        // Use the unique_id from payment record
        const uniqueId = subscription?.uniqueId;
        
        if (uniqueId) {
          try {
            // Call the stop route logic
            const pythonProcess = activePythonProcesses.get(uniqueId);
            if (pythonProcess) {
              console.log(`Sending SIGINT to Python script for ${user.email} (uniqueId: ${uniqueId})...`);
              activePythonProcesses.delete(uniqueId);
              cleanupDisplay(uniqueId);
              pythonProcess.kill("SIGINT");
            }
            
            // Reset user status in DB
            await User.findOneAndUpdate(
              { email: user.email },
              { 
                status: "Stopped", 
                startTime: new Date(), 
                autoStartEnabled: false 
              },
              { new: true }
            );
            
            console.log(`Successfully stopped service for ${user.email}`);
          } catch (error) {
            console.error(`Error stopping service for ${user.email}:`, error);
          }
        } else {
          // Just update the status if no uniqueId found
          await User.findOneAndUpdate(
            { email: user.email },
            { 
              status: "Stopped", 
              autoStartEnabled: false 
            },
            { new: true }
          );
          console.log(`Updated status for ${user.email} (no uniqueId found)`);
        }
      } else {
        console.log(`User ${user.email} has valid subscription (${subscription.daysRemaining} days remaining)`);
      }
    }
    
    console.log("Subscription check completed");
  } catch (error) {
    console.error("Error in subscription check:", error);
  }
};

// Schedule cron job to run every day at 5 AM
cron.schedule("0 5 * * *", checkSubscriptionsAndStop);

const SUBSCRIPTION_DURATIONS = {
  "one-mo": 30,
  "three-mo": 60,
  "six-mo": 180,
  "year-mo": 365,
  "7-days": 7,
};

// cron.schedule("0 6 * * *", async () => {
//   console.log("Running scheduled task at 6:00 AM...");

//   try {
//     const usersToStart = await User.find({
//       autoStartEnabled: true, // Add this flag per user to control auto-start
//     });

//     for (const user of usersToStart) {
//       const settings = await Settings.findOne({ userEmail: user.email });

//       if (
//         !settings ||
//         (!settings.sentences?.length && !settings.wordArray?.length && !settings.h2WordArray?.length)
//       ) {
//         console.log(`Skipping ${user.email}: No valid settings found.`);
//         continue;
//       }

//       if (!user.mobileNumber || !user.savedPassword) {
//         console.log(`Skipping ${user.email}: Missing credentials.`);
//         continue;
//       }

//       // 3. Get the latest payment (based on created_at)
//       const latestPayment = await Payment.findOne({ email: user.email })
//         .sort({ created_at: -1 });

//       if (!latestPayment || !latestPayment.unique_id) {
//         console.log(`⚠️ Skipping ${user.email}: No valid unique_id found in payments.`);
//         continue;
//       }

//       const latestUniqueId = latestPayment.unique_id;

//       const subscriptionDays =
//         SUBSCRIPTION_DURATIONS[latestPayment.subscription_type];
//       if (!subscriptionDays) {
//         console.log(`Skipping ${user.email}: Unknown subscription type.`);
//         continue;
//       }

//       const expirationDate = new Date(latestPayment.created_at);
//       expirationDate.setDate(expirationDate.getDate() + subscriptionDays);

//       // Check if the subscription is still active
//       if (new Date() > expirationDate) {
//         console.log(
//           `Skipping ${user.email
//           }: Subscription expired on ${expirationDate.toDateString()}.`
//         );
//         await User.updateOne({ email: user.email }, { status: "stopped" });
//         continue;
//       }

//       try {
//         await axios.post("https://api.leadscruise.com/api/cycle", {
//           sentences: settings.sentences,
//           wordArray: settings.wordArray,
//           h2WordArray: settings.h2WordArray,
//           mobileNumber: user.mobileNumber,
//           password: user.savedPassword,
//           userEmail: user.email,
//           uniqueId: latestUniqueId,
//           minOrder: settings.minOrder,
//           leadTypes: settings.leadTypes,
//         });
//         console.log(`Started script for ${user.email}`);
//       } catch (error) {
//         console.error(`Failed to start script for ${user.email}:`, error.message);
//       }
//     }
//   } catch (err) {
//     console.error("Cron job error:", err.message);
//   }
// });

app.post("/api/cycle", async (req, res) => {
  console.log("Received raw data:", JSON.stringify(req.body, null, 2));
  let {
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
    userEmail,
    minOrder,
    leadTypes,
    selectedStates,
    thresholdScore,
  } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Empty request body. Ensure the request has a JSON payload.",
    });
  }

  if (
    !Array.isArray(sentences) ||
    !Array.isArray(wordArray) ||
    !Array.isArray(h2WordArray)
  ) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid input format. sentences, wordArray, and h2WordArray should be arrays.",
    });
  }

  if (!mobileNumber || !userEmail || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Mobile number, Email, and uniqueId are required.",
    });
  }

  if (!password) {
    try {
      const userFromDb = await User.findOne({ email: userEmail });
      if (!userFromDb) {
        return res.status(404).json({
          status: "error",
          message: "User not found in database.",
        });
      }
      password = userFromDb.savedPassword;
      console.log(`Password taken from DB for ${userEmail}`);
    } catch (err) {
      console.error("Error fetching password from DB:", err);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch password from database.",
      });
    }
  }

  const startTime = new Date();

  await User.findOneAndUpdate(
    { email: userEmail },
    { status: "Running", startTime },
    { new: true, upsert: true }
  );

  let userCounter = await UserLeadCounter.findOne({
    user_mobile_number: mobileNumber,
  });

  if (!userCounter) {
    userCounter = new UserLeadCounter({
      user_mobile_number: mobileNumber,
      leadCount: 0,
    });
    await userCounter.save();
  }
  let leadCount = userCounter.leadCount, maxCaptures = userCounter.maxCaptures;

  const inputData = JSON.stringify({
    sentences,
    wordArray,
    h2WordArray,
    mobileNumber,
    password,
    uniqueId,
    minOrder,
    leadTypes,
    selectedStates,
    leadCount,
    maxCaptures,
    thresholdScore,
  });

  console.log("Spawning Python LOGIN process...");

  // Spawn the login script instead of the monolithic script
  const pythonProcess = spawn("python3", ["-u", "login_script.py"]);

  // Store the Python process reference using `uniqueId`
  activePythonProcesses.set(uniqueId, pythonProcess);

  console.log("Sending data to Python login script:", inputData);
  pythonProcess.stdin.write(inputData + "\n");

  let result = "";
  let error = "";

  pythonProcess.stdout.on("data", (data) => {
    const dataString = data.toString();
    console.log("Python script stdout:", dataString);
    result += dataString;

    // Check for buyer balance information
    if (dataString.includes("BUYER_BALANCE:")) {
      const balanceMatch = dataString.match(/BUYER_BALANCE:(\d+)/);
      if (balanceMatch && balanceMatch[1]) {
        const balance = parseInt(balanceMatch[1], 10);

        User.findOneAndUpdate(
          { email: userEmail },
          { buyerBalance: balance },
          { new: true }
        ).then((updatedUser) => {
          console.log(`Updated buyer balance for ${userEmail} to ${balance}`);
        }).catch(err => {
          console.error("Error updating buyer balance:", err);
        });
      }
    }

    if (dataString.includes("ZERO_BALANCE_DETECTED")) {
      console.log("Zero balance detected for user:", userEmail);
    }

    if (dataString.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for uniqueId:", uniqueId);
      const requestId = Date.now().toString();
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null
      });
    }

    if (dataString.includes("OTP_FAILED_INCORRECT")) {
      console.log("Incorrect OTP detected for", uniqueId);
      otpFailures.set(uniqueId, true);
    }

    if (dataString.includes("ROUTE_TO:")) {
      const routeMatch = dataString.match(/ROUTE_TO:(.+)/);
      if (routeMatch && routeMatch[1]) {
        const route = routeMatch[1].trim();
        console.log(`Python script requests routing to: ${route}`);

        if (route === "/execute-task") {
          (async () => {
            await User.findOneAndUpdate(
              { email: userEmail },
              { status: "Stopped", autoStartEnabled: false },
              { new: true }
            );

            if (!responseSent) {
              res.status(400).json({
                status: "error",
                message: "Enter password button not found. Please login to your leads provider account first.",
                route: "/execute-task"
              });
              responseSent = true;
            }

            pythonProcess.kill("SIGINT");
            activePythonProcesses.delete(uniqueId);
            cleanupDisplay(uniqueId);
          })();
          return;
        }
      }
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });

  let killedDueToLimit = false;
  let responseSent = false;

  pythonProcess.on("close", async (code) => {
    pythonProcess.stdin.end();
    activePythonProcesses.delete(uniqueId);
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    console.log(`Python login script exited with code: ${code}`);

    cleanupDisplay(uniqueId);

    if (!killedDueToLimit) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { status: "Stopped", startTime: new Date(), autoStartEnabled: false },
        { new: true }
      );
    }

    if (!responseSent) {
      if (code === 0) {
        res.json({ status: "success", message: "Successfully executed!!" });
      } else {
        res.status(500).json({
          status: "error",
          message: `AI failed`,
        });
      }
      responseSent = true;
    }
  });
});

// New endpoint to restart worker script without disrupting login
app.post("/api/restart-worker", async (req, res) => {
  const { uniqueId } = req.body;

  if (!uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "uniqueId is required",
    });
  }

  const pythonProcess = activePythonProcesses.get(uniqueId);

  if (!pythonProcess) {
    return res.status(404).json({
      status: "error",
      message: "No active process found for this uniqueId",
    });
  }

  try {
    // Send restart signal to login script which will restart the worker
    pythonProcess.stdin.write(JSON.stringify({ command: "RESTART_WORKER" }) + "\n");

    res.json({
      status: "success",
      message: "Worker restart signal sent",
    });
  } catch (error) {
    console.error("Error restarting worker:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to restart worker",
    });
  }
});

// Endpoint to get all active sessions
app.get("/api/active-sessions", async (req, res) => {
  try {
    const activeSessionIds = Array.from(activePythonProcesses.keys());

    res.json(activeSessionIds);
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch active sessions",
    });
  }
});

// Endpoint to check if login session is still active
app.get("/api/session-status/:uniqueId", async (req, res) => {
  const { uniqueId } = req.params;

  const pythonProcess = activePythonProcesses.get(uniqueId);

  if (!pythonProcess) {
    return res.json({
      status: "inactive",
      message: "No active session found",
    });
  }

  // Check if the process is still running
  if (pythonProcess.killed) {
    activePythonProcesses.delete(uniqueId);
    return res.json({
      status: "inactive",
      message: "Session has been terminated",
    });
  }

  res.json({
    status: "active",
    message: "Session is active",
  });
});

app.get("/api/check-otp-request/:uniqueId", (req, res) => {
  const { uniqueId } = req.params;
  const otpRequest = otpRequests.get(uniqueId);

  if (otpRequest && !otpRequest.otpReceived) {
    res.json({
      otpRequired: true,
      requestId: otpRequest.requestId,
      type: otpRequest.type || "login"
    });
  } else {
    res.json({
      otpRequired: false
    });
  }
});

app.get("/api/check-otp-failure/:uniqueId", (req, res) => {
  const { uniqueId } = req.params;
  if (otpFailures.has(uniqueId)) {
    return res.json({ otpFailed: true });
  } else {
    return res.json({ otpFailed: false });
  }
});

// New endpoint to submit OTP
app.post("/api/submit-otp", async (req, res) => {
  const { otp, userEmail, uniqueId, requestId } = req.body;

  if (!otp || !uniqueId || !requestId) {
    return res.status(400).json({
      status: "error",
      message: "OTP, uniqueId, and requestId are required."
    });
  }

  const otpRequest = otpRequests.get(uniqueId);

  if (!otpRequest || otpRequest.requestId !== requestId) {
    return res.status(400).json({
      status: "error",
      message: "Invalid OTP request."
    });
  }

  // Update the OTP request with the received OTP
  otpRequest.otp = otp;
  otpRequest.otpReceived = true;
  otpRequests.set(uniqueId, otpRequest);

  // Send OTP to Python script
  const pythonProcess = activePythonProcesses.get(uniqueId);
  if (pythonProcess && !pythonProcess.killed) {
    try {
      const otpData = JSON.stringify({ type: "OTP_RESPONSE", otp: otp });
      pythonProcess.stdin.write(otpData + "\n");
      console.log(`Sent OTP ${otp} to Python process for uniqueId: ${uniqueId}, type: ${otpRequest.type || "login"}`);
    } catch (error) {
      console.error("Error sending OTP to Python process:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to send OTP to automation script."
      });
    }
  } else {
    return res.status(400).json({
      status: "error",
      message: "Automation script is not running."
    });
  }

  res.json({
    status: "success",
    message: "OTP submitted successfully."
  });
});

// API to stop the script
app.post("/api/stop", async (req, res) => {
  const { userEmail, uniqueId } = req.body;
  if (!uniqueId || !userEmail) {
    return res
      .status(400)
      .json({ status: "error", message: "uniqueId and Email are required." });
  }

  const user = await User.findOne({ email: userEmail });
  if (!user || !user.startTime) {
    if (user) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { autoStartEnabled: false },
        { new: true }
      );
    }
    return res.status(404).json({
      status: "error",
      message: "No running AI found for this user.",
    });
  }

  const startTime = new Date(user.startTime);
  const currentTime = new Date();
  const elapsedTime = Math.floor((currentTime - startTime) / 1000); // in seconds

  if (elapsedTime < 300) {
    return res.status(403).json({
      status: "error",
      message: `Please wait at least ${Math.ceil(
        (300 - elapsedTime) / 60
      )} more minutes before stopping.`,
    });
  }

  const pythonProcess = activePythonProcesses.get(uniqueId);
  if (pythonProcess) {
    console.log("Sending SIGINT (Ctrl+C) to Python script...");
    activePythonProcesses.delete(uniqueId);
    cleanupDisplay(uniqueId);
    pythonProcess.kill("SIGINT"); // Send SIGINT to allow graceful shutdown
  }

  // Reset user status and startTime in DB
  await User.findOneAndUpdate(
    { email: userEmail },
    { status: "Stopped", startTime: new Date(), autoStartEnabled: false },
    { new: true }
  );

  res.json({ status: "success", message: "Stopped Sucessfully" });
});

/**
 * Cleanup function to remove /tmp/.X<DISPLAY>-lock
 * based on the uniqueId's assigned display number.
 */
function cleanupDisplay(uniqueId) {
  const displayNumber = `X${uniqueId}`; // Assuming `uniqueId` is mapped to display number
  const lockFilePath = `/tmp/.${displayNumber}-lock`;

  if (fs.existsSync(lockFilePath)) {
    try {
      fs.unlinkSync(lockFilePath);
      console.log(`Removed display lock file: ${lockFilePath}`);
    } catch (err) {
      console.error(`Failed to remove ${lockFilePath}:`, err);
    }
  }
}

app.get("/api/user/balance", async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      buyerBalance: user.buyerBalance,
      hasZeroBalance: user.buyerBalance === 0
    });
  } catch (error) {
    console.error("Error fetching user balance:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  mobile: { type: String, required: true },
  user_mobile_number: { type: String, required: true },
  lead_bought: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['AI', 'Manual'], default: 'Manual' },
  aiProcessed: { type: Boolean, default: false },

  // ✅ new field
  score: { type: Number, default: 0 }
}, {
  strict: false,
  versionKey: false
});

const Lead = mongoose.model("Lead", leadSchema);

const WhatsAppSettings = require("./models/WhatsAppSettings");
// Endpoint to receive lead data from Selenium script and store in DB
app.post("/api/store-lead", async (req, res) => {
  try {
    const { name, email, mobile, user_mobile_number, lead_bought, address, score } = req.body;

    if (!name || !mobile || !user_mobile_number || !lead_bought) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch or create user lead counter
    let userCounter = await UserLeadCounter.findOne({ user_mobile_number });
    if (!userCounter) {
      userCounter = new UserLeadCounter({
        user_mobile_number,
        leadCount: 0,
        maxCaptures: 10,
      });
    }

    // Check for duplicate lead within last 4 days
    const existingLead = await Lead.findOne({
      name,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
    });

    if (existingLead) {
      const timeDiff = (new Date() - existingLead.createdAt) / 1000;
      if (timeDiff < 345600) {
        console.log("Duplicate lead detected. Skipping.");
        return res.status(409).json({ error: "Duplicate lead detected" });
      }
    }

    // ✅ Store new lead (with score)
    const newLead = new Lead({
      name,
      email,
      mobile,
      user_mobile_number,
      lead_bought,
      createdAt: new Date(),
      address,
      source: "AI",
      aiProcessed: true,
      score: typeof score === "number" ? score : 0  // 👈 store the score
    });

    await newLead.save();

    // Increment lead count
    userCounter.leadCount += 1;
    console.log(`User ${user_mobile_number} lead count incremented to ${userCounter.leadCount}`);
    await userCounter.save();

    console.log("Lead Data Stored:", newLead);

    return res.json({
      message: "Lead data stored successfully",
      lead: newLead,
    });

  } catch (error) {
    console.error("Error saving lead:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/get-all-leads", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }); // Sort by latest leads first
    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/get-leads/:mobileNumber", async (req, res) => {
  try {
    const { mobileNumber } = req.params;

    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    // Fetch leads that match the mobileNumber
    const leads = await Lead.find({ user_mobile_number: mobileNumber }).sort({
      createdAt: -1,
    });

    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const FetchedLead = mongoose.model("FetchedLead", leadSchema, "fetchedleads");

app.post("/api/store-fetched-lead", async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      user_mobile_number,
      lead_bought,
      timestamp_text,
      uniqueId,
      address
    } = req.body;

    if (!name || !mobile || !user_mobile_number || !lead_bought || !timestamp_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Step 1: Check for duplicate leads in FetchedLead collection
    const existingFetchedLead = await FetchedLead.findOne({
      name,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
    });

    if (existingFetchedLead) {
      console.log("Duplicate lead detected in FetchedLead. Stopping script for user:", user_mobile_number);

      const processKey = uniqueId ? uniqueId + 100000 : null;
      if (processKey && activePythonProcesses.has(processKey)) {
        const pythonProcess = activePythonProcesses.get(processKey);

        try {
          pythonProcess.kill("SIGTERM");
          setTimeout(() => {
            if (activePythonProcesses.has(processKey)) {
              console.log(`Force killing Python process for uniqueId: ${uniqueId}`);
              pythonProcess.kill("SIGKILL");
            }
          }, 2000);
        } catch (error) {
          console.error("Error terminating Python process:", error);
          pythonProcess.kill("SIGKILL");
        }

        activePythonProcesses.delete(processKey);

        if (uniqueId && otpRequests.has(uniqueId)) {
          otpRequests.delete(uniqueId);
          otpFailures.delete(uniqueId);
        }

        cleanupDisplay(uniqueId);
        console.log(`Python process terminated for uniqueId: ${uniqueId}`);
      }

      return res.status(409).json({
        error: "DUPLICATE_LEAD_STOP_SCRIPT",
        message: "Lead fetching stopped due to duplicate detection",
        action: "script_terminated",
      });
    }

    // ✅ Step 2: Check if lead already exists in AI-generated leads collection
    const existingAILead = await Lead.findOne({
      name,
      email,
      mobile,
      user_mobile_number,
      $expr: {
        $eq: [
          { $substr: ["$lead_bought", 0, 10] },
          lead_bought.substring(0, 10),
        ],
      },
      address,
      source: "AI",
      aiProcessed: true,
    });

    // ✅ Step 3: Determine source and score
    const leadSource = existingAILead ? "AI" : "Manual";
    const isAIProcessed = !existingAILead;
    const scoreValue = existingAILead ? existingAILead.score || 0 : 0; // 👈 fetch score if found

    // ✅ Step 4: Store the new fetched lead
    const newLead = new FetchedLead({
      name,
      email,
      mobile,
      user_mobile_number,
      lead_bought,
      address,
      createdAt: timestamp_text ? new Date(timestamp_text) : new Date(),
      source: leadSource,
      aiProcessed: isAIProcessed,
      score: scoreValue, // 👈 store the same score in fetched lead
    });

    await newLead.save();
    console.log("Lead saved successfully in FetchedLead:", newLead._id);

    return res.json({
      message: "Lead stored successfully",
      lead: newLead,
    });

  } catch (error) {
    console.error("Error storing fetched lead:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// WhatsApp Queue Processor - runs as a separate background process
// class WhatsAppQueueProcessor {
//   constructor() {
//     this.isProcessing = false;
//     this.processInterval = null;
//   }
//   start() {
//     if (this.processInterval) {
//       console.log("Queue processor is already running");
//       return;
//     }
//     console.log("Starting WhatsApp queue processor...");
//     // Check for messages every 10 seconds
//     this.processInterval = setInterval(() => {
//       this.processQueue();
//     }, 10000);
//     // Process immediately on start
//     this.processQueue();
//   }
//   stop() {
//     if (this.processInterval) {
//       clearInterval(this.processInterval);
//       this.processInterval = null;
//       console.log("WhatsApp queue processor stopped");
//     }
//   }
//   async processQueue() {
//     if (this.isProcessing) {
//       console.log("Queue processor is already running, skipping this cycle");
//       return;
//     }
//     this.isProcessing = true;
//     try {
//       // Find the next pending message that's scheduled to be sent
//       const nextMessage = await WhatsAppMessageQueue.findOne({
//         status: 'pending',
//         scheduledAt: { $lte: new Date() },
//         attempts: { $lt: 3 } // Max 3 attempts
//       }).sort({ scheduledAt: 1 });
//       if (!nextMessage) {
//         // No messages to process
//         this.isProcessing = false;
//         return;
//       }
//       console.log(`Processing WhatsApp message: ${nextMessage._id}`);
//       // Mark as processing
//       nextMessage.status = 'processing';
//       nextMessage.attempts += 1;
//       nextMessage.lastAttempt = new Date();
//       await nextMessage.save();
//       // Process the message
//       const result = await this.sendWhatsAppMessage(nextMessage);
//       if (result.success) {
//         // Mark as completed
//         nextMessage.status = 'completed';
//         nextMessage.completedAt = new Date();
//         if (result.verificationCode) {
//           nextMessage.verificationCode = result.verificationCode;
//         }
//         await nextMessage.save();
//         console.log(`WhatsApp message completed: ${nextMessage._id}`);
//         // Schedule next message processing with 60-second delay
//         await this.scheduleNextMessages();
//       } else {
//         // Handle failure
//         if (nextMessage.attempts >= nextMessage.maxAttempts) {
//           nextMessage.status = 'failed';
//           nextMessage.errorMessage = result.error || 'Max attempts reached';
//         } else {
//           nextMessage.status = 'pending';
//           // Retry after 5 minutes
//           nextMessage.scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
//         }
//         await nextMessage.save();
//         console.log(`WhatsApp message failed: ${nextMessage._id}, attempts: ${nextMessage.attempts}`);
//       }
//     } catch (error) {
//       console.error("Error in queue processor:", error);
//     } finally {
//       this.isProcessing = false;
//     }
//   }
//   async scheduleNextMessages() {
//     // Find all pending messages and ensure they have proper spacing
//     const pendingMessages = await WhatsAppMessageQueue.find({
//       status: 'pending',
//       attempts: { $lt: 3 }
//     }).sort({ scheduledAt: 1 });
//     if (pendingMessages.length === 0) return;
//     // Schedule messages with 60-second gaps
//     const now = new Date();
//     const baseTime = new Date(now.getTime() + 60000); // Start 60 seconds from now
//     for (let i = 0; i < pendingMessages.length; i++) {
//       const message = pendingMessages[i];
//       const scheduledTime = new Date(baseTime.getTime() + (i * 60000)); // 60 seconds apart
//       if (message.scheduledAt < scheduledTime) {
//         message.scheduledAt = scheduledTime;
//         await message.save();
//       }
//     }
//   }
//   async sendWhatsAppMessage(messageItem) {
//     return new Promise((resolve) => {
//       let verificationCode = null;
//       let errorOutput = "";
//       let isCompleted = false;
//       const messagesJSON = JSON.stringify([messageItem.templateMessage]);
//       // Start the Python process
//       const pythonProcess = spawn('python3', [
//         'whatsapp.py',
//         messageItem.whatsappNumber,
//         messagesJSON,
//         messageItem.receiverNumber,
//       ]);
//       const rl = readline.createInterface({ input: pythonProcess.stdout });
//       rl.on('line', async (line) => {
//         console.log(`Python output for ${messageItem._id}: ${line}`);
//         // Handle specific errors that should be ignored
//         if (line.includes("504 Gateway Time-out") ||
//           line.includes("Failed to send data") ||
//           line.includes("Send button not found or not clickable")) {
//           console.warn("Detected known error but continuing execution:", line);
//         }
//         const codeMatch = line.match(/WHATSAPP_VERIFICATION_CODE:([A-Z0-9-]+)/);
//         if (codeMatch && codeMatch[1]) {
//           verificationCode = codeMatch[1];
//           console.log(`Verification code captured for ${messageItem._id}: ${verificationCode}`);
//           try {
//             // Update the verificationCode in whatsapp settings
//             await WhatsAppSettings.findOneAndUpdate(
//               { mobileNumber: messageItem.user_mobile_number },
//               { verificationCode },
//               { new: true }
//             );
//             console.log("Verification code updated in DB");
//           } catch (dbError) {
//             console.error("Error updating verification code:", dbError);
//           }
//         }
//       });
//       pythonProcess.stderr.on('data', (data) => {
//         const errorMsg = data.toString();
//         errorOutput += errorMsg;
//         console.error(`Python error for ${messageItem._id}: ${errorMsg}`);
//       });
//       pythonProcess.on('close', (code) => {
//         if (isCompleted) return;
//         isCompleted = true;
//         console.log(`WhatsApp script for ${messageItem._id} exited with code ${code}`);
//         if (code === 0 || code === null) {
//           resolve({ success: true, verificationCode });
//         } else {
//           resolve({
//             success: false,
//             code,
//             error: errorOutput,
//             message: `WhatsApp script failed with code ${code}`
//           });
//         }
//       });
//       pythonProcess.on('error', (err) => {
//         if (isCompleted) return;
//         isCompleted = true;
//         console.error(`Failed to start Python process for ${messageItem._id}:`, err);
//         resolve({ success: false, error: err.message });
//       });
//       // Set timeout for this specific message (10 minutes)
//       const timeout = setTimeout(() => {
//         if (isCompleted) return;
//         isCompleted = true;
//         console.log(`WhatsApp script for ${messageItem._id} reached timeout, completing process`);
//         pythonProcess.kill();
//         resolve({
//           success: true,
//           timeout: true,
//           message: "WhatsApp script completed after timeout",
//           verificationCode
//         });
//       }, 10 * 60 * 1000);
//       pythonProcess.on('close', () => {
//         clearTimeout(timeout);
//       });
//     });
//   }
// }
// // Initialize and start the queue processor
// const whatsappQueueProcessor = new WhatsAppQueueProcessor();
// // Start the processor when the application starts
// whatsappQueueProcessor.start();
// Graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('Received SIGTERM, stopping queue processor...');
//   whatsappQueueProcessor.stop();
//   process.exit(0);
// });
// process.on('SIGINT', () => {
//   console.log('Received SIGINT, stopping queue processor...');
//   whatsappQueueProcessor.stop();
//   process.exit(0);
// });
// Optional: API endpoints to manage the queue
// app.get("/api/whatsapp-queue/status", async (req, res) => {
//   try {
//     const stats = await WhatsAppMessageQueue.aggregate([
//       {
//         $group: {
//           _id: "$status",
//           count: { $sum: 1 }
//         }
//       }
//     ]);
//     const pending = await WhatsAppMessageQueue.find({
//       status: 'pending'
//     }).sort({ scheduledAt: 1 }).limit(10);
//     res.json({
//       stats,
//       nextPendingMessages: pending
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
// app.post("/api/whatsapp-queue/retry-failed", async (req, res) => {
//   try {
//     const result = await WhatsAppMessageQueue.updateMany(
//       { status: 'failed', attempts: { $lt: 3 } },
//       { 
//         status: 'pending',
//         scheduledAt: new Date(),
//         errorMessage: null
//       }
//     );
//     res.json({
//       message: `${result.modifiedCount} failed messages queued for retry`
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.post("/api/start-fetching-leads", async (req, res) => {
  console.log("Received raw data:", JSON.stringify(req.body, null, 2));
  let {
    mobileNumber,
    password,
    uniqueId,
    userEmail,
  } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Empty request body. Ensure the request has a JSON payload.",
    });
  }

  if (!mobileNumber || !password || !userEmail || !uniqueId) {
    return res.status(400).json({
      status: "error",
      message: "Mobile number, Email, password, and uniqueId are required.",
    });
  }

  // Get current time
  const startTime = new Date();
  const inputData = JSON.stringify({
    mobileNumber,
    password,
    uniqueId,
  });

  console.log("Spawning Python process for 'lead_fetch_script.py'...");
  const pythonProcess = spawn("python3", ["-u", "lead_fetch_script.py"]);

  // Store the Python process reference using `uniqueId`
  const processKey = uniqueId + 100000;
  activePythonProcesses.set(processKey, pythonProcess);

  console.log("Sending data to Python script:", inputData);
  pythonProcess.stdin.write(inputData + "\n");

  let result = "";
  let error = "";

  pythonProcess.stdout.on("data", (data) => {
    const dataString = data.toString();
    console.log("Python script stdout:", data.toString());
    result += data.toString();

    // Check for OTP request from Python script
    if (dataString.includes("OTP_REQUEST_INITIATED")) {
      console.log("OTP request detected for uniqueId:", uniqueId);
      const requestId = Date.now().toString(); // Generate unique request ID
      otpRequests.set(uniqueId, {
        requestId,
        timestamp: new Date(),
        otpReceived: false,
        otp: null
      });
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python script stderr:", data.toString());
    error += data.toString();
  });

  pythonProcess.on("close", async (code) => {
    pythonProcess.stdin.end();
    activePythonProcesses.delete(processKey); // Remove from tracking
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    console.log(`Python script exited with code: ${code}`);

    // Cleanup display lock file
    cleanupDisplay(uniqueId);

    if (code === 0) {
      res.json({ status: "success", message: "Successfully executed!!" });
    } else if (code === null || code === 15) { // SIGTERM signal
      res.json({
        status: "terminated",
        message: "Script terminated due to duplicate lead detection"
      });
    } else {
      res.status(500).json({
        status: "error",
        message: `AI failed`,
      });
    }
  });

  // Handle process termination errors
  pythonProcess.on('error', (err) => {
    console.error('Python process error:', err);
    activePythonProcesses.delete(processKey);
    otpRequests.delete(uniqueId);
    otpFailures.delete(uniqueId);
    cleanupDisplay(uniqueId);
  });
});

app.get("/api/get-user-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Use native MongoDB driver instead of Mongoose
    const leads = await mongoose.connection.db
      .collection('fetchedleads')
      .find({ user_mobile_number: userMobile })
      .sort({ createdAt: -1 })
      .toArray();

    const totalLeads = leads.length;

    res.status(200).json({
      success: true,
      leads,
      totalLeads
    });

  } catch (error) {
    console.error("Error fetching user leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Function to get the LeadFetcher application directory
function getLeadFetcherDirectory() {
  if (os.platform() === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ||
      path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'LeadFetcher');
  } else {
    return path.join(os.homedir(), '.leadfetcher');
  }
}

// Function to ensure directory exists
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    return false;
  }
}

// Function to safely write file with fallback
function safeWriteFile(filePath, data, fallbackDir = null) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);

    // Write file
    fs.writeFileSync(filePath, data);
    console.log(`✅ File saved successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to write file ${filePath}:`, error);

    // Try fallback location if provided
    if (fallbackDir) {
      try {
        ensureDirectoryExists(fallbackDir);
        const fallbackPath = path.join(fallbackDir, path.basename(filePath));
        fs.writeFileSync(fallbackPath, data);
        console.log(`✅ File saved to fallback location: ${fallbackPath}`);
        return true;
      } catch (fallbackError) {
        console.error(`❌ Fallback write also failed:`, fallbackError);
      }
    }
    return false;
  }
}

app.post("/api/data-received-confirmation", async (req, res) => {
  try {
    const {
      status,
      message,
      mobile_number,
      timestamp,
      client_info,
      received_data_summary
    } = req.body;

    console.log("📨 Data Received Confirmation:");
    console.log("================================");
    console.log(`Status: ${status}`);
    console.log(`Message: ${message}`);
    console.log(`Mobile Number: ${mobile_number}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Client: ${client_info?.application} v${client_info?.version}`);
    console.log(`Total Leads: ${received_data_summary?.total_leads}`);
    console.log(`Leads Retrieved: ${received_data_summary?.leads_count}`);
    console.log("================================");

    // Prepare data object (overwrite each time)
    const confirmationData = {
      status,
      message,
      mobile_number,
      timestamp,
      client_info,
      received_data_summary,
      received_at: new Date().toISOString()
    };

    // Get LeadFetcher application directory
    const leadFetcherDir = getLeadFetcherDirectory();
    const filePath = path.join(leadFetcherDir, "confirmations.json");

    // Fallback directory (current working directory)
    const fallbackDir = process.cwd();

    // Write confirmations.json to LeadFetcher directory
    const writeSuccess = safeWriteFile(
      filePath,
      JSON.stringify(confirmationData, null, 2),
      fallbackDir
    );

    console.log(`📁 Target directory: ${leadFetcherDir}`);
    console.log(`📄 Confirmation file: ${filePath}`);

    // Send success response back to client
    res.status(200).json({
      success: true,
      message: "Confirmation received successfully",
      received_at: confirmationData.received_at,
      confirmation_id: `conf_${Date.now()}_${mobile_number}`,
      file_location: writeSuccess ? filePath : path.join(fallbackDir, "confirmations.json")
    });

  } catch (error) {
    console.error("Error processing data received confirmation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process confirmation",
      message: error.message
    });
  }
});

app.get("/api/get-user-leads-with-message/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Fetch whatsapp settings for this user
    const settings = await WhatsAppSettings.findOne({ mobileNumber: userMobile });
    const user = await User.findOne({ mobileNumber: userMobile });

    if (!settings || !settings.whatsappNumber || !settings.messages || settings.messages.length === 0) {
      console.warn("No whatsapp settings found for this user");
      return res.status(404).json({
        success: false,
        message: "No whatsapp settings found for this user"
      });
    }

    // Fetch all leads
    const leads = await FetchedLead.find({
      user_mobile_number: userMobile
    })
      .sort({ createdAt: -1 })
      .select("name email mobile lead_bought createdAt address");

    // Prepare message for each lead
    const leadsWithMessages = leads.map((lead) => {
      let templateMessage = settings.messages[0]; // pick first template
      templateMessage = templateMessage
        .replace("{lead_name}", lead.name || "")
        .replace("{lead_product_requested}", lead.lead_bought || "")
        .replace("{leadscruise_email}", user?.email || "support@leadscruise.com");

      return {
        ...lead._doc,
        whatsappMessage: templateMessage,
        receiverNumber: lead.mobile
      };
    });

    const responsePayload = {
      success: true,
      totalLeads: leadsWithMessages.length,
      leads: leadsWithMessages,
      generated_at: new Date().toISOString()
    };

    // Get LeadFetcher application directory
    const leadFetcherDir = getLeadFetcherDirectory();
    const filePath = path.join(leadFetcherDir, "api_response.json");

    // Fallback directory (current working directory)
    const fallbackDir = process.cwd();

    // Save response to api_response.json in LeadFetcher directory
    const writeSuccess = safeWriteFile(
      filePath,
      JSON.stringify(responsePayload, null, 2),
      fallbackDir
    );

    console.log(`📁 Target directory: ${leadFetcherDir}`);
    console.log(`📄 API response file: ${filePath}`);
    console.log(`📊 Total leads processed: ${leadsWithMessages.length}`);

    // Add file location to response
    const responseWithLocation = {
      ...responsePayload,
      file_location: writeSuccess ? filePath : path.join(fallbackDir, "api_response.json")
    };

    res.status(200).json(responseWithLocation);

  } catch (error) {
    console.error("Error fetching user leads with message:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// Keep the count endpoint if needed elsewhere
app.get("/api/get-user-leads-count/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    const count = await FetchedLead.countDocuments({
      user_mobile_number: userMobile
    });

    res.status(200).json({
      success: true,
      count
    });

  } catch (error) {
    console.error("Error fetching leads count:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Optional: Get leads with filters (date range, lead source, etc.)
app.get("/api/get-filtered-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;
    const {
      page = 1,
      limit = 10,
      leadSource,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Build filter query
    let filterQuery = { user_mobile_number: userMobile };

    // Filter by lead source
    if (leadSource) {
      filterQuery.lead_bought = leadSource;
    }

    // Filter by date range
    if (startDate || endDate) {
      filterQuery.createdAt = {};
      if (startDate) {
        filterQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filterQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Search in name, email, or mobile
    if (search) {
      filterQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalLeads = await FetchedLead.countDocuments(filterQuery);

    // Fetch leads with filters and pagination
    const leads = await FetchedLead.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name email mobile lead_bought createdAt');

    const totalPages = Math.ceil(totalLeads / parseInt(limit));

    res.status(200).json({
      success: true,
      leads,
      totalLeads,
      totalPages,
      currentPage: parseInt(page),
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      filters: {
        leadSource,
        startDate,
        endDate,
        search
      }
    });

  } catch (error) {
    console.error("Error fetching filtered leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Export leads to CSV
app.get("/api/export-leads/:userMobile", async (req, res) => {
  try {
    const { userMobile } = req.params;
    const { leadSource, startDate, endDate } = req.query;

    if (!userMobile) {
      return res.status(400).json({ error: "User mobile number is required" });
    }

    // Build filter query
    let filterQuery = { user_mobile_number: userMobile };

    if (leadSource) {
      filterQuery.lead_bought = leadSource;
    }

    if (startDate || endDate) {
      filterQuery.createdAt = {};
      if (startDate) {
        filterQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filterQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Fetch all leads matching the filter
    const leads = await FetchedLead.find(filterQuery)
      .sort({ createdAt: -1 })
      .select('name email mobile lead_bought createdAt');

    // Convert to CSV format
    const csvHeader = 'Name,Email,Mobile,Lead Source,Date\n';
    const csvRows = leads.map(lead => {
      const date = new Date(lead.createdAt).toLocaleDateString();
      return `"${lead.name}","${lead.email || ''}","${lead.mobile}","${lead.lead_bought}","${date}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${userMobile}_${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(csvContent);

  } catch (error) {
    console.error("Error exporting leads:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

app.post('/api/reset-user-data', async (req, res) => {//start 26-8(7)
  try {
    const { userEmail, userMobile } = req.body;

    if (!userEmail || !userMobile) {
      return res.status(400).json({ success: false, message: "User email and mobile are required" });
    }
    if (userEmail === "demo@leadscruise.com") {
      return res.status(403).json({ success: false, message: "Demo account cannot be modified" });
    }

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      await Lead.deleteMany({ user_mobile_number: userMobile });
      await FetchedLead.deleteMany({ user_mobile_number: userMobile });
      await Settings.deleteOne({ userEmail: userEmail });
      return res.status(200).json({ success: true, message: "User not found, but associated data cleared." });
    }

    // Delete all related data
    await Promise.all([
      BillingDetails.deleteOne({ email: user.email }),
      IndiaMartAnalytics.deleteMany({ userId: user._id }),
      Payment.deleteMany({ email: user.email }),
      Referral.deleteOne({ email: user.email }),
      Settings.deleteOne({ userEmail: user.email }),
      Support.deleteMany({ email: user.email }),
      WhatsappSettings.deleteOne({ mobileNumber: user.mobileNumber }),
      Lead.deleteMany({ user_mobile_number: user.mobileNumber }),
      FetchedLead.deleteMany({ user_mobile_number: user.mobileNumber }),
    ]);

    // --- THIS IS THE FIX ---
    // Instead of user.save(), we issue a direct update to unset the password.
    // This bypasses the validation that was causing the error.
    await User.updateOne(
      { _id: user._id },
      { $unset: { savedPassword: "" } } // Removes the savedPassword field
    );

    res.status(200).json({ success: true, message: "User data, settings, and password have been reset successfully" });

  } catch (err) {
    console.error('Reset user data error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});// end 26-8(7)

app.delete("/api/delete-user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete from all collections
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      BillingDetails.deleteOne({ email: user.email }),
      IndiaMartAnalytics.deleteMany({ userId: user._id }),
      Payment.deleteMany({ email: user.email }),
      Referral.deleteOne({ email: user.email }),
      Settings.deleteOne({ userEmail: user.email }),
      Support.deleteMany({ email: user.email }),
      WhatsappSettings.deleteOne({ mobileNumber: user.mobileNumber }),
      Lead.deleteMany({ user_mobile_number: user.mobileNumber }),
      FetchedLead.deleteMany({ user_mobile_number: user.mobileNumber }),
    ]);

    res.json({ message: "User and all related data deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/notify-maintenance', (req, res) => {
  const { title, message } = req.body || {};
  // broadcast to everyone; you can target rooms/users if needed
  io.emit('maintenance-notice', { title, message, timestamp: Date.now() });
  res.json({ success: true });
});

io.on('connection', (socket) => {
  // console.log('Client connected', socket.id);

  // Optional: join rooms, auth, etc.
  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
