// routes/teammates.js
const express = require('express');
const router = express.Router();
const Teammate = require('../models/Teammate');

// GET all teammates
router.get('/', async (req, res) => {
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });

  try {
    const user = await Teammate.findOne({ userEmail });
    if (!user) {
      return res.json({ names: [], phones: [] }); // Default empty structure
    }
    res.json({
      names: user.names || [],
      phones: user.phones || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add teammate for userEmail
router.post('/', async (req, res) => {
  const { name, phone, userEmail } = req.body;

  if (!name || !phone || !userEmail) {
    return res.status(400).json({ error: "Name, phone, and userEmail required." });
  }

  try {
    let userRecord = await Teammate.findOne({ userEmail });

    if (!userRecord) {
      // Create new document
      userRecord = new Teammate({
        userEmail,
        names: [name],
        phones: [phone]
      });
    } else {
      // Append to arrays
      userRecord.names.push(name);
      userRecord.phones.push(phone);
    }

    await userRecord.save();
    res.status(200).json({ message: "Teammate added successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  const { userEmail, index } = req.body;

  if (!userEmail || index === undefined) {
    return res.status(400).json({ error: "userEmail and index are required." });
  }

  try {
    const user = await Teammate.findOne({ userEmail });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (index < 0 || index >= user.names.length) {
      return res.status(400).json({ error: "Invalid teammate index." });
    }

    user.names.splice(index, 1);
    user.phones.splice(index, 1);
    await user.save();

    res.status(200).json({ message: "Teammate removed successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
