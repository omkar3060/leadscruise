const express = require("express");
const router = express.Router();
const { saveSettings, getSettings, deleteSettings, updateMinOrder, getMinOrder, updateLeadTypes, getLeadTypes } = require("../controllers/settingsController");
const Settings = require("../models/Settings");
router.post("/save-settings", saveSettings);
router.get("/get-settings/:userEmail", getSettings);
router.delete("/delete-settings/:userEmail", deleteSettings);
router.post("/update-min-order", updateMinOrder);
router.get("/get-min-order", getMinOrder);
router.post("/update-lead-types", updateLeadTypes);
router.get("/get-lead-types", getLeadTypes);
router.post('/settings/toggle-rejected-lead', async (req, res) => {
  try {
    const { leadProduct, action, userEmail } = req.body;
    
    if (!leadProduct || !action || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let updateQuery;
    if (action === 'add') {
      updateQuery = { $addToSet: { h2WordArray: leadProduct } };
    } else if (action === 'remove') {
      updateQuery = { $pull: { h2WordArray: leadProduct } };
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const updatedSettings = await Settings.findOneAndUpdate(
      { userEmail: userEmail },
      updateQuery,
      { new: true, upsert: true }
    );
    
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating rejected leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// If you need to fetch the current h2WordArray for the logged-in user
router.get('/settings/rejected-leads', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const settings = await Settings.findOne({ userEmail: userEmail });
    res.json({ h2WordArray: settings?.h2WordArray || [] });
  } catch (error) {
    console.error('Error fetching rejected leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
