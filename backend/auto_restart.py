import time, os, importlib
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import scraper
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from pyvirtualdisplay import Display
from selenium.webdriver.chrome.service import Service
from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys
# from webdriver_manager.chrome import ChromeDriverManager
import subprocess
import sys
import json
import signal
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import threading
import select
from datetime import datetime, timedelta
from selenium.common.exceptions import ElementClickInterceptedException, StaleElementReferenceException
import pytz
input_line = sys.stdin.readline()
input_data = json.loads(input_line.strip())
lead_count = int(input_data.get("leadCount", 0))
max_captures = int(input_data.get("maxCaptures", 0))

def main():
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
    #chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--disable-web-security")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--log-level=3")
    chrome_options.add_argument("--ignore-certificate-errors")
    #chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    # Set a realistic user-agent
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    chrome_options.add_argument(f"user-agent={user_agent}")

    # Start virtual display
    display = Display(visible=0, size=(1920, 1080))
    display.start()

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    unique_id = "123456"
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)

    # Start Selenium browser once
    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://www.python.org/")  # just an example site

    # Track last modification time of scraper.py
    last_mtime = os.path.getmtime("scraper.py")

    while True:
        try:
            # Check if scraper.py was modified
            new_mtime = os.path.getmtime("scraper.py")
            if new_mtime != last_mtime:
                importlib.reload(scraper)
                print("🔄 Reloaded scraper.py", flush=True)
                last_mtime = new_mtime

            # Run scraper function
            scraper.main(driver)

        except Exception as e:
            print("❌ Error:", e, flush=True)

        time.sleep(5)  # run every 5 seconds

if __name__ == "__main__":
    main()