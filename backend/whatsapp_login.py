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
import shutil

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
        
        # Check if profile directory exists and delete it if it does
        profile_dir = os.path.join(os.getcwd(), "firefox_profiles", f"whatsapp_{whatsapp_number}")
        if os.path.exists(profile_dir):
            print(f"Found existing profile directory at {profile_dir}. Deleting it...", flush=True)
            try:
                shutil.rmtree(profile_dir)
                print(f"Successfully deleted profile directory: {profile_dir}", flush=True)
            except Exception as e:
                print(f"Error deleting profile directory: {e}", flush=True)
                print(traceback.format_exc(), flush=True)
        
        # Create a fresh profile directory
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
        
        print("Proceeding with login flow...", flush=True)
        
        try:
            print("Taking a screenshot of current page state...", flush=True)
            # driver.save_screenshot("whatsapp_login_state.png")
            
            print("Looking for login button...", flush=True)
            login_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
            )
            # Handle phone number login flow
            verification_code = login_and_extract_code(driver, wait, whatsapp_number)
            print(f"Phone number login completed. Verification code: {verification_code}", flush=True)
            return 0
        except Exception as login_error:
            print(f"Error during login process: {login_error}", flush=True)
            print(traceback.format_exc(), flush=True)
            # Take a screenshot to diagnose the issue
            try:
                # driver.save_screenshot("login_error.png")
                print("Screenshot saved as login_error.png", flush=True)
            except:
                print("Failed to save screenshot", flush=True)
        
        # Wait a moment before cleanup
        time.sleep(5)
        
    except Exception as e:
        print(f"Error in WhatsApp automation: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        
    finally:
        # Always run cleanup code
        print("Running cleanup...", flush=True)
        return 0

def login_and_extract_code(driver, wait, phone_number):
    try:
        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
        )
        login_button.click()
        print("Clicked on 'Log in with phone number'.", flush=True)
        
        # Take a screenshot after clicking login button
        # driver.save_screenshot("after_login_click.png")
        print("Screenshot saved as after_login_click.png", flush=True)
        
        # Wait longer for country selector to appear
        time.sleep(5)
        
        country_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[@style='width: 100%;']"))
        )
        country_button.click()
        print("Clicked on country selection button.", flush=True)
        
        # Take a screenshot after clicking country button
        # driver.save_screenshot("after_country_click.png")
        print("Screenshot saved as after_country_click.png", flush=True)

        # Wait longer for search field to appear
        time.sleep(3)
        
        # Try multiple possible XPaths for the search input
        search_input = None
        search_xpath_options = [
            "//div[@contenteditable='true' and @role='textbox']",
            "//input[@placeholder='Search country code']",
            "//div[@contenteditable='true']"
        ]
        
        for xpath in search_xpath_options:
            try:
                search_input = wait.until(
                    EC.element_to_be_clickable((By.XPATH, xpath))
                )
                print(f"Found search input using xpath: {xpath}", flush=True)
                break
            except:
                print(f"Could not find search input with xpath: {xpath}", flush=True)
        
        if not search_input:
            print("Could not find search input field. Taking screenshot...", flush=True)
            # driver.save_screenshot("search_input_missing.png")
            raise Exception("Search input field not found")
        
        search_input.send_keys("India")
        print("Entered 'India' into the search field.", flush=True)
        time.sleep(3)  # Give the dropdown more time to update
        
        # Take a screenshot to see the dropdown
        # driver.save_screenshot("country_dropdown.png")
        print("Screenshot saved as country_dropdown.png", flush=True)

        # Try multiple ways to select India
        india_selectors = [
            "//img[@alt='🇮🇳']",  # Flag emoji
            "//span[contains(text(), 'India')]",  # Text containing India
            "//span[text()='India']",  # Exact text match
            "//div[contains(@class, 'country-item') and contains(., 'India')]",  # Country item containing India
            "//li[contains(., 'India')]"  # List item containing India
        ]
        
        india_selected = False
        for selector in india_selectors:
            try:
                india_element = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                india_element.click()
                india_selected = True
                print(f"Selected 'India' using selector: {selector}", flush=True)
                break
            except Exception as e:
                print(f"Failed to select India with selector {selector}: {e}", flush=True)
        
        if not india_selected:
            # Fallback to directly sending +91 if country selection fails
            print("Could not select India. Taking screenshot and trying direct approach...", flush=True)
            # driver.save_screenshot("india_selection_failed.png")
            
            # Return to the previous screen
            try:
                back_button = driver.find_element(By.XPATH, "//button[@aria-label='Back']")
                back_button.click()
                print("Clicked back button to return to phone input", flush=True)
                time.sleep(2)
            except Exception as back_error:
                print(f"Unable to click back button: {back_error}", flush=True)
                # Try to continue without clicking back
        
        # Try to find the phone input field
        phone_input = None
        phone_input_selectors = [
            "//input[@aria-label='Type your phone number.']",
            "//input[@placeholder='Phone number']",
            "//input[@type='tel']"
        ]
        
        for selector in phone_input_selectors:
            try:
                phone_input = wait.until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found phone input using selector: {selector}", flush=True)
                break
            except:
                print(f"Could not find phone input with selector: {selector}", flush=True)
        
        if not phone_input:
            print("Could not find phone input field. Taking screenshot...", flush=True)
            # driver.save_screenshot("phone_input_missing.png")
            raise Exception("Phone input field not found")
        
        # Clear any existing input and add the phone number
        # If India was not selected, prepend +91
        phone_input.clear()
        if not india_selected and not phone_number.startswith("+91"):
            phone_input.send_keys("+91" + phone_number)
            print(f"Entered phone number with country code: +91{phone_number}", flush=True)
        else:
            phone_input.send_keys(phone_number)
            print(f"Entered phone number: {phone_number}", flush=True)

        # Take screenshot before clicking Next
        # driver.save_screenshot("before_next_click.png")
        print("Screenshot saved as before_next_click.png", flush=True)

        # Try different ways to find the Next button
        next_button = None
        next_button_selectors = [
            "//div[contains(text(), 'Next')]",
            "//button[contains(text(), 'Next')]",
            "//span[contains(text(), 'Next')]/parent::*"
        ]
        
        for selector in next_button_selectors:
            try:
                next_button = wait.until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found Next button using selector: {selector}", flush=True)
                break
            except:
                print(f"Could not find Next button with selector: {selector}", flush=True)
        
        if not next_button:
            print("Could not find Next button. Taking screenshot...", flush=True)
            # driver.save_screenshot("next_button_missing.png")
            raise Exception("Next button not found")
        
        next_button.click()
        print("Clicked on 'Next' button.", flush=True)

        # Wait for the code to appear
        time.sleep(5)
        # driver.save_screenshot("after_next_click.png")
        print("Screenshot saved as after_next_click.png", flush=True)

        # Try multiple selectors for verification code
        code_selectors = [
            "//span[contains(@class, 'xzwifym')]",
            "//div[contains(@class, 'verification-code')]/span",
            "//div[contains(text(), 'code')]/following-sibling::div//span"
        ]
        
        code = None
        for selector in code_selectors:
            try:
                code_elements = wait.until(
                    EC.presence_of_all_elements_located((By.XPATH, selector))
                )
                code = "".join([elem.text for elem in code_elements if elem.text.strip()])
                if code:
                    print(f"Found verification code using selector: {selector}", flush=True)
                    break
            except:
                print(f"Could not extract code with selector: {selector}", flush=True)
        
        if code:
            print(f"WHATSAPP_VERIFICATION_CODE:{code}", flush=True)
        else:
            print("Unable to extract verification code. Taking screenshot...", flush=True)
            # driver.save_screenshot("verification_code_missing.png")
        
        # Wait for "Chats" heading to appear before proceeding (longer timeout)
        print("Waiting for 'Chats' to appear after login...", flush=True)
        try:
            WebDriverWait(driver, 600).until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
            )
            print("Login successful! Chats found.", flush=True)
        except Exception as e:
            print(f"Error waiting for Chats: {e}", flush=True)
            print("Taking screenshot of current state...", flush=True)
            # driver.save_screenshot("waiting_for_chats.png")
        
        return code

    except Exception as e:
        print(f"Error during login process: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        # Take a screenshot to help diagnose
        try:
            # driver.save_screenshot("login_process_error.png")
            print("Screenshot saved as login_process_error.png", flush=True)
        except:
            print("Failed to save screenshot", flush=True)
        return None

if __name__ == "__main__":
    # Main function to run the WhatsApp automation
    if len(sys.argv) < 1:
        print("Usage: python whatsapp.py whatsappNumber messagesJson receiverNumber",flush=True)
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = sys.argv[1]
        # Start the WhatsApp automation
    open_whatsapp(whatsapp_number)