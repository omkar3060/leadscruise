const express = require("express");
const router = express.Router();
const multer = require("multer");

// Configure Multer for handling file uploads (store files in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
const Payment = require("../models/Payment");
const { latestId, getPaymentsByEmail,getAllSubscriptions,getSubscriptionMetrics } = require('../controllers/paymentController');
router.get("/get-latest-id", latestId);
router.get("/payments", getPaymentsByEmail);
router.get("/get-all-subscriptions", getAllSubscriptions);
router.get("/get-subscription-metrics", getSubscriptionMetrics);

router.get("/latest-payment", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const latestPayment = await Payment.findOne({ email }).sort({ created_at: -1 });

    if (!latestPayment || !latestPayment.unique_id) {
      return res.status(404).json({ message: "No valid unique_id found for this user" });
    }

    res.json({ unique_id: latestPayment.unique_id });
  } catch (err) {
    console.error("Error fetching latest payment:", err);
    res.status(500).json({ message: "Server error fetching latest payment" });
  }
});

// API Route to Upload PDF Invoice
router.post("/upload-invoice/:order_id", upload.single("invoice"), async (req, res) => {
    try {
      const { order_id } = req.params;
      const payment = await Payment.findOne({ unique_id: order_id }); 
  
      if (!payment) {
        return res.status(404).json({ message: "Payment record not found" });
      }
  
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      // Store PDF as binary data in MongoDB
      payment.invoice_pdf = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
  
      await payment.save();
  
      res.status(200).json({ message: "Invoice uploaded successfully" });
    } catch (error) {
      console.error("Error uploading invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get("/get-invoice/:order_id", async (req, res) => { 
    try {
        let { order_id } = req.params;

        if (!isNaN(order_id)) {
            order_id = Number(order_id);
        }

        const payment = await Payment.findOne({ unique_id: order_id });

        if (!payment) {
            return res.status(404).json({ message: "Payment record not found" });
        }

        if (!payment.invoice_pdf || !payment.invoice_pdf.data) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice_${order_id}.pdf`);
        res.send(payment.invoice_pdf.data);
        
    } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


  router.get("/get-subscription/:email", async (req, res) => {
    try {
      const { email } = req.params;
  
      // Fetch latest subscription based on email (assuming latest is the most recent one)
      const subscription = await Payment.findOne({ email }).sort({ created_at: -1 });
  
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }
  
      // Calculate Subscription Renewal Date
      const createdDate = new Date(subscription.created_at);
      const durationMapping = {
        "3-days": 3,
        "one-mo": 30,
        "three-mo": 90,
        "six-mo": 180,
        "year-mo": 365,
      };
      const subscriptionDuration = durationMapping[subscription.subscription_type] || 30;
      const renewalDate = new Date(createdDate);
      renewalDate.setDate(renewalDate.getDate() + subscriptionDuration);
  
      // Check Subscription Status
      const today = new Date();
      const status = today < renewalDate ? "ACTIVE" : "EXPIRED";
  
      res.json({
        renewal_date: renewalDate.toISOString().split("T")[0], // Format: YYYY-MM-DD
        status: status,unique_id:subscription.unique_id
      });
    } catch (error) {
      console.error("Error fetching subscription details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

module.exports = router;