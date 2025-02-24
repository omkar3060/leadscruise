const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, deleteSettings } = require("../controllers/settingsController");

// ✅ Routes
router.post("/save-settings", saveSettings);
router.get("/get-settings/:userEmail", getSettings);
router.delete("/delete-settings/:userEmail", deleteSettings);

module.exports = router;