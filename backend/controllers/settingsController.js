const Settings = require("../models/Settings");

// ✅ Save or Update User Settings
const saveSettings = async (req, res) => {
  try {
    const { userEmail, sentences, wordArray, h2WordArray } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required." });
    }

    const existingSettings = await Settings.findOne({ userEmail });

    if (existingSettings) {
      // Update existing settings
      existingSettings.sentences = sentences;
      existingSettings.wordArray = wordArray;
      existingSettings.h2WordArray = h2WordArray;
      await existingSettings.save();
      return res.json({ message: "Settings updated successfully." });
    }

    // Create new settings
    const newSettings = new Settings({ userEmail, sentences, wordArray, h2WordArray });
    await newSettings.save();
    res.json({ message: "Settings saved successfully." });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Fetch User Settings
const getSettings = async (req, res) => {
  try {
    const { userEmail } = req.params;

    const settings = await Settings.findOne({ userEmail });

    if (!settings) {
      return res.json({
        message: "No settings found.",
        settings: { sentences: [], wordArray: [], h2WordArray: [] },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Delete User Settings (Revert All)
const deleteSettings = async (req, res) => {
  try {
    const { userEmail } = req.params;

    const deletedSettings = await Settings.findOneAndDelete({ userEmail });

    if (!deletedSettings) {
      return res.status(404).json({ message: "No settings found to delete." });
    }

    res.json({ message: "Settings reverted successfully." });
  } catch (error) {
    console.error("Error deleting settings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { saveSettings, getSettings, deleteSettings };
