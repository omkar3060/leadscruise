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

const updateMinOrder= async (req, res) => {
  try {
    const { userEmail, minOrder } = req.body;

    if(minOrder < 0) {
      return res.status(400).json({ message: "Minimum order value cannot be negative" });
    }

    if (!userEmail || typeof minOrder !== "number") {
      return res.status(400).json({ message: "Invalid input" });
    }

    const updated = await Settings.findOneAndUpdate(
      { userEmail },
      { minOrder },
      { new: true, upsert: true }
    );

    return res.status(200).json({ message: "Minimum order value updated successfully", data: updated });
  } catch (error) {
    console.error("Error updating min order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getMinOrder = async (req, res) => {
  try {
    const { userEmail } = req.query;

    if (!userEmail) {
      return res.status(400).json({ message: "Missing userEmail" });
    }

    const userSettings = await Settings.findOne({ userEmail });

    if (!userSettings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    res.status(200).json({
      minOrder: userSettings.minOrder,
      lastUpdatedMinOrder: userSettings.lastUpdatedMinOrder,
    });
  } catch (error) {
    console.error("Error fetching min order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateLeadTypes= async (req, res) => {
  try {
    const { userEmail, leadTypes } = req.body;

    if (!userEmail || !Array.isArray(leadTypes)) {
      return res.status(400).json({ message: "Missing or invalid fields" });
    }
    const updated = await Settings.findOneAndUpdate(
      { userEmail },
      { leadTypes },
      { new: true, upsert: true }
    );

    res.json({ message: "Lead types updated successfully", data: updated });
  } catch (error) {
    console.error("Error updating lead types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getLeadTypes = async (req, res) => {
  try {
    const { userEmail } = req.query;

    if (!userEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const settings = await Settings.findOne({ userEmail });

    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    res.json({ leadTypes: settings.leadTypes || [] });
  } catch (error) {
    console.error("Error fetching lead types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { saveSettings, getSettings, deleteSettings, updateMinOrder, getMinOrder, updateLeadTypes, getLeadTypes };
