const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, deleteSettings, updateMinOrder, getMinOrder } = require("../controllers/settingsController");

router.post("/save-settings", saveSettings);
router.get("/get-settings/:userEmail", getSettings);
router.delete("/delete-settings/:userEmail", deleteSettings);
router.post("/update-min-order", updateMinOrder);
router.get("/get-min-order", getMinOrder);


module.exports = router;
