from selenium import webdriver
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
from pyvirtualdisplay import Display
import traceback
import sys
import json
def open_whatsapp(whatsapp_number):
    
    # Set environment variables for Firefox
    os.environ["MOZ_DISABLE_CONTENT_SANDBOX"] = "1"
    os.environ["MOZ_DBUS_REMOTE"] = "1"
    
    # Create a virtual display
    print("Starting virtual display...", flush=True)
    display = None
    driver = None
    
    try:
        # Set up virtual display - make sure it's completely invisible
        display = Display(visible=0, size=(1920, 1080), backend="xvfb")
        display.start()
        print("Virtual display started successfully!", flush=True)
        
        # Ensure profile directory exists and has proper permissions
        profile_dir = os.path.join(os.getcwd(), "firefox_profiles", f"whatsapp_{whatsapp_number}")
        os.makedirs(profile_dir, exist_ok=True)
        
        # Make sure profile directory has right permissions
        os.system(f"chmod -R 755 {profile_dir}")
        print(f"Using Firefox profile directory: {profile_dir}", flush=True)
        
        # Set up Firefox options with more verbose logging
        firefox_options = FirefoxOptions()
        firefox_options.add_argument("--width=1920")
        firefox_options.add_argument("--height=1080")
        firefox_options.add_argument("-profile")
        firefox_options.add_argument(profile_dir)
        firefox_options.add_argument("-headless")  # Run Firefox in headless mode
        
        # Disable features that might cause issues
        firefox_options.set_preference("dom.webnotifications.enabled", False)
        firefox_options.set_preference("media.volume_scale", "0.0")
        firefox_options.set_preference("browser.download.folderList", 2)
        firefox_options.set_preference("browser.download.manager.showWhenStarting", False)
        firefox_options.set_preference("browser.download.dir", os.getcwd())
        firefox_options.set_preference("browser.helperApps.neverAsk.saveToDisk", "application/octet-stream")
        firefox_options.set_preference("webdriver.log.level", "trace")  # Enable detailed logging
        
        # Add settings to prevent 504 errors
        firefox_options.set_preference("network.http.connection-timeout", 120)  # 2 minute connection timeout
        firefox_options.set_preference("network.http.request.timeout", 120)  # 2 minute request timeout
        firefox_options.set_preference("network.http.response.timeout", 120)  # 2 minute response timeout
        firefox_options.set_preference("dom.max_script_run_time", 0)  # Disable slow script warnings
        firefox_options.set_preference("dom.timeout.enable_budget_timer_throttling", False)  # Disable budget timer throttling
        
        # Check if geckodriver exists
        geckodriver_path = "/usr/local/bin/geckodriver"
        if not os.path.exists(geckodriver_path):
            print(f"Warning: geckodriver not found at {geckodriver_path}", flush=True)
            # Try to find geckodriver in PATH
            from shutil import which
            geckodriver_path = which("geckodriver")
            if geckodriver_path:
                print(f"Found geckodriver at {geckodriver_path}", flush=True)
            else:
                print("Error: geckodriver not found in PATH", flush=True)
                # Try to use geckodriver without full path
                geckodriver_path = "geckodriver"
        
        print(f"Using geckodriver at: {geckodriver_path}", flush=True)
        
        # Create Firefox driver with more robust error handling
        print("Starting Firefox...", flush=True)
        
        # Create a log file to capture Firefox output
        log_path = os.path.join(os.getcwd(), "geckodriver.log")
        service = FirefoxService(executable_path=geckodriver_path, log_path=log_path)
        
        # Start Firefox with extra debugging output
        print("Creating Firefox driver instance...", flush=True)
        driver = webdriver.Firefox(service=service, options=firefox_options)
        print("Firefox started successfully!", flush=True)
        
        # Set window size
        driver.set_window_size(1920, 1080)
        
        # Set page load timeout to prevent hanging
        driver.set_page_load_timeout(120)  # 2 minutes
        
        # Navigate to WhatsApp Web with error handling
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Navigating to WhatsApp Web (attempt {attempt+1}/{max_retries})...", flush=True)
                driver.get("https://web.whatsapp.com/")
                break
            except Exception as e:
                print(f"Error navigating to WhatsApp Web: {e}", flush=True)
                if attempt < max_retries - 1:
                    print("Retrying in 10 seconds...", flush=True)
                    time.sleep(10)
                else:
                    print("Failed to navigate to WhatsApp Web after retries", flush=True)
                    raise
        
        # Set up wait with generous timeout
        wait = WebDriverWait(driver, 120)  # 2 minutes timeout
        
        print("Checking WhatsApp Web login status...", flush=True)
        
        # Check for login status (either QR code or chats)
        try:
            # First try to check if already logged in
            print("Checking if already logged in...", flush=True)
            WebDriverWait(driver, 120).until(
                EC.any_of(
                    EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]")),
                    EC.presence_of_element_located((By.XPATH, "//*[@aria-label='WhatsApp' and @data-icon='wa-wordmark-refreshed']"))
                )
            )
            print("Already logged in! Chats found.", flush=True)
            print("success", flush=True)
            sys.exit(0)
        except Exception as e:
            print(f"Error checking login status: {e}", flush=True)
            sys.exit(1)
    
    except Exception as e:
        print(f"Error starting Firefox or virtual display: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        if display:
            display.stop()
        if driver:
            driver.quit()
        return
    
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whatsapp.py whatsappNumber messagesJson receiverNumber",flush=True)
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = sys.argv[1]
    
    print(f"Starting WhatsApp automation with:",flush=True)
    print(f"WhatsApp Number: {whatsapp_number}", flush=True)
    
    # Start the WhatsApp automation
    open_whatsapp(whatsapp_number)
    