const express = require("express");
const router = express.Router();
const statusController = require("../controllers/statusController");

// Existing routes...

// Add new route for getting snapshot status
router.post(
  "/take-snapshot",
  statusController.takeStatusSnapshot,
);
router.post("/restart-running", statusController.restartRunningScripts);

module.exports = router;
