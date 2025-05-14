const puppeteer = require('puppeteer');
const express = require('express');
const router = express.Router();

async function fetchIndiaMartData(mobileNumber, password) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const wait = selector => page.waitForSelector(selector, { visible: true, timeout: 60000 });

  try {
    // 1. Go to login page
    await page.goto("https://seller.indiamart.com", { waitUntil: "networkidle2" });

    // 2. Enter mobile & click "Start Selling"
    await wait("#mobNo");
    await page.type("#mobNo", mobileNumber);
    await page.click(".login_btn");

    // 3. Click "Enter Password"
    await wait("#passwordbtn1");
    await page.click("#passwordbtn1");

    // 4. Enter password & Sign In
    await wait("#usr_password");
    await page.type("#usr_password", password);
    await page.click("#signWP");

    // 5. Wait for Dashboard
    await page.waitForSelector("#leftnav_dash_link", { timeout: 60000 });

    // 6. Navigate to Analytics
    await page.goto("https://seller.indiamart.com/reportnew/home", { waitUntil: "networkidle2" });
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    await page.evaluate(() => {
      document.body.style.zoom = '100%';
    });

    // 7. Wait for the Weekly/Monthly buttons to be visible
    await wait(".Enquiries_header__E1H3e button");

    // 8. Get weekly chart (default)
    await page.click("#Week");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const weeklyCanvas = await page.waitForSelector("canvas[role='img']", { visible: true, timeout: 60000 });
    const weeklyDataUrl = await page.evaluate(c => c.toDataURL("image/png"), weeklyCanvas);

    // 9. Get monthly chart
    await page.click("#Month");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const monthlyCanvas = await page.waitForSelector("canvas[role='img']", { visible: true, timeout: 60000 });
    const monthlyDataUrl = await page.evaluate(c => c.toDataURL("image/png"), monthlyCanvas);

    // 10. NEW: Scrape the table data
    let locationData = [];
    let categoryData = [];

    // First check if table data exists
    const tablesExist = await page.evaluate(() => {
      return document.querySelector('#Enquiries_reportTableCSS__38-9b') !== null;
    });

    if (tablesExist) {
      // Get location data - could be the default view or need to click a tab
      try {
        // Switch to locations tab if needed
        const locationsTabSelector = "#locations";
        const locationsTabExists = await page.evaluate((selector) => {
          return document.querySelector(selector) !== null;
        }, locationsTabSelector);

        if (locationsTabExists) {
          await page.click(locationsTabSelector);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Extract location data
        locationData = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('#Enquiries_reportTableCSS__38-9b tbody tr'));
          return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            return {
              location: cells[0]?.textContent?.trim() || '',
              leadsConsumed: parseInt(cells[1]?.textContent?.trim() || '0'),
              enquiries: parseInt(cells[2]?.textContent?.trim() || '0'),
              calls: parseInt(cells[3]?.textContent?.trim() || '0')
            };
          });
        });

        // Switch to categories tab if it exists
        const categoriesTabSelector = "#categories";
        const categoriesTabExists = await page.evaluate((selector) => {
          return document.querySelector(selector) !== null;
        }, categoriesTabSelector);

        if (categoriesTabExists) {
          await page.click(categoriesTabSelector);
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Extract category data (assuming similar structure)
          categoryData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#Enquiries_reportTableCSS__38-9b tbody tr'));
            return rows.map(row => {
              const cells = Array.from(row.querySelectorAll('td'));
              return {
                category: cells[0]?.textContent?.trim() || '',
                leadsConsumed: parseInt(cells[1]?.textContent?.trim() || '0'),
                enquiries: parseInt(cells[2]?.textContent?.trim() || '0'),
                calls: parseInt(cells[3]?.textContent?.trim() || '0')
              };
            });
          });
        }
      } catch (tableError) {
        console.error("Error scraping table data:", tableError);
        // Continue even if table scraping fails
      }
    }

    await browser.close();

    return {
      charts: {
        weekly: weeklyDataUrl.split(",")[1],  // Strip prefix and return raw base64
        monthly: monthlyDataUrl.split(",")[1] // Strip prefix and return raw base64
      },
      tables: {
        locations: locationData,
        categories: categoryData
      }
    };

  } catch (error) {
    await browser.close();
    throw error;
  }
}

router.get("/charts", async (req, res) => {
  const { mobileNumber, password } = req.query;

  if (!mobileNumber || !password) {
    return res.status(400).json({ success: false, error: "mobileNumber & password are required" });
  }

  try {
    const data = await fetchIndiaMartData(mobileNumber, password);
    res.json({
      success: true,
      charts: data.charts,
      tables: data.tables
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ success: false, error: `Failed to fetch data: ${err.message}` });
  }
});

// Keep the old endpoint for backward compatibility
router.get("/chart", async (req, res) => {
  const { mobileNumber, password, period = 'weekly' } = req.query;

  if (!mobileNumber || !password) {
    return res.status(400).json({ success: false, error: "mobileNumber & password are required" });
  }

  try {
    const charts = await fetchIndiaMartCharts(mobileNumber, password);
    res.json({
      success: true,
      chart: charts[period]
    });
  } catch (err) {
    console.error(`Analytics error (${period}):`, err);
    res.status(500).json({ success: false, error: `Failed to fetch ${period} chart: ${err.message}` });
  }
});

module.exports = router;