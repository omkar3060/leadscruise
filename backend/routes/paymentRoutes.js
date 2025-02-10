const express = require("express");
const router = express.Router();
const { latestId, getPaymentsByEmail,getAllSubscriptions } = require('../controllers/paymentController');
router.get("/get-latest-id", latestId);
router.get("/payments", getPaymentsByEmail);
router.get("/get-all-subscriptions", getAllSubscriptions);
module.exports = router;