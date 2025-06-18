const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const Support = require("../models/Support");
const User = require("../models/userModel");

const router = express.Router();

async function fetchSupportData(mobileNumber, savedPassword) {
  let browser;
  try {
    console.log("Starting expert information scraping...");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-features=FedCm",
      ],
    });

    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "userAgent", {
        get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      });
    });

    await page.goto("https://seller.indiamart.com", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForSelector("#mobNo", { visible: true });
    await page.type("#mobNo", mobileNumber);
    await page.click(".login_btn");

    await page.waitForSelector("#passwordbtn1", { visible: true });
    await page.click("#passwordbtn1");

    await page.waitForSelector("#usr_password", { visible: true });
    await page.type("#usr_password", savedPassword);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click("#signWP"),
    ]);

    await page.waitForSelector("#leftnav_dash_link", { timeout: 60000 });

    const expertBoxExists = await page.evaluate(() => {
      return !!document.querySelector("#expert_assistance_main_box");
    });

    if (!expertBoxExists) {
      return [];
    }

    const expertDetails = await page.evaluate(() => {
      const container = document.querySelector("#expert_assistance_main_box");
      if (!container) return [];

      const expertContainers = container.querySelectorAll(".avtar_cont");
      return Array.from(expertContainers).map((expert, index) => {
        try {
          const name =
            expert
              .querySelector("p.Dash_c10.SLC_f14.SLC_fwb")
              ?.innerText.trim() || null;
          const role =
            expert
              .querySelector("p.SLC_f14.Dash_c11.Dash_p2")
              ?.innerText.trim() || null;
          const phone =
            expert
              .querySelector(".SLC_dflx.SLC_aic .Dash_c12")
              ?.innerText.trim() || null;
          const email =
            expert.querySelector("a[href^='mailto:']")?.innerText.trim() ||
            null;
          const videoMeet =
            expert.querySelector("#req_meet")?.innerText.trim() || null;
          const photoUrl = expert.querySelector("img")?.src || null;

          return { name, role, phone, email, videoMeet, photoUrl };
        } catch (err) {
          return {
            name: `Expert ${index + 1}`,
            role: "Support Specialist",
            error: err.message,
          };
        }
      });
    });

    return expertDetails.length > 0
      ? expertDetails
      : [
          {
            name: "Support Team",
            role: "IndiaMART Assistance",
            phone: "1800-419-3288",
            email: "support@indiamart.com",
            videoMeet: "Available",
            photoUrl: null,
          },
        ];
  } catch (err) {
    console.error("Error in fetchSupportData:", err);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

router.get("/getSupport", async (req, res) => {
  try {
    const supportList = await Support.find().sort({ createdAt: -1 });
    res.status(200).json(supportList);
  } catch (error) {
    console.error("Error fetching support list:", error);
    res.status(500).json({ error: "Failed to retrieve support list" });
  }
});

async function fetchAndStoreSupportData() {
  try {
    const users = await User.find({
      mobileNumber: { $exists: true, $ne: null },
      savedPassword: { $exists: true, $ne: null },
    });

    console.log(
      `Scheduled Support data fetch starting for ${users.length} users`
    );

    await Support.deleteMany();

    for (const user of users) {
      try {
        const expertData = await fetchSupportData(
          user.mobileNumber,
          user.savedPassword
        );

        // Filter and map only required fields
        const supportEntries = expertData.map(({ name, email, phone }) => ({
          name,
          email,
          phoneNumber: phone,
        }));

        // Remove duplicates based on email (to avoid violating the unique constraint)
        const uniqueEntries = [];
        const seenEmails = new Set();

        for (const entry of supportEntries) {
          if (entry.email && !seenEmails.has(entry.email)) {
            seenEmails.add(entry.email);
            uniqueEntries.push(entry);
          }
        }

        // Save new support data
        await Support.insertMany(uniqueEntries);

        console.log(`Support data stored successfully for user ${user._id}`);
      } catch (err) {
        console.error(`Error for user ${user._id}:`, err.message);
      }
    }

    console.log("Support data fetch completed.");
  } catch (err) {
    console.error("Error in fetchAndStoreSupportData():", err.message);
  }
}

router.get("/test/support-fetch", async (req, res) => {
  try {
    await fetchAndStoreSupportData();
    res
      .status(200)
      .json({ message: "Support data fetched and stored successfully." });
  } catch (error) {
    console.error("Error testing fetchAndStoreSupportData:", error);
    res.status(500).json({ error: "Failed to fetch and store support data" });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const data = req.body;

    // Step 1: Prepare a set of unique identifiers (e.g., email + phoneNumber)
    const identifiers = data.map(item => ({
      email: item.email,
      phoneNumber: item.phoneNumber
    }));

    // Step 2: Query existing records that match any of the identifiers
    const existingRecords = await Support.find({
      $or: identifiers.map(({ email, phoneNumber }) => ({
        email,
        phoneNumber
      }))
    });

    // Step 3: Build a Set of existing combinations to filter duplicates
    const existingSet = new Set(
      existingRecords.map(rec => `${rec.email}-${rec.phoneNumber}`)
    );

    // Step 4: Filter out duplicates from input data
    const filtered = data
      .filter(item => {
        const key = `${item.email}-${item.phoneNumber}`;
        return !existingSet.has(key); // keep only new entries
      })
      .map((item, index) => ({
        name: item.name || "Unknown",
        email: item.email || `no-email-${Date.now()}-${index}@example.com`,
        phoneNumber: item.phoneNumber || ""
      }));

    if (filtered.length === 0) {
      return res.status(200).json({ message: "No new experts to insert", inserted: 0 });
    }

    // Step 5: Insert new entries
    const inserted = await Support.insertMany(filtered, {
      ordered: false,
      rawResult: true
    });

    // Final DB count
    const count = await Support.countDocuments();

    res.status(200).json({
      message: "Support experts processed.",
      inserted: inserted.insertedCount || filtered.length,
      total: count
    });

  } catch (err) {
    console.error("Detailed error:", err);
    res.status(500).json({
      message: "Failed to insert experts",
      error: err.message,
      details: err.writeErrors || err.errors
    });
  }
});

module.exports = router;
