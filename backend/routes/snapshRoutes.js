const express = require("express");
const router = express.Router();
const statusController = require("../controllers/statusController");
const UserStatusSnapshot = require("../models/UserStatusSnapshot");
// Existing routes...

// Add new route for getting snapshot status
router.post(
  "/take-snapshot",
  statusController.takeStatusSnapshot,
);
router.post("/restart-running", statusController.restartRunningScripts);

router.get("/maintenance-status", async (req, res) => {
  try {
    const count = await UserStatusSnapshot.countDocuments();
    res.json({ maintenanceOngoing: count > 0 });
  } catch (err) {
    console.error("Error checking maintenance status:", err);
    res.status(500).json({ maintenanceOngoing: false });
  }
});

module.exports = router;
