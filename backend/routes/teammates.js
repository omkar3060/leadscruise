// routes/teammates.js
const express = require('express');
const router = express.Router();
const Teammate = require('../models/Teammate');

// GET all teammates
router.get('/', async (req, res) => {
  const { userEmail } = req.query;

  if (!userEmail) {
    return res.status(400).json({ error: "userEmail query param is required." });
  }

  try {
    const record = await Teammate.findOne({ userEmail });

    if (!record) {
      return res.status(200).json([]); // Return empty list if no teammates
    }

    const teammates = record.names.map((name, idx) => ({
      name,
      phone: record.phones[idx],
      status: record.statuses[idx],
    }));

    res.json(teammates);
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
        phones: [phone],
        statuses: ['remove'],
      });
    } else {
      // Append to arrays
      userRecord.names.push(name);
      userRecord.phones.push(phone);
      userRecord.statuses.push('remove');
    }

    await userRecord.save();
    res.status(200).json({ message: "Teammate added successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
