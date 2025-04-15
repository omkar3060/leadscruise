// controllers/statusController.js
const User = require("../models/userModel");
const UserStatusSnapshot = require("../models/UserStatusSnapshot");
const cron = require("node-cron");
const Settings = require('../models/Settings'); 
// Function to take a snapshot of all users' status at midnight
const takeStatusSnapshot = async (req, res) => {
  try {
    console.log("Taking status snapshot ...");

    // Get all users with their current status
    const users = await User.find({}, "email status");

    // For each user, update or insert the snapshot
    await Promise.all(
      users.map(async (user) => {
        await UserStatusSnapshot.updateOne(
          { userEmail: user.email }, // Find by email
          { $set: { status: user.status } }, // Update the status
          { upsert: true } // Insert if not present
        );
      })
    );

    console.log(`Status snapshots updated for ${users.length} users`);
    res.status(200).json({ message: `Status snapshots updated for ${users.length} users` });
  } catch (error) {
    console.error("Error taking status snapshots:", error);
    res.status(500).json({ message: "Failed to take snapshots", error: error.message }); // ✅ Send error response
  }
};

// Function to restore original status from snapshot at 5 AM and clear snapshots
const restoreStatusFromSnapshot = async () => {
  try {
    console.log("Restoring user statuses from snapshots at 5 AM...");

    // Find all snapshots (assuming snapshots were only created at midnight)
    const snapshots = await UserStatusSnapshot.find({});

    // Update each user with their snapshot status
    const updatePromises = snapshots.map((snapshot) => {
      return User.findOneAndUpdate(
        { email: snapshot.userEmail },
        { status: snapshot.status },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    console.log(`Restored status for ${updatePromises.length} users`);

    // After restoration, clear all snapshots from the database
    await UserStatusSnapshot.deleteMany({});

    console.log("All snapshots have been cleared from the database");
  } catch (error) {
    console.error(
      "Error restoring user statuses or cleaning up snapshots:",
      error
    );
  }
};

// Set up cron jobs for snapshot and restore
const setupScheduledTasks = () => {
  // Take snapshot at midnight (0 0 * * *)
  cron.schedule("0 0 * * *", takeStatusSnapshot);

  // Restore status at 5 AM (0 5 * * *)
  cron.schedule("0 5 * * *", restoreStatusFromSnapshot);

  console.log("Scheduled tasks for snapshot management have been set up");
};

// API endpoint to get snapshot status
const getSnapshotStatus = async (req, res) => {
  try {
    const { userEmail } = req.params;

    // Find the most recent snapshot for this user
    const snapshot = await UserStatusSnapshot.findOne(
      { userEmail },
      {},
      { sort: { snapshotDate: -1 } }
    );

    if (!snapshot) {
      return res
        .status(404)
        .json({ message: "No snapshot found for this user" });
    }

    return res.status(200).json({
      status: snapshot.status,
      snapshotDate: snapshot.snapshotDate,
    });
  } catch (error) {
    console.error("Error fetching snapshot status:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const restartRunningScripts = async (req, res) => {
  try {
    const snapshotUsers = await UserStatusSnapshot.find({ status: "Running" });

    for (const snap of snapshotUsers) {
      const user = await User.findOne({ email: snap.userEmail });
      const latestPayment = await Payment.findOne({ email: snap.userEmail }).sort({ created_at: -1 });
      const settings = await Settings.findOne({ userEmail: user.email });

      if (
        !settings ||
        (!settings.sentences?.length && !settings.wordArray?.length && !settings.h2WordArray?.length)
      ) {
        console.log(`Skipping ${user.email}: No valid settings found.`);
        continue;
      }

      if (!user.mobileNumber || !user.savedPassword) {
        console.log(`Skipping ${user.email}: Missing credentials.`);
        continue;
      }

      if (!user || !latestPayment?.unique_id) continue;

      const bodyPayload = {
        sentences: settings.sentences,
        wordArray: settings.wordArray,
        h2WordArray: settings.h2WordArray,
        mobileNumber: user.mobileNumber,
        password: user.savedPassword,
        userEmail: user.email,
        uniqueId: latestUniqueId,
        uniqueId: latestPayment.unique_id,
      };

      await fetch("https://api.leadscruise.com/api/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      await User.updateOne({ email: snap.userEmail }, { $set: { status: snap.status } });
    }

    await UserStatusSnapshot.deleteMany({});

    res.json({ message: "Restarted scripts for all previously running users." });
  } catch (err) {
    console.error("Restart failed:", err);
    res.status(500).json({ message: "Failed to restart scripts." });
  }
};

module.exports = {
  setupScheduledTasks,
  takeStatusSnapshot,
  restoreStatusFromSnapshot,
  getSnapshotStatus,
  restartRunningScripts,
};
