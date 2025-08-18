import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import threading
import select
import signal
import os
import subprocess
from pyvirtualdisplay import Display

def execute_task_one(mobile_number):
    """
    Automates the sign-in process on the IndiaMART seller platform using the provided mobile number.
    """
    
    print(f"Starting automation for mobile number: {mobile_number}", flush=True)
    
    # Set up the browser in headless mode
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

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    chrome_options.add_argument(f"user-agent={user_agent}")

    # Start virtual display
    display = Display(visible=0, size=(1920, 1080))
    display.start()

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    unique_id = "100000"
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)
    
    driver = webdriver.Chrome(options=chrome_options)
    print("Chrome browser initialized", flush=True)
    
    try:
        # print("Navigating to IndiaMART seller platform", flush=True)
        driver.get("https://seller.indiamart.com/")
        
        # Refresh the page first
        print("Refreshing page", flush=True)
        driver.refresh()
        time.sleep(3)
        driver.refresh()
        time.sleep(3)
        
        # Wait for the input field to be present
        print("Waiting for mobile number input field", flush=True)
        wait = WebDriverWait(driver, 10)
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))

        # Enter the mobile number provided as an argument
        print("Entering mobile number", flush=True)
        input_field.clear()
        input_field.send_keys(mobile_number)

        # Wait for the "Start Selling" button to be clickable and click it
        print("Clicking Start Selling button", flush=True)
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()

        otp_fields_visible = driver.find_elements(By.CSS_SELECTOR, "input.mobbox1.f1.border_black1")
        visible_otp_fields = [el for el in otp_fields_visible if el.is_displayed()]
        if len(visible_otp_fields) >= 4:
            print("OTP fields visible -> returning 1", flush=True)
            sys.exit(1)

        # Otherwise, check if request button exists
        try:
            otp_request_button = wait.until(EC.element_to_be_clickable((By.ID, "reqOtpMobBtn")))
            if otp_request_button.is_displayed():
                print("Request OTP button present -> returning 0", flush=True)
                sys.exit(0)
        except TimeoutException:
            print("No OTP button found, returning 2", flush=True)
            sys.exit(2)

    finally:
        driver.quit()

# Main block to handle command-line arguments
if __name__ == "__main__":
    if len(sys.argv) > 2:
        print("Usage: python selenium_script.py <mobileNumber>", flush=True)
        sys.exit(3)

    mobile_number = sys.argv[1]
    print(f"Arguments received - Mobile: {mobile_number}", flush=True)

    exit_code = execute_task_one(mobile_number)
    print(f"Script completed with exit code: {exit_code}", flush=True)
    sys.exit(exit_code)