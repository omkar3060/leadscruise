import os
import re
import sys
import time
import pickle
import shutil
import logging
import traceback
import json
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.common.action_chains import ActionChains
from pyvirtualdisplay import Display

# Configuration Section
HEADLESS_MODE = True
VIRTUAL_DISPLAY_SIZE = (1920, 1080)
WHATSAPP_URL = "https://web.whatsapp.com/"
GECKODRIVER_PATHS = [
    "/usr/local/bin/geckodriver",
    "/usr/bin/geckodriver",
    os.path.expanduser("~/bin/geckodriver"),
    os.path.expanduser("~/Downloads/geckodriver")
]
SCREENSHOT_DIR = "screenshots"
CONTACTS_JSON_FILE = "api_response.json"
FEEDBACK_JSON_FILE = "feedback.json"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('whatsapp_automation.log')
    ]
)
logger = logging.getLogger(__name__)

def ensure_directory_exists(path):
    """Ensure a directory exists, create if it doesn't"""
    os.makedirs(path, exist_ok=True)
    return path

def sanitize_phone_number(phone_number):
    """Sanitize phone number to use as directory name"""
    return re.sub(r'[^a-zA-Z0-9]', '', str(phone_number))

def get_user_directory(phone_number):
    """Get the directory path for a specific user based on phone number"""
    sanitized_number = sanitize_phone_number(phone_number)
    user_dir = os.path.join(os.getcwd(), "whatsapp_users", sanitized_number)
    return ensure_directory_exists(user_dir)

def get_cookies_file_path(phone_number):
    """Get the cookies file path for a specific user"""
    user_dir = get_user_directory(phone_number)
    return os.path.join(user_dir, "cookies.pkl")

def get_profile_directory(phone_number):
    """Get the Firefox profile directory for a specific user"""
    user_dir = get_user_directory(phone_number)
    profile_dir = os.path.join(user_dir, "firefox_profile")
    return ensure_directory_exists(profile_dir)

def chmod_recursive(path):
    """Recursively set permissions for a directory and its contents"""
    for root, dirs, files in os.walk(path):
        for d in dirs:
            os.chmod(os.path.join(root, d), 0o755)
        for f in files:
            os.chmod(os.path.join(root, f), 0o755)
    os.chmod(path, 0o755)

def find_geckodriver():
    """Find geckodriver in common locations or PATH"""
    from shutil import which
    
    # Check if geckodriver is in PATH
    path_geckodriver = which("geckodriver")
    if path_geckodriver:
        return path_geckodriver
    
    # Check common paths
    for path in GECKODRIVER_PATHS:
        if os.path.exists(path):
            return path
    
    return None

def load_contacts_from_json():
    """Load contacts and messages from JSON file"""
    try:
        if not os.path.exists(CONTACTS_JSON_FILE):
            logger.error(f"Contacts JSON file not found: {CONTACTS_JSON_FILE}")
            return None

        # ✅ Force UTF-8 decoding to avoid 'charmap' errors
        with open(CONTACTS_JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        contacts = data.get("leads", [])
        if not contacts:
            logger.warning("No contacts found in JSON file")
            return None

        logger.info(f"Loaded {len(contacts)} contacts from JSON file")
        return contacts
    except Exception as e:
        logger.error(f"Error loading contacts from JSON: {e}")
        logger.debug(traceback.format_exc())
        return None

def load_feedback_from_json():
    """Load feedback data from JSON file"""
    try:
        if not os.path.exists(FEEDBACK_JSON_FILE):
            logger.info(f"Feedback JSON file not found: {FEEDBACK_JSON_FILE}. This might be the first run.")
            return []
        
        with open(FEEDBACK_JSON_FILE, 'r') as f:
            data = json.load(f)
        
        # Handle both old and new format
        if isinstance(data, list) and len(data) > 0:
            # New format: list with one entry
            feedback_entry = data[0]
            # Extract the timestamp for comparison
            if feedback_entry.get("timestamp"):
                return [{"createdAt": feedback_entry["timestamp"]}]
        elif isinstance(data, dict) and "feedback Sheet" in data:
            # Old format: dictionary with "feedback Sheet" key
            feedback_list = data.get("feedback Sheet", [])
            return feedback_list
        
        logger.info("No valid feedback data found")
        return []
    except Exception as e:
        logger.error(f"Error loading feedback from JSON: {e}")
        logger.debug(traceback.format_exc())
        return []

def save_feedback_json(feedback_entry):
    """Save feedback data to JSON file in the new format"""
    try:
        # Create a list containing the feedback entry
        feedback_data = [feedback_entry]
        
        with open(FEEDBACK_JSON_FILE, 'w') as f:
            json.dump(feedback_data, f, indent=4)
        
        logger.info(f"Feedback saved to {FEEDBACK_JSON_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving feedback JSON: {e}")
        logger.debug(traceback.format_exc())
        return False

def compare_contacts_and_feedback(contacts, feedback):
    """Compare contacts and feedback to find new entries to send"""
    if not feedback:
        # If no feedback exists, send all contacts
        logger.info("No existing feedback found. Sending messages to all contacts.")
        return contacts
    
    # Find the latest timestamp in feedback
    latest_timestamp = None
    for entry in feedback:
        timestamp = entry.get("createdAt", "")
        if timestamp:
            if not latest_timestamp or timestamp > latest_timestamp:
                latest_timestamp = timestamp
    
    if not latest_timestamp:
        # If no valid timestamp found in feedback, send all contacts
        logger.info("No valid timestamp found in feedback. Sending messages to all contacts.")
        return contacts
    
    logger.info(f"Latest timestamp in feedback: {latest_timestamp}")
    
    # Find contacts with timestamps newer than the latest in feedback
    new_contacts = []
    for contact in contacts:
        timestamp = contact.get("createdAt", "")
        if timestamp and timestamp > latest_timestamp:
            new_contacts.append(contact)
    
    logger.info(f"Found {len(new_contacts)} new contacts to send messages to")
    return new_contacts

def setup_firefox_driver(phone_number):
    """Set up Firefox WebDriver with headless mode and user-specific profile"""
    display = None
    driver = None
    
    try:
        # Set up virtual display if in headless mode
        if HEADLESS_MODE:
            logger.info("Starting virtual display...")
            display = Display(visible=0, size=VIRTUAL_DISPLAY_SIZE, backend="xvfb")
            display.start()
            logger.info("Virtual display started successfully!")
        
        # Get user-specific profile directory
        profile_dir = get_profile_directory(phone_number)
        logger.info(f"Using Firefox profile directory: {profile_dir}")
        
        # Set directory permissions
        chmod_recursive(profile_dir)
        
        # Set up Firefox options
        firefox_options = FirefoxOptions()
        firefox_options.add_argument(f"--width={VIRTUAL_DISPLAY_SIZE[0]}")
        firefox_options.add_argument(f"--height={VIRTUAL_DISPLAY_SIZE[1]}")
        firefox_options.add_argument("-profile")
        firefox_options.add_argument(profile_dir)
        
        if HEADLESS_MODE:
            firefox_options.add_argument("-headless")
        
        # Configure preferences
        firefox_options.set_preference("dom.webnotifications.enabled", False)
        firefox_options.set_preference("media.volume_scale", "0.0")
        firefox_options.set_preference("webdriver.log.level", "trace")
        
        # Set preferences to preserve session data
        firefox_options.set_preference("browser.sessionstore.resume_from_crash", True)
        firefox_options.set_preference("browser.sessionstore.restore_on_demand", False)
        firefox_options.set_preference("browser.startup.page", 3)  # Restore previous session
        firefox_options.set_preference("browser.startup.homepage", "about:blank")
        
        # Find geckodriver
        geckodriver_path = find_geckodriver()
        if not geckodriver_path:
            logger.error("geckodriver not found. Please install it first.")
            logger.info("You can install it with: brew install geckodriver")
            return None, None
        
        logger.info(f"Using geckodriver at: {geckodriver_path}")
        
        # Create Firefox service
        log_path = os.path.join(os.getcwd(), "geckodriver.log")
        service = FirefoxService(executable_path=geckodriver_path, log_path=log_path)
        
        # Start Firefox
        logger.info("Creating Firefox driver instance...")
        driver = webdriver.Firefox(service=service, options=firefox_options)
        logger.info("Firefox started successfully!")
        
        # Set window size and timeouts
        driver.set_window_size(*VIRTUAL_DISPLAY_SIZE)
        driver.set_page_load_timeout(120)
        
        return driver, display
        
    except Exception as e:
        logger.error(f"Error setting up Firefox driver: {e}")
        logger.debug(traceback.format_exc())
        if driver:
            driver.quit()
        if display:
            display.stop()
        return None, None

def save_cookies(driver, phone_number):
    """Save cookies to a user-specific file"""
    cookies_file = get_cookies_file_path(phone_number)
    try:
        with open(cookies_file, 'wb') as f:
            pickle.dump(driver.get_cookies(), f)
        logger.info(f"Cookies saved to {cookies_file}")
        return True
    except Exception as e:
        logger.error(f"Error saving cookies: {e}")
        return False

def load_cookies(driver, phone_number):
    """Load cookies from a user-specific file"""
    cookies_file = get_cookies_file_path(phone_number)
    if not os.path.exists(cookies_file):
        logger.info(f"No cookies file found at {cookies_file}")
        return False
    
    try:
        with open(cookies_file, 'rb') as f:
            cookies = pickle.load(f)
        
        # Navigate to the domain first to set cookies
        driver.get(WHATSAPP_URL)
        time.sleep(2)
        
        # Add each cookie
        for cookie in cookies:
            try:
                driver.add_cookie(cookie)
            except Exception as e:
                logger.error(f"Error adding cookie: {e}")
        
        logger.info(f"Cookies loaded from {cookies_file}")
        return True
    except Exception as e:
        logger.error(f"Error loading cookies: {e}")
        return False

def save_session_data(driver, phone_number):
    """Save additional session data beyond cookies"""
    user_dir = get_user_directory(phone_number)
    
    try:
        # Save localStorage
        local_storage = driver.execute_script("return window.localStorage;")
        with open(os.path.join(user_dir, "local_storage.json"), "w") as f:
            f.write(str(local_storage))
        logger.info("Local storage saved")
        
        # Save sessionStorage
        session_storage = driver.execute_script("return window.sessionStorage;")
        with open(os.path.join(user_dir, "session_storage.json"), "w") as f:
            f.write(str(session_storage))
        logger.info("Session storage saved")
        
        return True
    except Exception as e:
        logger.error(f"Error saving session data: {e}")
        return False

def load_session_data(driver, phone_number):
    """Load additional session data beyond cookies"""
    user_dir = get_user_directory(phone_number)
    
    try:
        # Load localStorage
        local_storage_file = os.path.join(user_dir, "local_storage.json")
        if os.path.exists(local_storage_file):
            with open(local_storage_file, "r") as f:
                local_storage = f.read()
            logger.info("Local storage file found (note: automatic restoration not implemented)")
        
        # Load sessionStorage
        session_storage_file = os.path.join(user_dir, "session_storage.json")
        if os.path.exists(session_storage_file):
            with open(session_storage_file, "r") as f:
                session_storage = f.read()
            logger.info("Session storage file found (note: automatic restoration not implemented)")
        
        return True
    except Exception as e:
        logger.error(f"Error loading session data: {e}")
        return False

def check_if_already_logged_in(driver):
    """Check if already logged in by looking for the settings icon"""
    logger.info("Checking if already logged in (looking for settings icon)...")
    
    # Try multiple selectors for the settings icon
    settings_selectors = [
        (By.XPATH, "//span[@data-icon='settings-refreshed']"),
        (By.CSS_SELECTOR, "span[data-icon='settings-refreshed']"),
        (By.XPATH, "//span[contains(@class, '') and @data-icon='settings-refreshed']")
    ]
    
    for selector_type, selector in settings_selectors:
        try:
            settings_icon = driver.find_element(selector_type, selector)
            if settings_icon:
                logger.info("Settings icon found! Already logged in.")
                return True
        except:
            continue
    
    logger.info("Settings icon not found. Not logged in yet.")
    return False

def extract_verification_code(driver, wait):
    """Extract the verification code from the page with enhanced debugging"""
    logger.info("Looking for verification code...")
    
    # Try multiple selectors for the verification code
    code_selectors = [
        (By.XPATH, "//span[contains(@class, 'xzwifym')]"),
        (By.XPATH, "//div[contains(@class, 'verification-code')]/span"),
        (By.XPATH, "//div[contains(text(), 'code')]/following-sibling::div//span"),
        (By.XPATH, "//div[contains(@class, 'x1c4vz4f') and contains(text(), 'Your code is')]/following-sibling::div//span"),
        (By.XPATH, "//div[contains(text(), 'code')]/..//span"),
        (By.XPATH, "//div[contains(text(), 'verification code')]//span"),
        (By.XPATH, "//div[contains(text(), 'Your code')]//span"),
        (By.XPATH, "//span[contains(text(), 'Your code is')]"),
        (By.XPATH, "//div[contains(text(), 'verification code')]"),
        (By.XPATH, "//div[contains(text(), 'Your code')]"),
        (By.XPATH, "//span[contains(@class, 'x1c4vz4f') and contains(text(), 'code')]"),
        (By.XPATH, "//span[contains(@class, 'x1c4vz4f') and contains(text(), 'verification')]"),
        (By.XPATH, "//span[contains(@class, 'x1c4vz4f') and contains(text(), 'Your')]"),
        (By.XPATH, "//div[contains(text(), 'Enter this code')]"),
        (By.XPATH, "//div[contains(text(), 'code to verify')]"),
        (By.XPATH, "//div[contains(text(), '6-digit code')]"),
        (By.XPATH, "//div[contains(text(), 'verification code')]//following-sibling::div"),
        (By.XPATH, "//div[contains(text(), 'Your code')]//following-sibling::div"),
        (By.XPATH, "//div[contains(text(), 'Enter this code')]//following-sibling::div"),
        (By.XPATH, "//div[contains(text(), 'code to verify')]//following-sibling::div"),
        (By.XPATH, "//div[contains(text(), '6-digit code')]//following-sibling::div")
    ]
    
    code = None
    for selector_type, selector in code_selectors:
        try:
            logger.debug(f"Trying selector: {selector}")
            code_elements = wait.until(
                EC.presence_of_all_elements_located((selector_type, selector))
            )
            code = "".join([elem.text for elem in code_elements if elem.text.strip()])
            if code:
                logger.info(f"Found verification code using selector: {selector}")
                break
        except Exception as e:
            logger.debug(f"Selector failed: {selector} - {e}")
    
    if code:
        logger.info(f"Verification code found: {code}")
        return code
    else:
        logger.warning("Verification code not found with any selector.")
        
        # Save page source for debugging
        try:
            page_source_path = os.path.join(os.getcwd(), "page_source.html")
            with open(page_source_path, "w") as f:
                f.write(driver.page_source)
            logger.info(f"Page source saved to {page_source_path}")
        except Exception as e:
            logger.error(f"Failed to save page source: {e}")
        
        # Try to find any elements that might contain the code
        try:
            logger.info("Looking for any elements that might contain the code...")
            all_spans = driver.find_elements(By.TAG_NAME, "span")
            for span in all_spans:
                text = span.text.strip()
                if text and len(text) >= 4 and text.isdigit():
                    logger.info(f"Potential code found in span: {text}")
            
            all_divs = driver.find_elements(By.TAG_NAME, "div")
            for div in all_divs:
                text = div.text.strip()
                if text and len(text) >= 4 and text.isdigit():
                    logger.info(f"Potential code found in div: {text}")
        except Exception as e:
            logger.error(f"Error searching for potential codes: {e}")
        
        return None

def check_for_login_success(driver):
    """Check for the settings icon that indicates successful login"""
    logger.info("Checking for login success (looking for settings icon)...")
    
    # Try multiple selectors for the settings icon
    settings_selectors = [
        (By.XPATH, "//span[@data-icon='settings-refreshed']"),
        (By.CSS_SELECTOR, "span[data-icon='settings-refreshed']"),
        (By.XPATH, "//span[contains(@class, '') and @data-icon='settings-refreshed']")
    ]
    
    for selector_type, selector in settings_selectors:
        try:
            settings_icon = driver.find_element(selector_type, selector)
            if settings_icon:
                logger.info("Settings icon found! Login successful!")
                return True
        except:
            continue
    
    return False

def click_new_chat_button(driver):
    """Click on the new chat button"""
    logger.info("Looking for new chat button...")
    
    # Try multiple selectors for the new chat button
    new_chat_selectors = [
        (By.XPATH, "//span[@data-icon='new-chat-outline']"),
        (By.CSS_SELECTOR, "span[data-icon='new-chat-outline']"),
        (By.XPATH, "//span[contains(@class, '') and @data-icon='new-chat-outline']"),
        (By.XPATH, "//button[.//span[@data-icon='new-chat-outline']]"),
        (By.CSS_SELECTOR, "button span[data-icon='new-chat-outline']")
    ]
    
    new_chat_button = None
    for selector_type, selector in new_chat_selectors:
        try:
            new_chat_button = driver.find_element(selector_type, selector)
            if new_chat_button:
                logger.info(f"Found new chat button using selector: {selector}")
                break
        except:
            continue
    
    if not new_chat_button:
        logger.warning("Could not find new chat button")
        return False
    
    try:
        # Method 1: Try using ActionChains
        try:
            logger.info("Trying Method 1: ActionChains")
            actions = ActionChains(driver)
            actions.move_to_element(new_chat_button).click().perform()
            logger.info("Successfully clicked new chat button using ActionChains!")
            time.sleep(3)
            return True
        except Exception as e:
            logger.error(f"Method 1 failed with error: {e}")
        
        # Method 2: Try using JavaScript
        try:
            logger.info("Trying Method 2: JavaScript")
            driver.execute_script("arguments[0].click();", new_chat_button)
            logger.info("Successfully clicked new chat button using JavaScript!")
            time.sleep(3)
            return True
        except Exception as e:
            logger.error(f"Method 2 failed with error: {e}")
        
        # Method 3: Try scrolling into view and then clicking
        try:
            logger.info("Trying Method 3: Scroll into view and click")
            driver.execute_script("arguments[0].scrollIntoView(true);", new_chat_button)
            time.sleep(1)
            new_chat_button.click()
            logger.info("Successfully clicked new chat button using scroll into view!")
            time.sleep(3)
            return True
        except Exception as e:
            logger.error(f"Method 3 failed with error: {e}")
        
        # If all methods failed, return False
        logger.error("All methods failed to click new chat button")
        return False
        
    except Exception as e:
        logger.error(f"Error clicking new chat button: {e}")
        logger.debug(traceback.format_exc())
        return False

def input_phone_number_in_new_chat(driver, phone_number):
    """Click on the input field and input the phone number"""
    logger.info(f"Looking for input field in new chat for phone number: {phone_number}...")
    
    # Try multiple selectors for the input field
    input_selectors = [
        (By.XPATH, "//p[@class='selectable-text copyable-text x15bjb6t x1n2onr6']"),
        (By.CSS_SELECTOR, "p.selectable-text.copyable-text.x15bjb6t.x1n2onr6"),
        (By.XPATH, "//div[@contenteditable='true']"),
        (By.CSS_SELECTOR, "div[contenteditable='true']"),
        (By.XPATH, "//div[@role='textbox']"),
        (By.CSS_SELECTOR, "div[role='textbox']")
    ]
    
    input_field = None
    for selector_type, selector in input_selectors:
        try:
            input_field = driver.find_element(selector_type, selector)
            if input_field:
                logger.info(f"Found input field using selector: {selector}")
                break
        except:
            continue
    
    if not input_field:
        logger.warning("Could not find input field")
        return False
    
    try:
        logger.info(f"Attempting to input phone number: {phone_number}")
        
        # Method 1: Try using ActionChains
        try:
            logger.info("Trying Method 1: ActionChains")
            actions = ActionChains(driver)
            
            # Click on the input field
            actions.move_to_element(input_field).click().perform()
            time.sleep(1)
            
            # Clear any existing content
            input_field.clear()
            time.sleep(0.5)
            
            # Send keys using ActionChains
            actions.send_keys(str(phone_number)).perform()
            time.sleep(1)
            
            # Check if the value was set
            current_text = driver.execute_script("return arguments[0].textContent;", input_field)
            if str(phone_number) in current_text:
                logger.info(f"Method 1 successful: Phone number set to '{current_text}'")
                return True
            else:
                logger.warning(f"Method 1 failed: Expected '{phone_number}', got '{current_text}'")
        except Exception as e:
            logger.error(f"Method 1 failed with error: {e}")
        
        # Method 2: Try using send_keys after focusing with JavaScript
        try:
            logger.info("Trying Method 2: JavaScript focus + send_keys")
            driver.execute_script("arguments[0].focus();", input_field)
            time.sleep(1)
            
            # Clear any existing content
            input_field.clear()
            time.sleep(0.5)
            
            # Send keys
            input_field.send_keys(str(phone_number))
            time.sleep(1)
            
            # Check if the value was set
            current_text = driver.execute_script("return arguments[0].textContent;", input_field)
            if str(phone_number) in current_text:
                logger.info(f"Method 2 successful: Phone number set to '{current_text}'")
                return True
            else:
                logger.warning(f"Method 2 failed: Expected '{phone_number}', got '{current_text}'")
        except Exception as e:
            logger.error(f"Method 2 failed with error: {e}")
        
        # Method 3: Try character-by-character typing
        try:
            logger.info("Trying Method 3: Character-by-character typing")
            driver.execute_script("arguments[0].focus();", input_field)
            time.sleep(1)
            
            # Clear any existing content
            driver.execute_script("arguments[0].innerHTML = '<br>';", input_field)
            time.sleep(0.5)
            
            # Type character by character
            for char in str(phone_number):
                input_field.send_keys(char)
                time.sleep(0.1)
            
            time.sleep(1)
            
            # Check if the value was set
            current_text = driver.execute_script("return arguments[0].textContent;", input_field)
            if str(phone_number) in current_text:
                logger.info(f"Method 3 successful: Phone number set to '{current_text}'")
                return True
            else:
                logger.warning(f"Method 3 failed: Expected '{phone_number}', got '{current_text}'")
        except Exception as e:
            logger.error(f"Method 3 failed with error: {e}")
        
        # If all methods failed, return False
        logger.error("All methods failed to input phone number")
        return False
        
    except Exception as e:
        logger.error(f"Error inputting phone number: {e}")
        logger.debug(traceback.format_exc())
        return False

def select_contact_from_search_results(driver):
    """Select the first contact from search results"""
    logger.info("Looking for first contact in search results...")
    
    # Try multiple selectors for the first contact in search results
    contact_selectors = [
        (By.XPATH, "//div[@role='gridcell']//div[@role='gridcell']"),
        (By.XPATH, "//div[@class='_ak8o']"),
        (By.XPATH, "//div[@class='_ak8q']"),
        (By.XPATH, "//div[contains(@class, 'x1n2onr6') and @role='row']"),
        (By.XPATH, "//div[@role='row']//div[@role='gridcell']"),
        (By.XPATH, "//div[contains(@class, 'x1n2onr6') and @role='gridcell']")
    ]
    
    contact_element = None
    for selector_type, selector in contact_selectors:
        try:
            # Find all elements matching the selector
            contact_elements = driver.find_elements(selector_type, selector)
            if contact_elements:
                # Get the first visible element
                for element in contact_elements:
                    if element.is_displayed():
                        contact_element = element
                        logger.info(f"Found first contact using selector: {selector}")
                        break
                if contact_element:
                    break
        except:
            continue
    
    if not contact_element:
        logger.warning("Could not find any contact in search results")
        return False
    
    try:
        # Click on the contact
        logger.info("Clicking on contact...")
        contact_element.click()
        logger.info("Successfully clicked on contact!")
        
        # Wait a moment after clicking
        time.sleep(3)
        
        return True
    except Exception as e:
        logger.error(f"Error clicking on contact: {e}")
        logger.debug(traceback.format_exc())
        return False

def send_message_to_contact(driver, message):
    """Send a message to the selected contact"""
    logger.info("Preparing to send message...")
    
    # Find the message input field
    logger.info("Looking for message input field...")
    
    # Try multiple selectors for the message input field, prioritizing the correct one
    message_input_selectors = [
        # New selectors for the correct input field
        (By.XPATH, "//div[@contenteditable='true' and @role='textbox' and @aria-placeholder='Type a message']"),
        (By.CSS_SELECTOR, "div[contenteditable='true'][role='textbox'][aria-placeholder='Type a message']"),
        (By.XPATH, "//div[contains(@class, 'lexical-rich-text-input')]//div[@contenteditable='true']"),
        (By.XPATH, "//div[contains(@class, 'x1n2onr6 xh8yej3 xjdcl3y lexical-rich-text-input')]//div[@contenteditable='true']"),
        # Fallback selectors
        (By.CSS_SELECTOR, "p.selectable-text.copyable-text.x15bjb6t.x1n2onr6"),
        (By.XPATH, "//p[@class='selectable-text copyable-text x15bjb6t x1n2onr6']"),
        (By.XPATH, "//div[@contenteditable='true' and @role='textbox']"),
        (By.CSS_SELECTOR, "div[contenteditable='true'][role='textbox']")
    ]
    
    message_input = None
    for selector_type, selector in message_input_selectors:
        try:
            # Wait for the element to be present
            wait = WebDriverWait(driver, 10)
            message_input = wait.until(EC.presence_of_element_located((selector_type, selector)))
            if message_input:
                logger.info(f"Found message input field using selector: {selector}")
                break
        except:
            continue
    
    if not message_input:
        logger.error("Could not find message input field")
        return False
    
    try:
        # Method 1: Try using JavaScript to input the message
        try:
            logger.info("Trying Method 1: JavaScript to input message")
            driver.execute_script("arguments[0].focus();", message_input)
            time.sleep(1)
            
            # Clear any existing content using JavaScript - Select All and Backspace
            driver.execute_script("""
                var p = arguments[0].querySelector('p');
                if (p) {
                    // Select all text in the paragraph
                    var range = document.createRange();
                    range.selectNodeContents(p);
                    var selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Simulate backspace to clear the selection
                    document.execCommand('delete', false, null);
                } else {
                    // If no paragraph exists, clear the div directly
                    arguments[0].innerHTML = '<br>';
                }
            """, message_input)
            time.sleep(0.5)
            
            # Input the message using JavaScript
            # For contenteditable divs, we need to set the innerHTML of the child p element
            driver.execute_script("""
                var p = arguments[0].querySelector('p');
                if (p) {
                    p.innerHTML = '';
                    p.textContent = arguments[1];
                } else {
                    arguments[0].innerHTML = '<p dir=\"ltr\" style=\"text-indent: 0px; margin-top: 0px; margin-bottom: 0px;\">' + arguments[1] + '</p>';
                }
            """, message_input, message)
            time.sleep(1)
            
            # Check if the message was typed correctly
            current_text = driver.execute_script("""
                var p = arguments[0].querySelector('p');
                return p ? p.textContent : arguments[0].textContent;
            """, message_input)
            
            if message in current_text:
                logger.info(f"Method 1 successful: Message set to '{current_text}'")
            else:
                logger.warning(f"Method 1 failed: Expected '{message}', got '{current_text}'")
                raise Exception("JavaScript method failed")
        except Exception as e:
            logger.error(f"Method 1 failed with error: {e}")
            
            # Method 2: Try using ActionChains
            try:
                logger.info("Trying Method 2: ActionChains")
                actions = ActionChains(driver)
                
                # Click on the input field
                actions.move_to_element(message_input).click().perform()
                time.sleep(1)
                
                # Select all and backspace to clear
                actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                time.sleep(0.5)
                actions.send_keys(Keys.BACKSPACE).perform()
                time.sleep(0.5)
                
                # Send keys using ActionChains
                actions.send_keys(message).perform()
                time.sleep(1)
                
                # Check if the value was set
                current_text = driver.execute_script("""
                    var p = arguments[0].querySelector('p');
                    return p ? p.textContent : arguments[0].textContent;
                """, message_input)
                
                if message in current_text:
                    logger.info(f"Method 2 successful: Message set to '{current_text}'")
                else:
                    logger.warning(f"Method 2 failed: Expected '{message}', got '{current_text}'")
                    raise Exception("ActionChains method failed")
            except Exception as e2:
                logger.error(f"Method 2 failed with error: {e2}")
                
                # Method 3: Try using send_keys after focusing with JavaScript
                try:
                    logger.info("Trying Method 3: JavaScript focus + send_keys")
                    driver.execute_script("arguments[0].focus();", message_input)
                    time.sleep(1)
                    
                    # Select all and backspace to clear
                    driver.execute_script("""
                        var p = arguments[0].querySelector('p');
                        if (p) {
                            // Select all text in the paragraph
                            var range = document.createRange();
                            range.selectNodeContents(p);
                            var selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            // Simulate backspace to clear the selection
                            document.execCommand('delete', false, null);
                        } else {
                            // If no paragraph exists, clear the div directly
                            arguments[0].innerHTML = '<br>';
                        }
                    """, message_input)
                    time.sleep(0.5)
                    
                    # Send keys
                    message_input.send_keys(message)
                    time.sleep(1)
                    
                    # Check if the value was set
                    current_text = driver.execute_script("""
                        var p = arguments[0].querySelector('p');
                        return p ? p.textContent : arguments[0].textContent;
                    """, message_input)
                    
                    if message in current_text:
                        logger.info(f"Method 3 successful: Message set to '{current_text}'")
                    else:
                        logger.warning(f"Method 3 failed: Expected '{message}', got '{current_text}'")
                        raise Exception("send_keys method failed")
                except Exception as e3:
                    logger.error(f"Method 3 failed with error: {e3}")
                    return False
        
        # Hit backspace 10000 times and then re-enter the message
        logger.info("Hitting backspace 10000 times...")
        
        # Focus on the message input field
        driver.execute_script("arguments[0].focus();", message_input)
        time.sleep(0.5)
        
        # Hit backspace 10000 times in batches to avoid overwhelming the browser
        batch_size = 100
        batches = 10000 // batch_size
        for i in range(batches):
            message_input.send_keys(Keys.BACKSPACE * batch_size)
            time.sleep(0.01)  # Small delay between batches
            if i % 10 == 0:  # Log progress every 10 batches
                logger.info(f"Backspace progress: {i * batch_size}/10000")
        
        # Handle any remaining backspaces if 10000 isn't divisible by batch_size
        remaining = 10000 % batch_size
        if remaining > 0:
            message_input.send_keys(Keys.BACKSPACE * remaining)
            time.sleep(0.01)
        
        logger.info("Completed hitting backspace 10000 times")
        
        # Re-enter the message using the same method that worked initially
        logger.info("Re-entering the message after backspace...")
        
        # Try the same three methods again to re-enter the message
        try:
            logger.info("Re-trying Method 1: JavaScript to input message")
            driver.execute_script("arguments[0].focus();", message_input)
            time.sleep(1)
            
            # Clear any remaining content using JavaScript
            driver.execute_script("""
                var p = arguments[0].querySelector('p');
                if (p) {
                    // Select all text in the paragraph
                    var range = document.createRange();
                    range.selectNodeContents(p);
                    var selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Simulate backspace to clear the selection
                    document.execCommand('delete', false, null);
                } else {
                    // If no paragraph exists, clear the div directly
                    arguments[0].innerHTML = '<br>';
                }
            """, message_input)
            time.sleep(0.5)
            
            # Input the message using JavaScript
            driver.execute_script("""
                var p = arguments[0].querySelector('p');
                if (p) {
                    p.innerHTML = '';
                    p.textContent = arguments[1];
                } else {
                    arguments[0].innerHTML = '<p dir=\"ltr\" style=\"text-indent: 0px; margin-top: 0px; margin-bottom: 0px;\">' + arguments[1] + '</p>';
                }
            """, message_input, message)
            time.sleep(1)
            
            # Check if the message was typed correctly
            current_text = driver.execute_script("""
                var p = arguments[0].querySelector('p');
                return p ? p.textContent : arguments[0].textContent;
            """, message_input)
            
            if message in current_text:
                logger.info(f"Re-entry Method 1 successful: Message set to '{current_text}'")
            else:
                logger.warning(f"Re-entry Method 1 failed: Expected '{message}', got '{current_text}'")
                raise Exception("JavaScript method failed")
        except Exception as e:
            logger.error(f"Re-entry Method 1 failed with error: {e}")
            
            try:
                logger.info("Re-trying Method 2: ActionChains")
                actions = ActionChains(driver)
                
                # Click on the input field
                actions.move_to_element(message_input).click().perform()
                time.sleep(1)
                
                # Select all and backspace to clear
                actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                time.sleep(0.5)
                actions.send_keys(Keys.BACKSPACE).perform()
                time.sleep(0.5)
                
                # Send keys using ActionChains
                actions.send_keys(message).perform()
                time.sleep(1)
                
                # Check if the value was set
                current_text = driver.execute_script("""
                    var p = arguments[0].querySelector('p');
                    return p ? p.textContent : arguments[0].textContent;
                """, message_input)
                
                if message in current_text:
                    logger.info(f"Re-entry Method 2 successful: Message set to '{current_text}'")
                else:
                    logger.warning(f"Re-entry Method 2 failed: Expected '{message}', got '{current_text}'")
                    raise Exception("ActionChains method failed")
            except Exception as e2:
                logger.error(f"Re-entry Method 2 failed with error: {e2}")
                
                try:
                    logger.info("Re-trying Method 3: JavaScript focus + send_keys")
                    driver.execute_script("arguments[0].focus();", message_input)
                    time.sleep(1)
                    
                    # Select all and backspace to clear
                    driver.execute_script("""
                        var p = arguments[0].querySelector('p');
                        if (p) {
                            // Select all text in the paragraph
                            var range = document.createRange();
                            range.selectNodeContents(p);
                            var selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            // Simulate backspace to clear the selection
                            document.execCommand('delete', false, null);
                        } else {
                            // If no paragraph exists, clear the div directly
                            arguments[0].innerHTML = '<br>';
                        }
                    """, message_input)
                    time.sleep(0.5)
                    
                    # Send keys
                    message_input.send_keys(message)
                    time.sleep(1)
                    
                    # Check if the value was set
                    current_text = driver.execute_script("""
                        var p = arguments[0].querySelector('p');
                        return p ? p.textContent : arguments[0].textContent;
                    """, message_input)
                    
                    if message in current_text:
                        logger.info(f"Re-entry Method 3 successful: Message set to '{current_text}'")
                    else:
                        logger.warning(f"Re-entry Method 3 failed: Expected '{message}', got '{current_text}'")
                        raise Exception("send_keys method failed")
                except Exception as e3:
                    logger.error(f"Re-entry Method 3 failed with error: {e3}")
                    return False
        
        # Find the send button
        logger.info("Looking for send button...")
        
        # Try multiple selectors for the send button
        send_button_selectors = [
            (By.CSS_SELECTOR, "span[data-icon='wds-ic-send-filled']"),
            (By.XPATH, "//span[@data-icon='wds-ic-send-filled']"),
            (By.XPATH, "//span[contains(@class, 'xxk0z11') and @data-icon='wds-ic-send-filled']"),
            (By.XPATH, "//button[.//span[@data-icon='wds-ic-send-filled']]"),
            (By.CSS_SELECTOR, "button span[data-icon='wds-ic-send-filled']"),
            (By.XPATH, "//button[@aria-label='Send']"),
            (By.CSS_SELECTOR, "button[aria-label='Send']")
        ]
        
        send_button = None
        for selector_type, selector in send_button_selectors:
            try:
                # Wait for the element to be clickable
                wait = WebDriverWait(driver, 10)
                send_button = wait.until(EC.element_to_be_clickable((selector_type, selector)))
                if send_button:
                    logger.info(f"Found send button using selector: {selector}")
                    break
            except:
                continue
        
        if not send_button:
            logger.error("Could not find send button")
            return False
        
        # Click the send button
        logger.info("Clicking send button...")
        send_button.click()
        logger.info("Successfully clicked send button!")
        
        # Wait a moment after sending
        time.sleep(3)
        
        return True
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        logger.debug(traceback.format_exc())
        return False

def wait_for_page_to_load(driver, timeout=60):
    """Wait for the page to load after refresh"""
    logger.info(f"Waiting for page to load (timeout: {timeout} seconds)...")
    
    try:
        # Wait for the settings icon to be present (indicating logged in and page loaded)
        wait = WebDriverWait(driver, timeout)
        wait.until(EC.presence_of_element_located((By.XPATH, "//span[@data-icon='settings-refreshed']")))
        logger.info("Page loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Page did not load within {timeout} seconds: {e}")
        return False

def send_messages_to_contacts(driver, contacts):
    """Send messages to multiple contacts from the JSON file"""
    success_count = 0
    failure_count = 0
    last_successful_contact = None
    
    for i, contact in enumerate(contacts):
        phone_number = contact.get("mobile")
        message = contact.get("message to be sent")
        timestamp = contact.get("createdAt", "")
        
        if not phone_number or not message:
            logger.warning(f"Skipping contact {i+1} due to missing phone number or message")
            failure_count += 1
            continue
        
        logger.info(f"Processing contact {i+1}/{len(contacts)}: {phone_number}")
        
        try:
            # For the first contact, we need to click the new chat button
            if i == 0:
                if not click_new_chat_button(driver):
                    logger.error(f"Failed to click new chat button for contact {phone_number}")
                    failure_count += 1
                    continue
            
            # Input phone number in the new chat
            if not input_phone_number_in_new_chat(driver, phone_number):
                logger.error(f"Failed to input phone number for contact {phone_number}")
                failure_count += 1
                continue
            
            # Select the first contact from search results (should be the one we want)
            if not select_contact_from_search_results(driver):
                logger.error(f"Failed to select contact {phone_number}")
                failure_count += 1
                continue
            
            # Send message to the contact
            if not send_message_to_contact(driver, message):
                logger.error(f"Failed to send message to contact {phone_number}")
                failure_count += 1
                continue
            
            # If we get here, the message was sent successfully
            logger.info(f"Successfully sent message to contact {phone_number}")
            success_count += 1
            last_successful_contact = contact
            
        except Exception as e:
            logger.error(f"Error processing contact {phone_number}: {e}")
            logger.debug(traceback.format_exc())
            failure_count += 1
        
        finally:
            # Refresh the page after each contact (except for the last contact)
            if i < len(contacts) - 1:
                logger.info("Refreshing webpage after processing contact...")
                driver.refresh()
                
                # Wait for the page to load dynamically
                if not wait_for_page_to_load(driver, 60):
                    logger.warning("Page did not load within timeout, continuing anyway")
                
                # After refresh, click the new chat button for the next contact
                logger.info("Clicking new chat button for next contact after refresh...")
                if not click_new_chat_button(driver):
                    logger.error("Failed to click new chat button after refresh")
                    # We'll continue anyway, but the next contact might fail
            
            # Wait a moment before processing the next contact
            time.sleep(2)
    
    logger.info(f"Message sending completed: {success_count} successful, {failure_count} failed")
    
    # Create feedback entry in the new format
    if last_successful_contact:
        mobile_number = last_successful_contact.get("mobile")
        timestamp = last_successful_contact.get("createdAt")
    else:
        mobile_number = None
        timestamp = None
    
    # Generate current timestamp in the required format
    current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    
    feedback_entry = {
        "status": "received",
        "message": "Data has been successfully received by client application",
        "mobile_number": mobile_number,
        "timestamp": timestamp,
        "client_info": {
            "application": "LeadFetcher-Client",
            "version": "1.0"
        },
        "received_data_summary": {
            "total_leads": success_count + failure_count,
            "leads_count": success_count,
            "success": success_count > 0
        },
        "received_at": current_time
    }
    
    # Save feedback in the new format
    save_feedback_json(feedback_entry)
    
    # Take a final screenshot after sending all messages
    try:
        ensure_directory_exists(SCREENSHOT_DIR)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = os.path.join(SCREENSHOT_DIR, f"final_screenshot_{timestamp}.png")
        driver.save_screenshot(screenshot_path)
        logger.info(f"Final screenshot saved to {screenshot_path}")
    except Exception as e:
        logger.error(f"Failed to save final screenshot: {e}")
    
    return success_count, failure_count

def perform_login_steps(driver, wait, phone_number):
    """Perform the login steps if not already logged in"""
    try:
        # Wait for and click the "Log in with phone number" button
        logger.info("Looking for 'Log in with phone number' button...")
        
        # Find the login button using XPath
        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
        )
        logger.info("Found login button, clicking now...")
        login_button.click()
        logger.info("Successfully clicked login button!")
        
        # Wait a moment after clicking
        time.sleep(5)
        
        # Now find the phone number input field
        logger.info("Looking for phone number input field...")
        
        # Try multiple selectors for the phone input
        phone_input_selectors = [
            (By.XPATH, "//input[@aria-label='Type your phone number.']"),
            (By.XPATH, "//input[@type='text' and @value]"),
            (By.CSS_SELECTOR, "input[aria-label='Type your phone number.']"),
            (By.CSS_SELECTOR, "input.selectable-text")
        ]
        
        phone_input = None
        for selector_type, selector in phone_input_selectors:
            try:
                phone_input = wait.until(
                    EC.element_to_be_clickable((selector_type, selector))
                )
                logger.info(f"Found phone input using selector: {selector}")
                break
            except:
                logger.debug(f"Could not find phone input with selector: {selector}")
        
        if not phone_input:
            logger.error("Could not find phone input field")
            return False
        
        # Click on the input field to focus it
        logger.info("Clicking on phone input field to focus it...")
        phone_input.click()
        time.sleep(1)
        
        # Get the current value
        current_value = phone_input.get_attribute("value")
        logger.info(f"Current phone input value: '{current_value}'")
        
        # Hit backspace 5 times to clear the default value
        logger.info("Hitting backspace 5 times to clear input...")
        for _ in range(5):
            phone_input.send_keys(Keys.BACKSPACE)
            time.sleep(0.2)  # Small delay between keystrokes
        
        # Get the value after clearing
        cleared_value = phone_input.get_attribute("value")
        logger.info(f"Phone input value after backspaces: '{cleared_value}'")
        
        # Enter the phone number
        logger.info(f"Entering phone number: {phone_number}")
        phone_input.send_keys(phone_number)
        time.sleep(1)  # Wait for the input to be registered
        
        # Get the value after entering the phone number
        final_value = phone_input.get_attribute("value")
        logger.info(f"Phone input value after entering number: '{final_value}'")
        
        # Now find and click the "Next" button
        logger.info("Looking for 'Next' button...")
        
        # Try multiple selectors for the Next button
        next_button_selectors = [
            (By.XPATH, "//button[.//div[contains(text(), 'Next')]]"),
            (By.XPATH, "//div[contains(text(), 'Next')]"),
            (By.XPATH, "//button[.//div[text()='Next']]"),
            (By.CSS_SELECTOR, "button.x889kno"),
            (By.XPATH, "//button[contains(@class, 'x889kno')]")
        ]
        
        next_button = None
        for selector_type, selector in next_button_selectors:
            try:
                next_button = wait.until(
                    EC.element_to_be_clickable((selector_type, selector))
                )
                logger.info(f"Found Next button using selector: {selector}")
                break
            except:
                logger.debug(f"Could not find Next button with selector: {selector}")
        
        if not next_button:
            logger.error("Could not find Next button")
            return False
        
        # Click the Next button
        logger.info("Clicking Next button...")
        next_button.click()
        logger.info("Successfully clicked Next button!")
        
        # Wait a moment after clicking
        time.sleep(5)
        
        # Verify we're on the next page by checking URL or page title
        logger.info(f"Current URL after clicking Next: {driver.current_url}")
        logger.info(f"Page title after clicking Next: {driver.title}")
        
        # Check if we are still on the same page or if there's an error
        try:
            # Check if there's an error message
            error_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'error') or contains(text(), 'Error') or contains(text(), 'wrong') or contains(text(), 'invalid')]")
            if error_elements:
                for elem in error_elements:
                    logger.error(f"Error message found: {elem.text}")
        except:
            pass
        
        # Check if we are on the QR code page
        try:
            qr_elements = driver.find_elements(By.XPATH, "//canvas[contains(@class, 'qrcode')]")
            if qr_elements:
                logger.warning("QR code page detected. This might indicate an issue with the phone number or login process.")
        except:
            pass
        
        # Now wait for the verification code to appear
        logger.info("Waiting for verification code to appear...")
        
        # Extend the wait time for the verification code (up to 10 minutes)
        code_wait = WebDriverWait(driver, 600)  # 10 minutes
        
        # Try to extract the verification code
        verification_code = extract_verification_code(driver, code_wait)
        
        if verification_code:
            logger.info(f"SUCCESS! Verification code: {verification_code}")
            logger.info("Browser will remain open until you manually kill this script (Ctrl+C)")
            
            # Now keep checking for the settings icon to confirm login success
            login_success = False
            while not login_success:
                login_success = check_for_login_success(driver)
                if not login_success:
                    logger.info("Still waiting for login to complete...")
                    time.sleep(10)  # Check every 10 seconds
            
            # If we get here, login was successful
            logger.info("Login successful")
            
            # Save cookies for future sessions
            save_cookies(driver, phone_number)
            
            # Save additional session data
            save_session_data(driver, phone_number)
            
            return True
        else:
            logger.error("Failed to extract verification code")
            return False
            
    except Exception as e:
        logger.error(f"Error during login or input handling: {e}")
        logger.debug(traceback.format_exc())
        return False

def test_webdriver():
    """Test the WebDriver setup by visiting WhatsApp Web and checking login status"""
    # Parse command line arguments
    if len(sys.argv) < 2:
        logger.error("Usage: python script_name.py phone_number")
        return 1
    
    phone_number = sys.argv[1]
    logger.info(f"Processing for phone number: {phone_number}")
    
    # Load contacts from JSON file
    contacts = load_contacts_from_json()
    if not contacts:
        logger.error("No contacts loaded. Exiting.")
        return 1
    
    # Load feedback from JSON file
    feedback = load_feedback_from_json()
    
    # Compare contacts and feedback to find new entries to send
    contacts_to_send = compare_contacts_and_feedback(contacts, feedback)
    
    if not contacts_to_send:
        logger.info("No new contacts to send messages to. Exiting.")
        return 0
    
    # Set up Firefox driver with user-specific profile
    driver, display = setup_firefox_driver(phone_number)
    
    if driver is None or display is None:
        logger.error("Failed to set up WebDriver")
        return 1
    
    try:
        # First, try to load cookies from a previous session
        cookies_loaded = load_cookies(driver, phone_number)
        
        # Load additional session data
        session_data_loaded = load_session_data(driver, phone_number)
        
        # Navigate to WhatsApp Web
        logger.info("Navigating to WhatsApp Web...")
        driver.get(WHATSAPP_URL)
        
        # Wait for page to load
        logger.info("Waiting for WhatsApp Web to load...")
        time.sleep(10)  # Give time for the page to load
        
        # Get page title
        logger.info(f"Page title: {driver.title}")
        
        # Get page URL
        logger.info(f"Current URL: {driver.current_url}")
        
        # Check if already logged in
        if check_if_already_logged_in(driver):
            logger.info("Already logged in")
            
            # Send messages to the new contacts
            success_count, failure_count = send_messages_to_contacts(driver, contacts_to_send)
            
            logger.info(f"Message sending completed: {success_count} successful, {failure_count} failed")
            logger.info("Browser will remain open until you manually kill this script (Ctrl+C)")
            
            # Keep the script running indefinitely until manually stopped
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("\nScript interrupted by user. Cleaning up...")
                return 0
        else:
            # Create a WebDriverWait instance
            wait = WebDriverWait(driver, 30)  # Wait up to 30 seconds
            
            # Perform the login steps
            login_successful = perform_login_steps(driver, wait, phone_number)
            
            if login_successful:
                logger.info("Login process completed successfully!")
                
                # Send messages to the new contacts
                success_count, failure_count = send_messages_to_contacts(driver, contacts_to_send)
                
                logger.info(f"Message sending completed: {success_count} successful, {failure_count} failed")
                
                # Keep the script running indefinitely until manually stopped
                try:
                    while True:
                        time.sleep(1)
                except KeyboardInterrupt:
                    logger.info("\nScript interrupted by user. Cleaning up...")
                    return 0
            else:
                logger.error("Login process failed!")
                return 1
        
    except Exception as e:
        logger.error(f"Error during test: {e}")
        logger.debug(traceback.format_exc())
        return 1
        
    finally:
        # Always clean up
        logger.info("Cleaning up...")
        if driver:
            driver.quit()
        if display:
            display.stop()

if __name__ == "__main__":
    exit_code = test_webdriver()
    sys.exit(exit_code)