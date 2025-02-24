const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingDetailsController");

// Route: Update Billing Details
router.post("/update", billingController.updateBillingDetails);

// Route: Get Billing Details by Email
router.get("/:email", billingController.getBillingDetails);

module.exports = router;