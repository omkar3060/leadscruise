const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referrals");

// Create a new referral (Protected Route)
router.post("/", referralController.createReferral);

// Get all referrals (Protected Route)
router.get("/", referralController.getAllReferrals);

// Get single referral by ID (Protected Route)
router.get("/:id", referralController.getReferralById);

// Update referral (Protected Route)
router.put("/:id", referralController.updateReferral);

// Delete/Deactivate referral (Protected Route)
router.delete("/:id", referralController.deleteReferral);

// Bulk update referrals (Protected Route)
router.patch("/bulk", referralController.bulkUpdateReferrals);

// Search referrals (Protected Route)
router.get("/search", referralController.searchReferrals);
router.get("/check-referral/:id", referralController.checkReferral);

module.exports = router;
