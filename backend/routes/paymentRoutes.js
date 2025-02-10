const express = require("express");
const router = express.Router();
const { latestId, getPaymentsByEmail } = require('../controllers/paymentController');
router.get("/get-latest-id", latestId);
router.get("/payments", getPaymentsByEmail);
module.exports = router;