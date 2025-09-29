import requests
import json
import time
from datetime import datetime
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import base64
import sys
import subprocess
import logging
import queue
import re
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
from selenium.webdriver.common.action_chains import ActionChains
from pyvirtualdisplay import Display
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service
from selenium.common.exceptions import TimeoutException
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import keyring
from cryptography.fernet import Fernet
import base64
from datetime import datetime, timedelta
import psutil
import os
import signal
from pathlib import Path
import re
import webbrowser
import tempfile
import zipfile

try:
    import pystray
    from PIL import Image, ImageDraw
    TRAY_AVAILABLE = True
    print("✅ Tray dependencies available")
except ImportError as e:
    print(f"⚠️ Tray dependencies not available: {e}")
    TRAY_AVAILABLE = False

def get_application_directory():
    """Get the application directory - uses AppData (no admin required)"""
    # Running as executable - use AppData Local
    appdata = os.environ.get('LOCALAPPDATA', 
                            os.path.expanduser('~\\AppData\\Local'))
    app_dir = os.path.join(appdata, 'LeadFetcher')
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(app_dir, exist_ok=True)
        
        # Test write permission with a temporary file
        test_file = os.path.join(app_dir, 'write_test.tmp')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        
        print(f"✅ Using AppData directory: {app_dir}")
        return app_dir
        
    except Exception as e:
        print(f"❌ Cannot access AppData directory: {e}")
        # Last resort - use current directory
        current_dir = os.path.dirname(os.path.abspath(sys.executable))
        print(f"📁 Using executable directory as fallback: {current_dir}")
        return current_dir

   
def ensure_application_directories():
    """Create necessary directories if they don't exist"""
    app_dir = get_application_directory()
    
    # Create main application directory
    os.makedirs(app_dir, exist_ok=True)
    
    # Create screenshots directory
    screenshots_dir = os.path.join(app_dir, "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)
    
    return app_dir, screenshots_dir

through_logout = False  # Global variable to indicate logout state
HEADLESS_MODE = True
VIRTUAL_DISPLAY_SIZE = (1920, 1080)
WHATSAPP_URL = "https://web.whatsapp.com/"
GECKODRIVER_PATHS = [
    "/usr/local/bin/geckodriver",
    "/usr/bin/geckodriver",
    os.path.expanduser("~/bin/geckodriver"),
    os.path.expanduser("~/Downloads/geckodriver")
]

APP_DIR = get_application_directory()
SCREENSHOT_DIR = os.path.join(APP_DIR, "screenshots")
CONTACTS_JSON_FILE = os.path.join(APP_DIR, "api_response.json")
FEEDBACK_JSON_FILE = os.path.join(APP_DIR, "feedback.json")
VERSION_FILE = os.path.join(APP_DIR, "version.txt")
LOG_FILE = os.path.join(APP_DIR, "whatsapp_automation.log")

# Ensure directories exist
os.makedirs(APP_DIR, exist_ok=True)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

mobile_number = None  # Global variable to hold the mobile number

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

def sanitize_phone_number(phone_number):
    """Sanitize phone number to use as directory name"""
    return re.sub(r'[^a-zA-Z0-9]', '', str(phone_number))

def ensure_directory_exists(path):
    """Ensure a directory exists, create if it doesn't"""
    os.makedirs(path, exist_ok=True)
    return path

def get_user_directory(phone_number):
    """Get the directory path for a specific user based on phone number"""
    sanitized_number = sanitize_phone_number(phone_number)
    user_dir = os.path.join(os.getcwd(), "whatsapp_profiles", sanitized_number)
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
        logger.info(contacts)
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
        import platform
        driver = None
        
        try:
            # Virtual display is only needed on Linux, not Windows
            if platform.system() == "Linux" and HEADLESS_MODE:
                logger.info("Starting virtual display...")
                display = Display(visible=0, size=VIRTUAL_DISPLAY_SIZE, backend="xvfb")
                display.start()
                logger.info("Virtual display started successfully!")
            else:
                display = None
                logger.info("Running on Windows - no virtual display needed")
            
            # Get user-specific profile directory
            profile_dir = get_profile_directory(phone_number)
            logger.info(f"Using Firefox profile directory: {profile_dir}")
            
            # Set directory permissions (only on Linux/Mac)
            if platform.system() != "Windows":
                chmod_recursive(profile_dir)
            
            # Set up Firefox options
            firefox_options = FirefoxOptions()
            firefox_options.add_argument(f"--width={VIRTUAL_DISPLAY_SIZE[0]}")
            firefox_options.add_argument(f"--height={VIRTUAL_DISPLAY_SIZE[1]}")
            
            # Set profile directory
            firefox_options.add_argument("-profile")
            firefox_options.add_argument(profile_dir)
            
            # Enable headless mode on Windows if needed
            if HEADLESS_MODE:
                firefox_options.add_argument("--headless")
                logger.info("Running in headless mode")
            
            # Configure preferences
            firefox_options.set_preference("dom.webnotifications.enabled", False)
            firefox_options.set_preference("media.volume_scale", "0.0")
            firefox_options.set_preference("webdriver.log.level", "trace")
            
            # Set preferences to preserve session data
            firefox_options.set_preference("browser.sessionstore.resume_from_crash", True)
            firefox_options.set_preference("browser.sessionstore.restore_on_demand", False)
            firefox_options.set_preference("browser.startup.page", 3)  # Restore previous session
            firefox_options.set_preference("browser.startup.homepage", "about:blank")
            
            logger.info("Using webdriver-manager to get geckodriver...")
            
            # Create Firefox service using webdriver-manager
            service = Service(GeckoDriverManager().install())
            
            # Start Firefox with options
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
            if 'display' in locals() and display:
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
        logger.info(f"Starting to send messages to {len(contacts)} contacts...")
        logger.info(contacts)
        for i, contact in enumerate(contacts):
            phone_number = contact.get("mobile")
            message = contact.get("whatsappMessage")
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
            # driver.save_screenshot(screenshot_path)
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
        
        try:
            phone_input = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.XPATH, "//input[@aria-label='Type your phone number.']"))
            )
            logger.info("Found phone input field!")
        except TimeoutException:
            logger.info("Primary phone input selector failed, trying alternatives...")
            
            # Try multiple selectors for the phone input
            phone_input_selectors = [
                (By.XPATH, "//input[@aria-label='Type your phone number.']"),
                (By.XPATH, "//input[@type='text' and @value]"),
                (By.CSS_SELECTOR, "input[aria-label='Type your phone number.']"),
                (By.CSS_SELECTOR, "input.selectable-text"),
                (By.XPATH, "//input[@type='tel']"),
                (By.XPATH, "//input[contains(@placeholder, 'phone')]")
            ]
            
            phone_input = None
            for selector_type, selector in phone_input_selectors:
                try:
                    phone_input = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((selector_type, selector))
                    )
                    logger.info(f"Found phone input using selector: {selector}")
                    break
                except TimeoutException:
                    logger.debug(f"Could not find phone input with selector: {selector}")
            
            if not phone_input:
                logger.error("Could not find phone input field with any selector")
                return False
        
        # Click on the input field to focus it
        logger.info("Clicking on phone input field to focus it...")
        phone_input.click()
        time.sleep(0.5)

        # Get the current value
        current_value = phone_input.get_attribute("value")
        logger.info(f"Current phone input value: '{current_value}'")

        # Clear the input completely first
        logger.info("Clearing input field...")
        phone_input.clear()
        time.sleep(0.5)

        # Method 1: Try typing naturally first (most reliable)
        logger.info(f"Typing phone number naturally: +91 {phone_number}")
        try:
            phone_input.send_keys(f"+91 {phone_number}")
            time.sleep(1.5)  # Wait for validation to complete
            
            # Check if it worked
            final_value = phone_input.get_attribute("value")
            logger.info(f"Phone number after typing: '{final_value}'")
            
            # If typing didn't work, try JavaScript
            if final_value != f"+91 {phone_number}" and final_value != f"+91{phone_number}":
                logger.info("Natural typing failed, trying JavaScript method...")
                raise Exception("Fallback to JS")
                
        except Exception as e:
            logger.info("Using JavaScript fallback method...")
            driver.execute_script("""
                let input = arguments[0];
                let phoneNumber = arguments[1];
                
                // Clear and set value in one atomic operation
                input.focus();
                input.value = '+91 ' + phoneNumber;
                input.setAttribute('value', '+91 ' + phoneNumber);
                
                // Dispatch events to trigger validation
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            """, phone_input, phone_number)
            
            time.sleep(1.5)

        # Final verification
        final_value = phone_input.get_attribute("value")
        logger.info(f"Final phone input value: '{final_value}'")

        # Wait for validation to complete and check for persistent errors
        logger.info("Waiting for form validation to complete...")
        time.sleep(3)  # Give WhatsApp time to validate

        # Check for validation errors AFTER waiting
        validation_passed = False
        for attempt in range(5):  # Try 5 times with delays
            try:
                # Look specifically for the validation error message
                error_elements = driver.find_elements(By.XPATH, "//div[contains(text(), 'Valid phone number is required')]")
                
                if not error_elements:
                    logger.info(f"✅ No validation errors found (attempt {attempt + 1})")
                    validation_passed = True
                    break
                else:
                    logger.info(f"⚠️ Validation error still present (attempt {attempt + 1}), waiting...")
                    time.sleep(1)
            except:
                pass

        if not validation_passed:
            logger.error("❌ Phone number validation failed - error message persists")
            # Take screenshot to debug
            error_screenshot = f"screenshots/validation_error_{int(time.time())}.png"
            # driver.save_screenshot(error_screenshot)
            logger.info(f"📸 Error screenshot: {error_screenshot}")
            return False

        # Double-check that the Next button is enabled/clickable
        try:
            next_button_check = driver.find_element(By.XPATH, "//button[.//div[contains(text(), 'Next')]]")
            if next_button_check.is_enabled():
                logger.info("✅ Next button is enabled")
            else:
                logger.warning("⚠️ Next button is disabled - validation may have failed")
                return False
        except:
            logger.warning("Could not verify Next button state")

        logger.info("✅ Phone number validation completed successfully!")

        # Take screenshot for debugging
        screenshot_path = f"screenshots/phone_validated_{int(time.time())}.png"
        os.makedirs("screenshots", exist_ok=True)
        # driver.save_screenshot(screenshot_path)
        logger.info(f"📸 Screenshot saved: {screenshot_path}")
        
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
        screenshot_path = f"screenshots/next_{int(time.time())}.png"
        os.makedirs("screenshots", exist_ok=True)
        # driver.save_screenshot(screenshot_path)
        logger.info(f"📸 Screenshot saved: {screenshot_path}")
        
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
        

class SessionManager:
    """Helper class to manage session validation across the app"""
    
    @staticmethod
    def is_api_error_auth_related(response_code, response_data=None):
        """Check if API error indicates authentication issues"""
        auth_error_codes = [401, 403]
        
        if response_code in auth_error_codes:
            return True
            
        # Check response data for auth-related messages
        if response_data and isinstance(response_data, dict):
            error_msg = response_data.get('message', '').lower()
            auth_keywords = ['unauthorized', 'token', 'expired', 'invalid', 'authentication']
            return any(keyword in error_msg for keyword in auth_keywords)
        
        return False
    
    @staticmethod
    def handle_api_call(func, *args, **kwargs):
        """Wrapper to handle API calls with session validation"""
        try:
            return func(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            if hasattr(e, 'response') and e.response:
                if SessionManager.is_api_error_auth_related(e.response.status_code):
                    raise SessionExpiredError("Session expired")
            raise


class SessionExpiredError(Exception):
    """Custom exception for expired sessions"""
    pass


class LoginApp:
    def __init__(self, root):
        self.root = root
        self.root.title("LeadsCruise Login")
        self.root.geometry("400x350")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.minimize_to_tray)

        # Tray icon reference
        self.tray_icon = None
        # User data from login
        self.user_data = None
        
        # Persistent login configuration
        self.app_name = "LeadsCruise"
        self.config_dir = os.path.join(os.path.expanduser("~"), ".leadscruise")
        self.token_file = os.path.join(self.config_dir, "session.dat")
        
        # Create config directory if it doesn't exist
        os.makedirs(self.config_dir, exist_ok=True)

        # Center the window
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
        
        # Login API Configuration
        self.login_url = "https://api.leadscruise.com/api/login"
        
        # Setup Login GUI
        self.setup_login_gui()
        
        # Try auto-login after a short delay to ensure GUI is ready
        self.root.after(100, self.try_auto_login)
        
        # Add a button to clear saved data for debugging
        self.add_debug_button()

    def get_encryption_key(self):
        """Get or create encryption key for storing tokens securely"""
        try:
            # Try to get existing key from keyring
            key_str = keyring.get_password(self.app_name, "encryption_key")
            if key_str:
                return key_str.encode()
            else:
                # Generate new key and store it
                key = Fernet.generate_key()
                keyring.set_password(self.app_name, "encryption_key", key.decode())
                return key
        except Exception as e:
            print(f"Keyring error: {e}")
            # Fallback: use a simple key (less secure)
            fallback_key = base64.urlsafe_b64encode(b"leadscruise_key_2024_fallback_secret"[:32])
            return fallback_key

    def save_login_data(self, user_data):
        """Save encrypted login data to file"""
        try:
            print("💾 Saving login data...")
            key = self.get_encryption_key()
            cipher = Fernet(key)
            
            # Add expiry time (e.g., 7 days for local validation)
            expiry_time = datetime.now() + timedelta(days=7)
            
            data_to_save = {
                **user_data,
                'expiry_time': expiry_time.isoformat(),
                'saved_at': datetime.now().isoformat(),
                'app_version': '1.0'  # For future compatibility
            }
            
            print(f"📊 Data to save: {list(data_to_save.keys())}")
            print(f"⏰ Expires: {expiry_time}")
            
            # Encrypt and save
            encrypted_data = cipher.encrypt(json.dumps(data_to_save).encode())
            
            os.makedirs(os.path.dirname(self.token_file), exist_ok=True)
            
            with open(self.token_file, 'wb') as f:
                f.write(encrypted_data)
                
            print(f"✅ Login data saved to: {self.token_file}")
            self.log_to_response("🟢 Login data saved securely")
            
        except Exception as e:
            print(f"❌ Error saving login data: {e}")

    def load_login_data(self):
        """Load and decrypt saved login data"""
        try:
            if not os.path.exists(self.token_file):
                print(f"📁 No session file found at: {self.token_file}")
                return None
                
            print(f"📁 Loading session from: {self.token_file}")
            key = self.get_encryption_key()
            cipher = Fernet(key)
            
            with open(self.token_file, 'rb') as f:
                encrypted_data = f.read()
                
            print(f"📊 Encrypted data size: {len(encrypted_data)} bytes")
            
            # Decrypt data
            decrypted_data = cipher.decrypt(encrypted_data)
            login_data = json.loads(decrypted_data.decode())
            
            print("🔓 Successfully decrypted session data")
            
            # Check if token is expired
            if 'expiry_time' in login_data:
                expiry_time = datetime.fromisoformat(login_data['expiry_time'])
                time_left = expiry_time - datetime.now()
                print(f"⏰ Session expires in: {time_left}")
                
                if datetime.now() > expiry_time:
                    print("❌ Saved login data has expired")
                    self.clear_saved_login()
                    return None
            else:
                print("⚠️ No expiry time found in saved data")
                
            return login_data
            
        except Exception as e:
            print(f"❌ Error loading login data: {e}")
            # Clear corrupted data
            self.clear_saved_login()
            return None

    def clear_saved_login(self):
        """Clear saved login data"""
        try:
            if os.path.exists(self.token_file):
                os.remove(self.token_file)
                print(f"🗑️ Removed session file: {self.token_file}")
            
            try:
                keyring.delete_password(self.app_name, "encryption_key")
                print("🗑️ Removed encryption key from keyring")
            except keyring.errors.PasswordDeleteError:
                print("⚠️ No encryption key found in keyring")
                
            print("✅ Cleared all saved login data")
        except Exception as e:
            print(f"❌ Error clearing login data: {e}")

    def is_session_valid(self, saved_data):
        """Check if saved session is still valid based on local criteria"""
        try:
            print("🔍 Validating session data...")
            
            # Check if we have required data
            required_fields = ['token', 'email', 'expiry_time']
            missing_fields = [field for field in required_fields if field not in saved_data]
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
            
            print("✅ All required fields present")
            
            # Check expiration
            expiry_time = datetime.fromisoformat(saved_data['expiry_time'])
            now = datetime.now()
            if now > expiry_time:
                print(f"❌ Session expired. Now: {now}, Expiry: {expiry_time}")
                return False
            
            time_left = expiry_time - now
            print(f"✅ Session valid for: {time_left}")
            
            # Check if token looks valid (basic format check)
            token = saved_data.get('token', '')
            if len(token) < 10:  # Basic token length check
                print(f"❌ Token too short: {len(token)} characters")
                return False
                
            print(f"✅ Token format valid: {len(token)} characters")
            print("✅ Session validation passed")
            return True
            
        except Exception as e:
            print(f"❌ Session validation error: {e}")
            return False

    def try_auto_login(self):
        global through_logout
        """Try to automatically log in using saved credentials"""
        print("🔍 Checking for saved login data...")
        saved_data = self.load_login_data()
        
        if not through_logout and saved_data:
            print(f"✅ Found saved data for: {saved_data.get('email', 'unknown')}")
            print(f"🕐 Saved at: {saved_data.get('saved_at', 'unknown')}")
            print(f"⏰ Expires at: {saved_data.get('expiry_time', 'unknown')}")
            print(f"📊 Saved data keys: {list(saved_data.keys())}")
            
            token = saved_data.get('token')
            if token:
                print(f"🔐 Token found: {token[:20]}..." if len(token) > 20 else f"🔐 Token found: {token}")
                self.update_status("Verifying saved session...")
                
                # Hide login form during auto-login
                self.hide_login_form()
                
                # Run session verification in separate thread
                threading.Thread(
                    target=self._verify_and_login, 
                    args=(saved_data,), 
                    daemon=True
                ).start()
            else:
                print("❌ No token in saved data")
                print("🗑️ Clearing corrupted session data...")
                self.clear_saved_login()
                self.update_status("Please log in")
        else:
            print("❌ No saved login data found")
            self.update_status("Please log in")

    def _verify_and_login(self, saved_data):
        """Verify session and auto-login in background thread"""
        print("🔍 Validating saved session...")
        
        if self.is_session_valid(saved_data):
            print("✅ Session is valid, proceeding with auto-login...")
            # Session appears valid, proceed with auto-login
            self.user_data = saved_data
            self.root.after(0, lambda: self.update_status("Auto-login successful!"))
            # Add a small delay before opening main app
            self.root.after(500, self.open_main_app)
            self.log_to_response("🟢 Auto-login successful")
        else:
            print("❌ Session validation failed")
            # Session is invalid, clear saved data and show login form
            self.clear_saved_login()
            self.root.after(0, lambda: self.update_status("Session expired. Please log in again."))
            self.root.after(0, self.show_login_form)
            print("Saved session is invalid, manual login required")

    def minimize_to_tray(self):
        """Hide the window and show a tray icon"""
        self.root.withdraw()  # Hide the main window
        if not self.tray_icon:
            self.create_tray_icon()

        # Run tray icon in a separate thread to avoid blocking Tkinter mainloop
        threading.Thread(target=self.tray_icon.run, daemon=True).start()
        self.log_to_response("🟡 App minimized to tray and running in background")

    def create_tray_icon(self):
        """Create a simple tray icon with pystray"""
        try:
            # Generate a simple icon dynamically
            image = Image.new('RGB', (64, 64), color=(0, 122, 204))
            draw = ImageDraw.Draw(image)
            draw.rectangle([16, 16, 48, 48], fill=(255, 255, 255))

            menu = pystray.Menu(
                pystray.MenuItem("Show App", self.show_window),
                pystray.MenuItem("Logout", self.logout_user),
                pystray.MenuItem("Exit", self.quit_app)
            )
            self.tray_icon = pystray.Icon("LeadFetcher", image, "LeadFetcher - Running", menu)
        except Exception as e:
            self.log_to_response(f"❌ Failed to create tray icon: {e}")
            self.tray_icon = None

    def logout_user(self, icon=None, item=None):
        """Logout user and clear saved data"""
        self.clear_saved_login()
        if self.tray_icon:
            self.tray_icon.stop()
            self.tray_icon = None
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        self.update_status("Logged out. Please log in again.")
        self.log_to_response("🔴 User logged out")

    def show_window(self, icon=None, item=None):
        """Restore the window from tray"""
        if self.tray_icon:
            self.tray_icon.stop()  # Remove tray icon
            self.tray_icon = None
        self.root.deiconify()  # Show the window
        self.root.lift()
        self.root.focus_force()
        self.log_to_response("🟢 App restored from tray")

    def quit_app(self, icon=None, item=None):
        """Completely exit the application"""
        if self.tray_icon:
            self.tray_icon.stop()
        self.root.destroy()

    def log_to_response(self, message):
        """Helper method for logging (if you have a response area)"""
        print(message)  # For now, just print. You can connect this to your GUI if needed
        
    def setup_login_gui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Logo/Title
        title_label = ttk.Label(main_frame, text="LeadsCruise", 
                               font=("Arial", 20, "bold"))
        title_label.pack(pady=(0, 10))
        
        subtitle_label = ttk.Label(main_frame, text="Lead Management System", 
                                  font=("Arial", 12))
        subtitle_label.pack(pady=(0, 20))
        
        # Email
        email_frame = ttk.Frame(main_frame)
        email_frame.pack(fill=tk.X, pady=5)
        ttk.Label(email_frame, text="Email:").pack(anchor=tk.W)
        self.email_var = tk.StringVar()
        self.email_entry = ttk.Entry(email_frame, textvariable=self.email_var, width=30)
        self.email_entry.pack(fill=tk.X, pady=5)
        
        # Password
        password_frame = ttk.Frame(main_frame)
        password_frame.pack(fill=tk.X, pady=5)
        ttk.Label(password_frame, text="Password:").pack(anchor=tk.W)
        self.password_var = tk.StringVar()
        self.password_entry = ttk.Entry(password_frame, textvariable=self.password_var, width=30, show="*")
        self.password_entry.pack(fill=tk.X, pady=5)
        
        # Show Password Checkbox
        self.show_password_var = tk.BooleanVar()
        show_password_cb = ttk.Checkbutton(password_frame, text="Show Password", 
                                          variable=self.show_password_var,
                                          command=self.toggle_password_visibility)
        show_password_cb.pack(anchor=tk.W, pady=5)
        
        # Remember Me Checkbox
        self.remember_me_var = tk.BooleanVar(value=True)  # Default to True
        remember_me_cb = ttk.Checkbutton(password_frame, text="Remember me", 
                                        variable=self.remember_me_var)
        remember_me_cb.pack(anchor=tk.W, pady=5)
        
        # Login Button
        self.login_button = ttk.Button(main_frame, text="Login", 
                                      command=self.login_threaded)
        self.login_button.pack(pady=10)
        
        # Logout Button (initially hidden)
        self.logout_button = ttk.Button(main_frame, text="Logout & Clear Data", 
                                       command=self.manual_logout)
        
        # Status label
        self.status_var = tk.StringVar(value="Enter your credentials to login")
        status_label = ttk.Label(main_frame, textvariable=self.status_var)
        status_label.pack(pady=5)
        
        # Progress bar (hidden initially)
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate', length=300)
        
        # Demo credentials hint
        self.hint_frame = ttk.Frame(main_frame)
        self.hint_frame.pack(pady=10)
        ttk.Label(self.hint_frame, text="Demo Credentials:", font=("Arial", 10, "bold")).pack()
        ttk.Label(self.hint_frame, text="Email: demo@leadscruise.com").pack()
        ttk.Label(self.hint_frame, text="Password: demo123").pack()
        
        # Store references to main components for hiding/showing
        self.main_frame = main_frame
        self.email_frame = email_frame
        self.password_frame = password_frame

    def add_debug_button(self):
        """Add debug button to clear saved data"""
        debug_frame = ttk.Frame(self.main_frame)
        debug_frame.pack(pady=5)
        
        clear_button = ttk.Button(debug_frame, text="Clear Saved Data", 
                                 command=self.debug_clear_data)
        clear_button.pack()

    def debug_clear_data(self):
        """Debug function to clear saved data"""
        self.clear_saved_login()
        messagebox.showinfo("Debug", "Saved login data cleared. Please login again.")
        self.update_status("Please log in")

    def hide_login_form(self):
        """Hide login form during auto-login"""
        try:
            self.email_frame.pack_forget()
            self.password_frame.pack_forget()
            self.login_button.pack_forget()
            self.hint_frame.pack_forget()
            if hasattr(self, 'logout_button'):
                self.logout_button.pack_forget()
        except:
            pass

    def show_login_form(self):
        """Show login form if auto-login fails"""
        try:
            self.email_frame.pack(fill=tk.X, pady=5)
            self.password_frame.pack(fill=tk.X, pady=5)
            self.login_button.pack(pady=10)
            self.hint_frame.pack(pady=10)
        except:
            pass

    def manual_logout(self):
        """Manual logout from the login screen"""
        self.clear_saved_login()
        self.logout_button.pack_forget()
        self.update_status("Logged out successfully. Please log in again.")

    def toggle_password_visibility(self):
        if self.show_password_var.get():
            self.password_entry.config(show='')
        else:
            self.password_entry.config(show='*')
    
    def login_threaded(self):
        """Run login in a separate thread to prevent GUI freezing"""
        if not hasattr(self, '_login_thread') or not self._login_thread.is_alive():
            self._login_thread = threading.Thread(target=self.login)
            self._login_thread.daemon = True
            self._login_thread.start()
    
    def login(self):
        """Authenticate user with the LeadsCruise API"""
        email = self.email_var.get().strip()
        password = self.password_var.get()
        
        if not email or not password:
            self.update_status("Error: Email and password are required!")
            messagebox.showerror("Error", "Please enter both email and password!")
            return
            
        # Update GUI safely
        try:
            if self.root.winfo_exists():
                self.root.after(0, lambda: self.login_button.config(state='disabled'))
                self.root.after(0, lambda: self.progress.pack(pady=5))
                self.root.after(0, lambda: self.progress.start())
                self.root.after(0, lambda: self.update_status("Authenticating..."))
        except tk.TclError:
            # Window destroyed, exit login process
            return
        
        try:
            # Prepare login data
            login_data = {
                "email": email,
                "password": password,
                "emailVerified": False
            }
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadFetcher-Client/1.0'
            }
            
            # Make API request
            response = requests.post(
                self.login_url, 
                json=login_data, 
                headers=headers, 
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success'):
                        # Extract user info
                        user_data = data.get('user', {})
                        token = data.get('token')
                        session_id = data.get('sessionId')
                        mobile_number = user_data.get('mobileNumber', '')
                        
                        # Store user data for main app
                        self.user_data = {
                            'email': user_data.get('email', ''),
                            'role': user_data.get('role', ''),
                            'mobileNumber': mobile_number,
                            'token': token,
                            'sessionId': session_id
                        }
                        
                        # Debug: Check if token exists
                        print(f"🔐 Token received: {token[:20] if token else 'None'}..." if token else "❌ No token received from API")
                        print(f"📊 User data keys: {list(self.user_data.keys())}")
                        
                        # Save login data if "Remember me" is checked
                        if self.remember_me_var.get():
                            print("💾 Remember me is checked, saving login data...")
                            self.save_login_data(self.user_data)
                        else:
                            print("⚠️ Remember me not checked, skipping save")
                        
                        # Update status
                        self.root.after(0, lambda: self.update_status("Login successful!"))
                        
                        # Close login window and open main app
                        self.root.after(0, self.open_main_app)
                        
                    else:
                        error_msg = data.get('message', 'Login failed')
                        self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
                        self.root.after(0, lambda: messagebox.showerror("Login Failed", error_msg))
                        
                except json.JSONDecodeError as e:
                    error_msg = f"Failed to parse response: {str(e)}"
                    self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
                    
            else:
                error_msg = f"HTTP {response.status_code}: {response.reason}"
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', error_msg)
                except:
                    pass
                self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
                self.root.after(0, lambda: messagebox.showerror("Login Failed", error_msg))
                
        except requests.exceptions.Timeout:
            error_msg = "Request timeout (30 seconds)"
            self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
            
        except requests.exceptions.ConnectionError:
            error_msg = "Connection error - check internet connection"
            self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.root.after(0, lambda: self.update_status(f"Error: {error_msg}"))
            
        finally:
            # Re-enable GUI safely
            try:
                if self.root.winfo_exists():
                    self.root.after(0, self._cleanup_login_gui)
            except tk.TclError:
                # Window already destroyed
                pass

    def _cleanup_login_gui(self):
        """Safely cleanup login GUI elements"""
        try:
            self.progress.stop()
            self.progress.pack_forget()
            self.login_button.config(state='normal')
        except (tk.TclError, AttributeError):
            # GUI already destroyed or doesn't exist
            pass
    
    def open_main_app(self):
        """Open the main application after successful login"""
        self.root.destroy()  # Close login window
        
        # Create main application window
        main_root = tk.Tk()
        # Initialize with error handling for invalid sessions
        try:
            # You'll need to import your LeadFetcherApp class
            app = LeadFetcherApp(main_root, self.user_data)
            
            # Add session validation error handler
            def handle_session_error():
                """Handle session errors during main app usage"""
                messagebox.showerror("Session Expired", 
                                   "Your session has expired. Please log in again.")
                main_root.destroy()
                # Restart login app
                self.clear_saved_login()
                login_root = tk.Tk()
                LoginApp(login_root)
                login_root.mainloop()
            
            # You can pass this handler to your main app if needed
            if hasattr(app, 'set_session_error_handler'):
                app.set_session_error_handler(handle_session_error)
            
        except Exception as e:
            print(f"Error initializing main app: {e}")
            messagebox.showerror("Error", "Failed to initialize main application")
            main_root.destroy()
            return
        
        # Handle window closing
        def on_closing():
            if hasattr(app, 'auto_fetch_timer') and app.auto_fetch_timer:
                main_root.after_cancel(app.auto_fetch_timer)
            main_root.quit()
            main_root.destroy()
            
        main_root.protocol("WM_DELETE_WINDOW", on_closing)
        
        # Start the GUI event loop
        main_root.mainloop()
        
    def update_status(self, message):
        """Update status label"""
        self.status_var.set(message)

class TextboxLogHandler(logging.Handler):
    """Custom logging handler that outputs to the GUI textbox"""
    def __init__(self, app):
        super().__init__()
        self.app = app
        
    def emit(self, record):
        msg = self.format(record)
        # Use thread-safe method to append to GUI
        if hasattr(self.app, 'root') and self.app.root:
            try:
                self.app.log_to_response(msg)
            except:
                pass  # Ignore errors if GUI is destroyed

class LeadFetcherApp:
    def __init__(self, root, user_data):
        self.root = root
        self.root.title("Lead Fetcher")
        self.root.geometry("800x600")
        self.root.resizable(True, True)
        
        # Initialize tray-related attributes first
        self.tray_icon = None
        self.tray_thread = None
        self.is_minimized_to_tray = False
        self.is_closing = False
        self.force_quit = False
        
        # NEW: Message queue for thread communication
        self.message_queue = queue.Queue()
        
        print(f"Tray available: {TRAY_AVAILABLE}")
        
        self.user_data = user_data
        self.token = user_data.get('token', '')
        self.session_id = user_data.get('sessionId', '')
        self.user_email = user_data.get('email', '')
        self.user_role = user_data.get('role', '')
        
        # API Configuration
        self.base_url = "https://api.leadscruise.com/api/get-user-leads-with-message/"
        self.callback_url = "https://api.leadscruise.com/api/data-received-confirmation"
        self.default_mobile = user_data.get('mobileNumber', '')
        
        # Track first auto-fetch
        self.is_first_auto_fetch = True
        
        # Track running WhatsApp automation threads
        self.whatsapp_threads = []
        
        # Auto-fetch timer
        self.auto_fetch_timer = None
        
        # Setup GUI first
        self.setup_gui()
        
        # Setup logging (with error handling)
        try:
            gui_handler = TextboxLogHandler(self)
            gui_handler.setLevel(logging.INFO)
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            gui_handler.setFormatter(formatter)
            # Get the logger (you'll need to define this globally in your main script)
            logger.addHandler(gui_handler)
        except:
            pass
        
        # Show initial message
        self.log_to_response("🔄 Application starting...")
        if TRAY_AVAILABLE:
            self.log_to_response("✅ Tray functionality available:")
            self.log_to_response("   • Click X to minimize to tray")
            self.log_to_response("   • Double-click tray icon to restore")
            self.log_to_response("   • Right-click tray for menu")
            self.log_to_response("   • Ctrl+Alt+L to restore from anywhere")
        else:
            self.log_to_response("⚠️ Tray functionality not available")
        
        # Override destroy method
        self._original_destroy = self.root.destroy
        self.root.destroy = self.custom_destroy
        
        # Set up close protocol
        self.root.protocol("WM_DELETE_WINDOW", self.on_window_close)
        
        # Add keyboard shortcut
        self.root.bind_all('<Control-Alt-KeyPress-l>', self.keyboard_restore)
        
        # NEW: Start message queue processor
        self.process_messages()
        
        print("✅ All handlers set up")

        # Start auto-fetch by default since checkbox is enabled
        if self.auto_fetch_var.get():
            self.start_auto_fetch()

        self.init_update_manager()

    def init_update_manager(self):
        """Initialize the update manager - call this in your __init__ method"""
        self.update_manager = GitHubUpdateManager(self)
        
        # Optional: Check for updates on startup (after 5 seconds)
        self.schedule_startup_update_check()

    def schedule_startup_update_check(self):
        """Schedule an update check 5 seconds after startup"""
        def startup_check():
            threading.Event().wait(5)  # Wait 5 seconds
            try:
                self.update_manager.check_for_updates(show_no_update_message=False)
            except Exception as e:
                self.log_to_response(f"Startup update check failed: {str(e)}")
        
        threading.Thread(target=startup_check, daemon=True).start()

    def check_for_updates_clicked(self):
        """Handle update check button click"""
        def check_thread():
            try:
                self.update_manager.check_for_updates(show_no_update_message=True)
            except Exception as e:
                self.log_to_response(f"Update check failed: {str(e)}")
                messagebox.showerror("Update Check Failed", f"Failed to check for updates:\n{str(e)}")
        
        threading.Thread(target=check_thread, daemon=True).start()

    def process_messages(self):
        """Process messages from other threads - keeps main loop alive"""
        try:
            while True:
                try:
                    message = self.message_queue.get_nowait()
                    self.handle_message(message)
                except queue.Empty:
                    break
        except:
            pass
        
        # Schedule next check - this keeps the main loop active
        self.root.after(100, self.process_messages)

    def handle_message(self, message):
        """Handle messages from other threads"""
        print(f"📨 Handling message: {message}")
        
        if message == "restore_window":
            self.restore_window_main_thread()
        elif message == "force_restore_window":
            self.force_restore_window_main_thread()
        elif message.startswith("log:"):
            _, text = message.split(":", 1)
            self.log_to_response(text)

    def send_message(self, message):
        """Send message from any thread to main thread"""
        try:
            self.message_queue.put(message)
        except:
            print(f"Failed to send message: {message}")

    def custom_destroy(self):
        """Custom destroy method"""
        print("🔴 custom_destroy called!")
        
        if self.force_quit:
            print("Force quit flag set, destroying window")
            self._original_destroy()
        else:
            print("Normal close attempted, handling with minimize/confirm")
            self.on_window_close()

    def on_window_close(self):
        """Handle window close event"""
        print(f"🔴 on_window_close called - force_quit: {self.force_quit}, is_closing: {self.is_closing}, is_minimized: {self.is_minimized_to_tray}")
        
        if self.force_quit:
            print("✅ Force quit enabled, allowing close")
            return True
        
        if self.is_closing:
            print("⚠️ Already handling close, preventing duplicate")
            return "break"
            
        # Check current window state
        try:
            current_state = self.root.state()
            print(f"📋 Current window state: {current_state}")
        except:
            print("❌ Cannot get window state")
            
        self.is_closing = True
        
        try:
            if TRAY_AVAILABLE:
                print("✅ Tray available, attempting minimize")
                self.log_to_response("🔄 Minimizing to tray...")
                # Don't reset is_closing here since minimize_to_tray will handle it
                self.minimize_to_tray()
                return "break"
            else:
                print("❌ Tray not available, showing confirmation")
                self.confirm_quit()
                return "break"
        except Exception as e:
            print(f"❌ Error in on_window_close: {e}")
            self.log_to_response(f"❌ Error: {e}")
            self.confirm_quit()
            return "break"

    def create_tray_icon(self):
        """Create tray icon"""
        if not TRAY_AVAILABLE:
            return False
            
        try:
            print("🔧 Creating tray icon...")
            
            # Create icon image
            image = Image.new('RGB', (64, 64), color=(0, 122, 204))
            draw = ImageDraw.Draw(image)
            draw.rectangle([16, 16, 48, 48], fill=(255, 255, 255))
            
            try:
                draw.text((20, 25), "LF", fill=(0, 122, 204))
            except:
                pass

            menu = pystray.Menu(
                pystray.MenuItem("Show App", self.show_window),
                pystray.MenuItem("Force Show (Backup)", self.force_show_window),
                pystray.MenuItem("---", None),
                pystray.MenuItem("Quit", self.quit_app)
            )
            
            self.tray_icon = pystray.Icon("LeadFetcher", image, "LeadFetcher - Running", menu)
            self.tray_icon.default_action = self.show_window
            
            print("✅ Tray icon created")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create tray icon: {e}")
            self.tray_icon = None
            return False

    def minimize_to_tray(self):
        """Minimize to tray - improved version"""
        print("🔄 minimize_to_tray called")
        
        if not TRAY_AVAILABLE:
            print("❌ Tray not available")
            self.confirm_quit()
            return
        
        if self.is_minimized_to_tray:
            print("⚠️ Already minimized to tray")
            return
            
        try:
            if not self.tray_icon and not self.create_tray_icon():
                print("❌ Failed to create tray icon")
                self.confirm_quit()
                return
            
            # Set the flag BEFORE hiding the window
            self.is_minimized_to_tray = True
            self.is_closing = False  # Reset this flag since we're not actually closing
            
            print("🔄 Hiding window...")
            self.root.withdraw()  # Hide from taskbar
            
            # Start tray in a way that doesn't interfere with main loop
            def run_tray():
                try:
                    print("🔄 Starting tray icon...")
                    # Try run_detached first (newer pystray)
                    if hasattr(self.tray_icon, 'run_detached'):
                        self.tray_icon.run_detached()
                        print("✅ Tray started in detached mode")
                    else:
                        # Fallback for older pystray versions
                        self.tray_icon.run()
                        print("✅ Tray started in normal mode")
                except Exception as e:
                    print(f"❌ Tray error: {e}")
                    # If tray fails, restore the window
                    self.send_message("log:❌ Tray failed, restoring window")
                    self.send_message("restore_window")
            
            # Stop existing tray thread
            if self.tray_thread and self.tray_thread.is_alive():
                if self.tray_icon:
                    try:
                        self.tray_icon.stop()
                    except:
                        pass
            
            self.tray_thread = threading.Thread(target=run_tray, daemon=True)
            self.tray_thread.start()
            
            self.log_to_response("✅ Minimized to tray! Double-click or right-click tray icon.")
            print("✅ Successfully minimized to tray")
            
        except Exception as e:
            print(f"❌ Minimize failed: {e}")
            # Reset flags if minimize fails
            self.is_minimized_to_tray = False
            self.is_closing = False
            self.log_to_response(f"❌ Tray failed: {e}")
            self.confirm_quit()

    def show_window(self, icon=None, item=None):
        """Show window from tray - simplified version"""
        print("🔄 show_window called")
        
        if not self.is_minimized_to_tray:
            return
        
        try:
            # Send message to main thread to restore
            self.send_message("restore_window")
            print("✅ Restore message sent to main thread")
            
        except Exception as e:
            print(f"❌ Error in show_window: {e}")

    def force_show_window(self, icon=None, item=None):
        """Force show window - backup method"""
        print("🔄 force_show_window called")
        self.send_message("force_restore_window")

    def restore_window_main_thread(self):
        """Restore window - runs in main thread"""
        print("🔄 restore_window_main_thread called")
        
        if not self.is_minimized_to_tray:
            print("⚠️ Not minimized to tray, ignoring restore request")
            return
            
        try:
            # Stop tray icon
            if self.tray_icon:
                print("🔄 Stopping tray icon...")
                def stop_tray():
                    try:
                        self.tray_icon.stop()
                    except:
                        pass
                threading.Thread(target=stop_tray, daemon=True).start()
                self.tray_icon = None
            
            # Reset flags
            self.is_minimized_to_tray = False
            self.is_closing = False  # IMPORTANT: Reset this flag
            self.force_quit = False   # IMPORTANT: Reset this flag too
            
            print("🔄 Restoring window in main thread...")
            
            # Restore window
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
            
            # Make it topmost briefly
            self.root.attributes('-topmost', True)
            self.root.after(200, lambda: self.root.attributes('-topmost', False))
            
            # CRITICAL: Re-establish the close protocol after restoration
            print("🔧 Re-establishing close protocol...")
            self.root.protocol("WM_DELETE_WINDOW", self.on_window_close)
            
            # Verify the protocol is set
            current_protocol = self.root.protocol("WM_DELETE_WINDOW")
            print(f"✅ Close protocol verified: {current_protocol}")
            
            self.log_to_response("✅ Window restored from tray!")
            print("✅ Window restore successful")
            
        except Exception as e:
            print(f"❌ Restore failed: {e}")
            self.log_to_response(f"❌ Restore failed: {e}")

    def force_restore_window_main_thread(self):
        """Force restore - runs in main thread"""
        print("🔄 force_restore_window_main_thread called")
        
        try:
            # Force stop tray
            if self.tray_icon:
                try:
                    self.tray_icon.stop()
                except:
                    pass
                self.tray_icon = None
            
            # Reset ALL flags
            self.is_minimized_to_tray = False
            self.is_closing = False
            self.force_quit = False
            
            # Try multiple restore methods
            methods = [
                lambda: self.root.deiconify(),
                lambda: (self.root.state('normal'), self.root.deiconify()),
                lambda: (self.root.wm_deiconify(), self.root.lift()),
            ]
            
            success = False
            for i, method in enumerate(methods):
                try:
                    print(f"Trying force method {i+1}...")
                    method()
                    self.root.lift()
                    self.root.focus_force()
                    self.root.attributes('-topmost', True)
                    self.root.after(200, lambda: self.root.attributes('-topmost', False))
                    print(f"✅ Force method {i+1} successful")
                    success = True
                    break
                except Exception as e:
                    print(f"❌ Force method {i+1} failed: {e}")
            
            if success:
                # CRITICAL: Re-establish protocols after force restore
                print("🔧 Re-establishing protocols after force restore...")
                self.root.protocol("WM_DELETE_WINDOW", self.on_window_close)
                print(f"✅ Protocol re-established: {self.root.protocol('WM_DELETE_WINDOW')}")
                
                self.log_to_response("✅ Window force-restored!")
            else:
                self.log_to_response("❌ All restore methods failed")
                
        except Exception as e:
            print(f"❌ Force restore error: {e}")

    def keyboard_restore(self, event=None):
        """Keyboard shortcut restore"""
        print("🔄 Keyboard shortcut (Ctrl+Alt+L)")
        if self.is_minimized_to_tray:
            self.send_message("force_restore_window")
        else:
            try:
                self.root.lift()
                self.root.focus_force()
            except:
                pass

    def confirm_quit(self):
        """Show quit confirmation"""
        print("🔄 confirm_quit called")
        
        try:
            import tkinter.messagebox as msgbox
            
            # Make sure window is visible
            try:
                if self.root.state() == 'withdrawn':
                    self.root.deiconify()
                self.root.lift()
                self.root.attributes('-topmost', True)
                self.root.after(100, lambda: self.root.attributes('-topmost', False))
            except:
                pass
            
            self.log_to_response("❓ Showing quit confirmation...")
            
            result = msgbox.askyesno(
                "Quit Application", 
                "Are you sure you want to quit?\n\n"
                "This will close the application completely.",
                parent=self.root
            )
            
            if result:
                self.quit_app()
            else:
                self.is_closing = False
                self.log_to_response("❌ Quit cancelled")
                
        except Exception as e:
            print(f"❌ Error in confirm_quit: {e}")
            self.is_closing = False

    def quit_app(self, icon=None, item=None):
        """Quit application"""
        print("🔄 quit_app called")
        
        try:
            self.force_quit = True
            
            # Stop auto-fetch
            if hasattr(self, 'auto_fetch_timer') and self.auto_fetch_timer:
                self.root.after_cancel(self.auto_fetch_timer)
                
            # Stop tray
            if self.tray_icon:
                try:
                    self.tray_icon.stop()
                except:
                    pass
                self.tray_icon = None
                
            self.is_minimized_to_tray = False
            
            try:
                self.log_to_response("❌ Application closing...")
            except:
                pass
            
            # Restore original destroy and quit
            self.root.destroy = self._original_destroy
            self.root.quit()
            self.root.destroy()
            
        except Exception as e:
            print(f"❌ Error during quit: {e}")
        finally:
            sys.exit(0)

    def log_to_response(self, message):
        """Log to GUI"""
        try:
            if hasattr(self, 'response_text') and self.response_text:
                self.response_text.insert(tk.END, f"{message}\n")
                self.response_text.see(tk.END)
                self.root.update_idletasks()
        except:
            pass
        print(f"LOG: {message}")
        
    def setup_gui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # Title with user info
        title_frame = ttk.Frame(main_frame)
        title_frame.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        title_label = ttk.Label(title_frame, text="Leads Fetcher", 
                               font=("Arial", 16, "bold"))
        title_label.pack()
        
        user_info_label = ttk.Label(title_frame, 
                                   text=f"Logged in as: {self.user_email} ({self.user_role})",
                                   font=("Arial", 10))
        user_info_label.pack()
        
        # Mobile number input
        ttk.Label(main_frame, text="Mobile Number:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.mobile_var = tk.StringVar(value=self.default_mobile)
        mobile_entry = ttk.Entry(main_frame, textvariable=self.mobile_var, width=20)
        mobile_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # Callback URL input
        ttk.Label(main_frame, text="Callback URL:").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.callback_var = tk.StringVar(value=self.callback_url)
        callback_entry = ttk.Entry(main_frame, textvariable=self.callback_var, width=50)
        callback_entry.grid(row=2, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # Fetch button
        self.fetch_button = ttk.Button(main_frame, text="Fetch Leads Data", 
                                      command=self.fetch_data_threaded)
        self.fetch_button.grid(row=3, column=0, pady=5)
        
        # Send confirmation checkbox
        self.send_confirmation_var = tk.BooleanVar(value=True)
        confirm_cb = ttk.Checkbutton(main_frame, text="Send confirmation when data received", 
                                    variable=self.send_confirmation_var)
        confirm_cb.grid(row=3, column=1, columnspan=2, pady=5, sticky=tk.W, padx=(10, 0))
        
        # Status label
        self.status_var = tk.StringVar(value="Ready to fetch data...")
        status_label = ttk.Label(main_frame, textvariable=self.status_var)
        status_label.grid(row=4, column=0, columnspan=3, pady=10)
        
        # Progress bar
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # Response display
        ttk.Label(main_frame, text="API Response:").grid(row=6, column=0, sticky=(tk.W, tk.N), pady=(20, 5))
        
        # Text area for response
        self.response_text = scrolledtext.ScrolledText(main_frame, height=20, width=80)
        self.response_text.grid(row=7, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Configure grid weights for resizing
        main_frame.rowconfigure(7, weight=1)
        
        # Button frame
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=8, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=10)
        button_frame.columnconfigure(1, weight=1)
        
        # Clear button
        clear_button = ttk.Button(button_frame, text="Clear Response", command=self.clear_response)
        clear_button.grid(row=0, column=0, sticky=tk.W)
        
        # Auto-fetch checkbox
        self.auto_fetch_var = tk.BooleanVar(value=True)
        auto_fetch_cb = ttk.Checkbutton(button_frame, text="Auto-fetch every 5 minutes", 
                                       variable=self.auto_fetch_var, 
                                       command=self.toggle_auto_fetch)
        auto_fetch_cb.grid(row=0, column=1, sticky=tk.W, padx=(20, 0))
        
        # Control buttons
        control_frame = ttk.Frame(button_frame)
        control_frame.grid(row=0, column=2, sticky=tk.E)

        # Store reference to control_frame for update button
        self.control_frame = control_frame

        # Test buttons
        ttk.Button(control_frame, text="Test Minimize", 
                command=self.minimize_to_tray).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Test Restore", 
                command=lambda: self.send_message("restore_window")).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Debug State", 
                command=self.debug_protocol_state).pack(side=tk.LEFT, padx=(0, 5))

        # NEW: Check Updates button
        ttk.Button(control_frame, text="Check Updates", 
                command=self.check_for_updates_clicked).pack(side=tk.LEFT, padx=(0, 5))

        ttk.Button(control_frame, text="Logout", 
                command=self.logout).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Force Quit", 
                command=self.quit_app).pack(side=tk.LEFT)

    def clear_response(self):
        """Clear response area"""
        try:
            self.response_text.delete(1.0, tk.END)
            self.log_to_response("✅ Cleared")
        except Exception as e:
            print(f"Error clearing: {e}")

    def debug_protocol_state(self):
        """Debug method to check protocol state"""
        try:
            current_protocol = self.root.protocol("WM_DELETE_WINDOW")
            window_state = self.root.state()
            
            debug_info = f"""
🔍 DEBUG INFO:
   • Close Protocol: {current_protocol}
   • Window State: {window_state}
   • force_quit: {self.force_quit}
   • is_closing: {self.is_closing}
   • is_minimized_to_tray: {self.is_minimized_to_tray}
   • Tray icon exists: {self.tray_icon is not None}
"""
            self.log_to_response(debug_info)
            print(debug_info)
            
        except Exception as e:
            error_msg = f"❌ Debug failed: {e}"
            self.log_to_response(error_msg)
            print(error_msg)



    def logout(self):
        """Logout and return to login screen"""
        global through_logout
        # Ask for confirmation since this will stop background processes
        result = messagebox.askyesno(
            "Logout Confirmation",
            "Logging out will stop all background processes.\n\n"
            "Are you sure you want to logout?"
        )
        
        if result:
            # Stop tray icon if running
            if self.tray_icon:
                self.tray_icon.stop()
                
            # Stop any auto-fetch
            if self.auto_fetch_timer:
                self.root.after_cancel(self.auto_fetch_timer)
                
            # Close current window
            self.root.destroy()
            through_logout = True
            # Reopen login window - You'll need to import LoginApp
            login_root = tk.Tk()
            login_app = LoginApp(login_root)
            login_root.mainloop()


    def fetch_data_threaded(self, is_auto_fetch=False):
        """Run fetch_data in a separate thread to prevent GUI freezing"""
        if not hasattr(self, '_fetch_thread') or not self._fetch_thread.is_alive():
            self._fetch_thread = threading.Thread(target=self.fetch_data, args=(is_auto_fetch,))
            self._fetch_thread.daemon = True
            self._fetch_thread.start()
    
    def fetch_data(self, is_auto_fetch=False):
        """Fetch data from the LeadsCruise API"""
        global mobile_number
        mobile = self.mobile_var.get().strip()
        
        if not mobile:
            self.update_status("Error: Mobile number is required!")
            if not is_auto_fetch:  # Only show error dialog for manual fetch
                messagebox.showerror("Error", "Please enter a mobile number!")
            return
        mobile_number = mobile  # Update global for logging
        
        # Update GUI
        self.root.after(0, lambda: self.fetch_button.config(state='disabled'))
        self.root.after(0, lambda: self.progress.start())
        
        # Different status messages for auto-fetch vs manual fetch
        if is_auto_fetch:
            self.root.after(0, lambda: self.update_status(f"Auto-fetching data for mobile: {mobile}..."))
        else:
            self.root.after(0, lambda: self.update_status(f"Fetching data for mobile: {mobile}..."))
        
        try:
            # Make API request
            url = f"{self.base_url}{mobile}"
            
            self.log_to_response(f"\n{'='*60}")
            fetch_type = "AUTO-FETCHING" if is_auto_fetch else "FETCHING"
            if is_auto_fetch and self.is_first_auto_fetch:
                fetch_type = "FIRST AUTO-FETCH"
            self.log_to_response(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {fetch_type} DATA")
            self.log_to_response(f"{'='*60}")
            self.log_to_response(f"URL: {url}")
            self.log_to_response(f"Mobile Number: {mobile}")
            self.log_to_response(f"User: {self.user_email} ({self.user_role})")
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadFetcher-Client/1.0',
                'Authorization': f'Bearer {self.token}',
                'X-Session-ID': self.session_id
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            
            # Log response details
            self.log_to_response(f"\nResponse Status Code: {response.status_code}")
            self.log_to_response(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Pretty print the JSON response
                    formatted_response = json.dumps(data, indent=2, ensure_ascii=False)
                    self.log_to_response(f"\nAPI Response Data:\n{formatted_response}")
                    
                    # Extract key information
                    if 'success' in data and data['success']:
                        total_leads = data.get('totalLeads', 0)
                        leads_count = len(data.get('leads', []))
                        
                        self.log_to_response(f"\n{'='*40}")
                        self.log_to_response(f"✅ DATA RECEIVED SUCCESSFULLY!")
                        self.log_to_response(f"Total Leads in Database: {total_leads}")
                        self.log_to_response(f"Leads Retrieved: {leads_count}")
                        self.log_to_response(f"{'='*40}")
                        
                        # Send confirmation only for:
                        # 1. Manual fetch with checkbox enabled
                        # 2. First auto-fetch with checkbox enabled
                        should_send_confirmation = (
                            not is_auto_fetch and self.send_confirmation_var.get()
                        ) or (
                            is_auto_fetch and self.is_first_auto_fetch and self.send_confirmation_var.get()
                        )
                        
                        if should_send_confirmation:
                            if is_auto_fetch and self.is_first_auto_fetch:
                                self.log_to_response("\n📋 FIRST AUTO-FETCH: Sending confirmation response")
                            self.send_confirmation_response(mobile, data)
                        elif is_auto_fetch and not self.is_first_auto_fetch:
                            self.log_to_response("\n📋 AUTO-FETCH: Skipping confirmation response (not first auto-fetch)")
                        
                        # Mark that first auto-fetch is complete
                        if is_auto_fetch and self.is_first_auto_fetch:
                            self.is_first_auto_fetch = False
                        
                        # Update status
                        if is_auto_fetch:
                            if self.is_first_auto_fetch:
                                self.root.after(0, lambda: self.update_status(
                                    f"✅ FIRST AUTO-FETCH: Received {leads_count} leads for {mobile}"))
                            else:
                                self.root.after(0, lambda: self.update_status(
                                    f"✅ AUTO-FETCH: Received {leads_count} leads for {mobile}"))
                        else:
                            self.root.after(0, lambda: self.update_status(
                                f"✅ SUCCESS: Received {leads_count} leads for {mobile}"))
                        
                        # Show success message only for manual fetch
                        if not is_auto_fetch:
                            self.root.after(0, lambda: messagebox.showinfo(
                                "Success", 
                                f"Data received successfully!\n"
                                f"Mobile: {mobile}\n"
                                f"Total leads: {total_leads}\n"
                                f"Retrieved: {leads_count} leads"
                            ))
                        
                    else:
                        error_msg = data.get('error', 'Unknown error')
                        self.log_to_response(f"\n❌ API Error: {error_msg}")
                        status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
                        self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} API Error: {error_msg}"))
                        
                except json.JSONDecodeError as e:
                    error_msg = f"Failed to parse JSON response: {str(e)}"
                    self.log_to_response(f"\n❌ {error_msg}")
                    self.log_to_response(f"Raw response: {response.text[:500]}...")
                    status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
                    self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} JSON Error: {str(e)}"))
                    
            else:
                error_msg = f"HTTP {response.status_code}: {response.reason}"
                self.log_to_response(f"\n❌ HTTP Error: {error_msg}")
                self.log_to_response(f"Response content: {response.text[:500]}...")
                status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
                self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} HTTP Error: {error_msg}"))
                
        except requests.exceptions.Timeout:
            error_msg = "Request timeout (30 seconds)"
            self.log_to_response(f"\n❌ Timeout Error: {error_msg}")
            status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
            self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} Timeout: {error_msg}"))
            
        except requests.exceptions.ConnectionError:
            error_msg = "Connection error - check internet connection"
            self.log_to_response(f"\n❌ Connection Error: {error_msg}")
            status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
            self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} Connection Error"))
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.log_to_response(f"\n❌ {error_msg}")
            status_prefix = "AUTO-FETCH" if is_auto_fetch else ""
            self.root.after(0, lambda: self.update_status(f"❌ {status_prefix} Error: {str(e)}"))
            
        finally:
            # Re-enable GUI
            self.root.after(0, lambda: self.progress.stop())
            self.root.after(0, lambda: self.fetch_button.config(state='normal'))
    
    def send_confirmation_response(self, mobile, received_data):
        """Send confirmation back to the server that data was received"""
        try:
            callback_url = self.callback_var.get().strip()
            if not callback_url:
                self.log_to_response("\n⚠️ No callback URL specified - skipping confirmation")
                return
            
            self.log_to_response(f"\n📤 SENDING CONFIRMATION RESPONSE...")
            self.log_to_response(f"Callback URL: {callback_url}")
            
            # Prepare confirmation payload
            confirmation_data = {
                "status": "received",
                "message": "Data has been successfully received by client application",
                "mobile_number": mobile,
                "timestamp": datetime.now().isoformat(),
                "client_info": {
                    "application": "LeadFetcher-Client",
                    "version": "1.0",
                    "user": self.user_email,
                    "role": self.user_role
                },
                "received_data_summary": {
                    "total_leads": received_data.get('totalLeads', 0),
                    "leads_count": len(received_data.get('leads', [])),
                    "success": received_data.get('success', False)
                }
            }
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadFetcher-Client/1.0',
                'Authorization': f'Bearer {self.token}',
                'X-Session-ID': self.session_id
            }
            
            # Send POST request with confirmation
            confirmation_response = requests.post(
                callback_url, 
                json=confirmation_data, 
                headers=headers, 
                timeout=15
            )
            
            self.log_to_response(f"Confirmation Response Status: {confirmation_response.status_code}")
            
            if confirmation_response.status_code in [200, 201, 202]:
                self.log_to_response("✅ CONFIRMATION SENT SUCCESSFULLY!")
                try:
                    response_json = confirmation_response.json()
                    self.log_to_response(f"Server Response: {json.dumps(response_json, indent=2)}")
                except:
                    self.log_to_response(f"Server Response: {confirmation_response.text}")
            else:
                self.log_to_response(f"❌ Confirmation failed: HTTP {confirmation_response.status_code}")
                self.log_to_response(f"Response: {confirmation_response.text}")
                
        except requests.exceptions.Timeout:
            self.log_to_response("❌ Confirmation timeout (15 seconds)")
        except requests.exceptions.ConnectionError:
            self.log_to_response("❌ Confirmation failed: Connection error")
        except Exception as e:
            self.log_to_response(f"❌ Confirmation error: {str(e)}")
        finally:
            # Run WhatsApp automation after confirmation is sent
            if self.send_confirmation_var.get():
                self.run_whatsapp_automation(mobile)

    def test_webdriver_modified(self, phone_number=None):
        """Modified test_webdriver without infinite loop and sys.exit()"""
        # Get phone number from parameter or command line arguments
        if phone_number is None:
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
        
        # Check if driver setup failed (display can be None on Windows)
        if driver is None:
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
                
                # Instead of infinite loop, just return success
                logger.info("WhatsApp automation completed successfully")
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
                    
                    # Instead of infinite loop, just return success
                    logger.info("WhatsApp automation completed successfully")
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
            # Only stop display if it exists (Linux only)
            if display:
                display.stop()

    def run_whatsapp_automation(self, mobile_number):
        """Run the WhatsApp automation in a separate thread, after fetching WhatsApp number from DB.
        If it finishes or exits abruptly, schedule another attempt after 10 minutes.
        """

        def schedule_retry():
            """Schedules the next WhatsApp automation after 10 minutes"""
            retry_delay = 5 * 60 * 1000  # 10 minutes in milliseconds
            self.root.after(
                retry_delay,
                lambda: self.run_whatsapp_automation(mobile_number)
            )
            self.root.after(0, lambda: self.log_to_response("⏳ Retrying WhatsApp automation in 10 minutes..."))

        def kill_firefox_processes():
            """Force kill all Firefox and geckodriver processes"""
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    if proc.info['name'] and proc.info['name'].lower() in ['firefox.exe', 'firefox', 'geckodriver.exe', 'geckodriver']:
                        os.kill(proc.info['pid'], signal.SIGTERM)
                        print(f"🔥 Killed leftover process: {proc.info['name']} (PID: {proc.info['pid']})")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

        def whatsapp_thread():
            try:
                self.root.after(0, lambda: self.log_to_response(f"🔄 Fetching WhatsApp number for {mobile_number}..."))

                try:
                    # Fetch WhatsApp number from backend API
                    api_url = f"https://api.leadscruise.com/api/whatsapp-settings/get-whatsapp-number?mobileNumber={mobile_number}"
                    response = requests.get(api_url, timeout=10)

                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success") and data.get("data"):
                            whatsapp_number = data["data"].get("whatsappNumber", mobile_number)
                            self.root.after(0, lambda: self.log_to_response(f"✅ WhatsApp number fetched: {whatsapp_number}"))
                        else:
                            whatsapp_number = mobile_number
                            self.root.after(0, lambda: self.log_to_response("⚠️ No WhatsApp number found in DB, using provided number"))
                    else:
                        whatsapp_number = mobile_number
                        self.root.after(0, lambda: self.log_to_response(f"⚠️ Failed to fetch from DB, using provided number. HTTP {response.status_code}"))

                except Exception as e:
                    whatsapp_number = mobile_number
                    self.root.after(0, lambda: self.log_to_response(f"❌ Error fetching WhatsApp number: {e}"))

                # Run the automation
                self.root.after(0, lambda: self.log_to_response(f"🚀 Starting WhatsApp automation for {whatsapp_number}..."))

                exit_code = self.test_webdriver_modified(whatsapp_number)

                if exit_code == 0:
                    self.root.after(0, lambda: self.log_to_response("✅ WhatsApp automation completed successfully"))
                else:
                    self.root.after(0, lambda: self.log_to_response(f"⚠️ WhatsApp automation finished with exit code: {exit_code}"))

                kill_firefox_processes()

                # ✅ Always schedule retry after completion
                schedule_retry()

            except Exception as e:
                error_msg = f"❌ WhatsApp automation error: {str(e)}"
                self.root.after(0, lambda: self.log_to_response(error_msg))
                self.root.after(0, lambda: self.log_to_response(f"Traceback: {traceback.format_exc()}"))
                schedule_retry()  # Retry even after exceptions

        # Clean up finished threads
        self.whatsapp_threads = [t for t in self.whatsapp_threads if t.is_alive()]

        # Start WhatsApp automation in background thread
        whatsapp_thread = threading.Thread(target=whatsapp_thread, daemon=True)
        whatsapp_thread.start()
        self.whatsapp_threads.append(whatsapp_thread)

        self.log_to_response(f"📱 WhatsApp automation started in background thread (Total active: {len(self.whatsapp_threads)})...")

    def log_to_response(self, message):
        """Add message to response text area (thread-safe)"""
        self.root.after(0, lambda: self._append_to_text(message))
        
    def _append_to_text(self, message):
        """Append text to response area and scroll to bottom"""
        self.response_text.insert(tk.END, message + "\n")
        self.response_text.see(tk.END)
        self.root.update_idletasks()
        
    def update_status(self, message):
        """Update status label"""
        self.status_var.set(message)
        
    def clear_response(self):
        """Clear the response text area"""
        self.response_text.delete(1.0, tk.END)
        self.update_status("Response cleared. Ready to fetch data...")
        
    def toggle_auto_fetch(self):
        """Toggle auto-fetch functionality"""
        if self.auto_fetch_var.get():
            self.start_auto_fetch()
        else:
            self.stop_auto_fetch()
            
    def start_auto_fetch(self):
        """Start auto-fetch timer"""
        self.update_status("Auto-fetch enabled (5 minute intervals)")
        self.schedule_auto_fetch()
        
    def stop_auto_fetch(self):
        """Stop auto-fetch timer"""
        if self.auto_fetch_timer:
            self.root.after_cancel(self.auto_fetch_timer)
            self.auto_fetch_timer = None
        self.update_status("Auto-fetch disabled")
        
    def schedule_auto_fetch(self):
        """Schedule next auto-fetch"""
        if self.auto_fetch_var.get():
            self.fetch_data_threaded(is_auto_fetch=True)  # Pass auto-fetch flag
            self.auto_fetch_timer = self.root.after(300000, self.schedule_auto_fetch)  # 300000ms = 5 minutes

def check_firefox_installed():
    """Check if Firefox is installed on the system"""
    try:
        # Check based on platform
        if sys.platform.startswith('win'):
            # Windows
            try:
                result = subprocess.run(["firefox", "--version"], 
                                     capture_output=True, check=True, timeout=5)
                return True
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                # Try alternative Windows path
                try:
                    result = subprocess.run([r"C:\Program Files\Mozilla Firefox\firefox.exe", "--version"], 
                                         capture_output=True, check=True, timeout=5)
                    return True
                except:
                    return False
                    
        elif sys.platform == 'darwin':
            # macOS
            try:
                result = subprocess.run(["/Applications/Firefox.app/Contents/MacOS/firefox", "--version"], 
                                     capture_output=True, check=True, timeout=5)
                return True
            except:
                try:
                    result = subprocess.run(["firefox", "--version"], 
                                         capture_output=True, check=True, timeout=5)
                    return True
                except:
                    return False
                    
        else:
            # Linux and other Unix-like systems
            try:
                result = subprocess.run(["firefox", "--version"], 
                                     capture_output=True, check=True, timeout=5)
                return True
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                return False
                
    except Exception as e:
        print(f"Error checking Firefox installation: {e}")
        return False

def show_firefox_installation_message():
    """Show message with Firefox installation instructions"""
    # Create a temporary root window for the messagebox
    temp_root = tk.Tk()
    temp_root.withdraw()  # Hide the window
    
    if sys.platform.startswith('win'):
        message = ("Firefox is required to run this application.\n\n"
                  "Please install Firefox from:\n"
                  "https://www.mozilla.org/firefox/\n\n"
                  "After installation, restart this application.")
    elif sys.platform == 'darwin':
        message = ("Firefox is required to run this application.\n\n"
                  "Please install Firefox from:\n"
                  "https://www.mozilla.org/firefox/\n\n"
                  "Or install via Homebrew:\n"
                  "brew install --cask firefox\n\n"
                  "After installation, restart this application.")
    else:
        message = ("Firefox is required to run this application.\n\n"
                  "Please install Firefox using your package manager:\n\n"
                  "Ubuntu/Debian: sudo apt install firefox\n"
                  "Fedora: sudo dnf install firefox\n"
                  "Arch: sudo pacman -S firefox\n\n"
                  "Or download from: https://www.mozilla.org/firefox/\n\n"
                  "After installation, restart this application.")
    
    messagebox.showerror("Firefox Required", message)
    temp_root.destroy()

def main():
    try:
        # Enable debug mode
        print("🚀 Starting LeadsCruise Login App...")
        print(f"📁 Config directory: {os.path.join(os.path.expanduser('~'), '.leadscruise')}")
        
        # Check Firefox installation first
        print("🔍 Checking Firefox installation...")
        if not check_firefox_installed():
            print("❌ Firefox not found!")
            show_firefox_installation_message()
            input("Press Enter to exit...")
            return
            
        print("✅ Firefox found!")
        
        # Create and run the login application
        login_root = tk.Tk()
        app = LoginApp(login_root)
        
        print("🖼️ Login window created, starting mainloop...")
        login_root.mainloop()
        
    except Exception as e:
        print(f"❌ Application error: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")

class GitHubUpdateManager:
    def __init__(self, app_instance):
        self.app = app_instance
        self.repo_owner = "omkar3060"
        self.repo_name = "Lead-Fetcher" 
        self.api_url = f"https://api.github.com/repos/{self.repo_owner}/{self.repo_name}/releases"
        self.current_version = self.get_current_version()
    
    def get_current_version(self):
        """Get current application version from Program Files directory"""
        try:
            app_dir = get_application_directory()
            version_file = os.path.join(app_dir, "version.txt")
            
            if os.path.exists(version_file):
                with open(version_file, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            else:
                return "1.0.0"  # Default version
        except Exception as e:
            self.app.log_to_response(f"Error reading version: {e}")
            return "1.0.0"
    
    def check_for_updates(self, show_no_update_message=True):
        """Check GitHub releases for updates"""
        try:
            self.app.log_to_response("🔍 Checking GitHub for updates...")
            
            # Get latest release
            response = requests.get(f"{self.api_url}/latest", timeout=10)
            
            if response.status_code == 200:
                release_data = response.json()
                
                # Extract version from tag
                latest_version = release_data.get("tag_name", "").lstrip('v')
                release_name = release_data.get("name", "")
                changelog = release_data.get("body", "No changelog available")
                is_prerelease = release_data.get("prerelease", False)
                
                # Skip pre-releases unless specifically enabled
                if is_prerelease:
                    self.app.log_to_response("⚠️ Latest release is a pre-release, skipping...")
                    if show_no_update_message:
                        self.app.log_to_response("✅ You're running the latest stable version!")
                    return
                
                if self.is_newer_version(latest_version, self.current_version):
                    # Find appropriate download asset
                    assets = release_data.get("assets", [])
                    download_url = self.find_compatible_asset(assets)
                    
                    if download_url:
                        self.app.log_to_response(f"✅ Update available: {release_name} (v{latest_version})")
                        
                        # Show update dialog
                        if self.show_update_dialog(latest_version, release_name, changelog):
                            self.download_and_install_update(download_url, latest_version)
                    else:
                        self.app.log_to_response("❌ No compatible download found for your platform")
                        if show_no_update_message:
                            messagebox.showinfo("No Compatible Update", 
                                              "An update is available but no compatible download was found for your platform.")
                else:
                    if show_no_update_message:
                        self.app.log_to_response("✅ You're running the latest version!")
                        messagebox.showinfo("No Updates", "You're already running the latest version!")
            
            elif response.status_code == 404:
                self.app.log_to_response("❌ Repository not found or no releases available")
                if show_no_update_message:
                    messagebox.showerror("Update Check Failed", "Repository not found or no releases available.")
            else:
                raise Exception(f"GitHub API returned status code: {response.status_code}")
                
        except requests.RequestException as e:
            self.app.log_to_response(f"❌ Failed to check GitHub releases: {str(e)}")
            if show_no_update_message:
                messagebox.showerror("Update Check Failed", 
                                   f"Could not check for updates:\n{str(e)}\n\nPlease check your internet connection.")
        except Exception as e:
            self.app.log_to_response(f"❌ Update check failed: {str(e)}")
    
    def find_compatible_asset(self, assets):
        """Find compatible download asset for current platform"""
        platform_patterns = {
            'win32': [r'windows', r'win', r'\.exe$', r'\.zip$'],
            'darwin': [r'mac', r'osx', r'darwin', r'\.dmg$', r'\.zip$'],
            'linux': [r'linux', r'\.tar\.gz$', r'\.zip$']
        }
        
        current_platform = sys.platform
        patterns = platform_patterns.get(current_platform, [r'\.zip$'])
        
        # First, try to find platform-specific assets
        for asset in assets:
            asset_name = asset["name"].lower()
            for pattern in patterns:
                if re.search(pattern, asset_name):
                    return asset["browser_download_url"]
        
        # Fallback: look for any zip file
        for asset in assets:
            if asset["name"].lower().endswith('.zip'):
                return asset["browser_download_url"]
        
        return None
    
    def is_newer_version(self, latest, current):
        """Compare version strings"""
        def version_tuple(v):
            # Remove any non-digit, non-dot characters
            clean_v = re.sub(r'[^0-9.]', '', v)
            try:
                return tuple(map(int, clean_v.split(".")))
            except ValueError:
                return (0, 0, 0)
        
        return version_tuple(latest) > version_tuple(current)
    
    def show_update_dialog(self, version, release_name, changelog):
        """Show update confirmation dialog"""
        dialog = tk.Toplevel(self.app.root)
        dialog.title("Update Available - Lead Fetcher")
        dialog.geometry("600x500")
        dialog.resizable(True, True)
        dialog.transient(self.app.root)
        dialog.grab_set()
        
        # Center the dialog
        dialog.geometry("+%d+%d" % (
            self.app.root.winfo_rootx() + 50,
            self.app.root.winfo_rooty() + 50
        ))
        
        main_frame = ttk.Frame(dialog, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        ttk.Label(header_frame, text="🚀 Update Available", 
                 font=("Arial", 16, "bold")).pack()
        
        # Version info
        info_frame = ttk.LabelFrame(main_frame, text="Version Information", padding="10")
        info_frame.pack(fill=tk.X, pady=(0, 15))
        
        ttk.Label(info_frame, text=f"Release: {release_name}").pack(anchor=tk.W)
        ttk.Label(info_frame, text=f"New Version: v{version}").pack(anchor=tk.W)
        ttk.Label(info_frame, text=f"Current Version: v{self.current_version}").pack(anchor=tk.W)
        
        # Changelog
        changelog_frame = ttk.LabelFrame(main_frame, text="What's New", padding="10")
        changelog_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 20))
        
        changelog_container = ttk.Frame(changelog_frame)
        changelog_container.pack(fill=tk.BOTH, expand=True)
        
        changelog_text = tk.Text(changelog_container, height=12, wrap=tk.WORD)
        changelog_scrollbar = ttk.Scrollbar(changelog_container, orient=tk.VERTICAL, 
                                          command=changelog_text.yview)
        changelog_text.configure(yscrollcommand=changelog_scrollbar.set)
        
        # Format and insert changelog
        formatted_changelog = self.format_changelog(changelog)
        changelog_text.insert("1.0", formatted_changelog)
        changelog_text.configure(state=tk.DISABLED)
        
        changelog_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        changelog_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        result = {"install": False}
        
        def install_update():
            result["install"] = True
            dialog.destroy()
        
        def cancel_update():
            result["install"] = False
            dialog.destroy()
        
        def view_on_github():
            url = f"https://github.com/{self.repo_owner}/{self.repo_name}/releases/tag/v{version}"
            webbrowser.open(url)
        
        ttk.Button(button_frame, text="View on GitHub", 
                  command=view_on_github).pack(side=tk.LEFT)
        
        ttk.Frame(button_frame).pack(side=tk.LEFT, expand=True)  # Spacer
        
        ttk.Button(button_frame, text="Cancel", 
                  command=cancel_update).pack(side=tk.RIGHT, padx=(10, 0))
        ttk.Button(button_frame, text="Install Update", 
                  command=install_update).pack(side=tk.RIGHT)
        
        # Wait for user decision
        self.app.root.wait_window(dialog)
        return result["install"]
    
    def format_changelog(self, changelog):
        """Format GitHub release body for better display"""
        if not changelog or changelog == "No changelog available":
            return "No detailed changelog available for this release."
        
        # Basic formatting for better readability
        lines = changelog.split('\n')
        formatted_lines = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('##'):
                # Subheading
                formatted_lines.append(f"\n{line.replace('##', '').strip()}")
                formatted_lines.append("-" * 30)
            elif line.startswith('#'):
                # Heading
                formatted_lines.append(f"\n{line.replace('#', '').strip().upper()}")
                formatted_lines.append("=" * 40)
            elif line.startswith('- ') or line.startswith('* '):
                # List item
                formatted_lines.append(f"  • {line[2:]}")
            elif line.startswith('+ '):
                # Addition
                formatted_lines.append(f"  ✅ {line[2:]}")
            elif line.startswith('**') and line.endswith('**'):
                # Bold text
                formatted_lines.append(f"\n{line.replace('**', '').strip()}")
            elif line:
                formatted_lines.append(line)
            else:
                formatted_lines.append("")
        
        return '\n'.join(formatted_lines)
    
    def download_and_install_update(self, download_url, version):
        """Download and install the update"""
        def update_thread():
            try:
                self.app.log_to_response("⬇️ Downloading update...")
                self.app.fetch_button.configure(state='disabled')
                
                # Switch progress bar to determinate mode
                self.app.progress.configure(mode='determinate', value=0)
                
                # Create temporary directory
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_file = os.path.join(temp_dir, f"leadfetcher-update-v{version}.zip")
                    
                    # Download file with progress
                    response = requests.get(download_url, stream=True, timeout=30)
                    response.raise_for_status()
                    
                    total_size = int(response.headers.get('content-length', 0))
                    downloaded = 0
                    
                    with open(temp_file, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                
                                if total_size > 0:
                                    progress = (downloaded / total_size) * 100
                                    self.app.root.after(0, lambda p=progress: self.update_progress(p))
                    
                    self.app.root.after(0, lambda: self.app.log_to_response("✅ Download completed"))
                    self.app.root.after(0, lambda: self.app.status_var.set("Installing update..."))
                    
                    # Install update
                    self.install_update(temp_file, version)
                    
            except Exception as e:
                self.app.root.after(0, lambda: self.app.log_to_response(f"❌ Update failed: {str(e)}"))
                self.app.root.after(0, lambda: messagebox.showerror("Update Failed", f"Update installation failed:\n{str(e)}"))
            finally:
                self.app.root.after(0, self.cleanup_after_update)
        
        threading.Thread(target=update_thread, daemon=True).start()
    
    def update_progress(self, progress):
        """Update progress bar"""
        self.app.progress['value'] = progress
        self.app.status_var.set(f"Downloading update... {progress:.1f}%")
    
    def install_update(self, update_file, version):
        """Install the downloaded update - Program Files version"""
        try:
            self.app.root.after(0, lambda: self.app.log_to_response("Installing update..."))
            
            # Get application directory (Program Files)
            app_dir = get_application_directory()
            self.app.log_to_response(f"Application directory: {app_dir}")
            
            # Ensure app directory exists
            if not os.path.exists(app_dir):
                os.makedirs(app_dir, exist_ok=True)
                self.app.log_to_response(f"Created application directory: {app_dir}")
            
            # Create backup directory
            backup_dir = os.path.join(app_dir, "backup")
            if os.path.exists(backup_dir):
                shutil.rmtree(backup_dir)
            os.makedirs(backup_dir)
            
            self.app.log_to_response(f"Created backup directory: {backup_dir}")
            
            # List of files to backup and replace
            files_to_backup = []
            
            if getattr(sys, 'frozen', False):
                # For compiled executable, backup the exe file itself
                exe_name = "LeadFetcher.exe"  # Your exe name
                exe_path = os.path.join(app_dir, exe_name)
                if os.path.exists(exe_path):
                    files_to_backup.append(exe_name)
                    self.app.log_to_response(f"Will backup executable: {exe_name}")
            else:
                # For Python script, backup Python files
                for file_pattern in ["*.py", "*.pyw"]:
                    for file_path in Path(app_dir).glob(file_pattern):
                        if file_path.is_file():
                            files_to_backup.append(file_path.name)
            
            # Always backup important files
            important_files = ["version.txt", "requirements.txt", "README.md", "config.json", 
                            "api_response.json", "feedback.json"]
            for file_name in important_files:
                file_path = os.path.join(app_dir, file_name)
                if os.path.exists(file_path):
                    files_to_backup.append(file_name)
            
            # Create backups
            backed_up_files = []
            for file_name in files_to_backup:
                try:
                    source_path = os.path.join(app_dir, file_name)
                    backup_path = os.path.join(backup_dir, file_name)
                    shutil.copy2(source_path, backup_path)
                    backed_up_files.append(file_name)
                    self.app.log_to_response(f"Backed up: {file_name}")
                except Exception as e:
                    self.app.log_to_response(f"Warning: Could not backup {file_name}: {e}")
            
            self.app.root.after(0, lambda: self.app.log_to_response("Backup completed"))
            
            # Verify the update file exists and is valid
            if not os.path.exists(update_file):
                raise Exception(f"Update file not found: {update_file}")
            
            # Check if it's a valid ZIP file
            if not zipfile.is_zipfile(update_file):
                raise Exception("Downloaded file is not a valid ZIP archive")
            
            self.app.log_to_response(f"Update file verified: {update_file}")
            self.app.log_to_response(f"Update file size: {os.path.getsize(update_file)} bytes")
            
            # Extract and examine the contents first
            extracted_files = []
            with zipfile.ZipFile(update_file, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                self.app.log_to_response(f"Update contains {len(file_list)} files:")
                for file_name in file_list[:10]:  # Show first 10 files
                    self.app.log_to_response(f"  - {file_name}")
                if len(file_list) > 10:
                    self.app.log_to_response(f"  ... and {len(file_list) - 10} more files")
                
                # Extract files to a temporary directory first
                temp_extract_dir = os.path.join(app_dir, "temp_update")
                if os.path.exists(temp_extract_dir):
                    shutil.rmtree(temp_extract_dir)
                os.makedirs(temp_extract_dir)
                
                zip_ref.extractall(temp_extract_dir)
                extracted_files = os.listdir(temp_extract_dir)
                self.app.log_to_response(f"Extracted to temporary directory: {temp_extract_dir}")
            
            # Now move files from temp directory to app directory
            updated_files = []
            for file_name in extracted_files:
                temp_file_path = os.path.join(temp_extract_dir, file_name)
                target_file_path = os.path.join(app_dir, file_name)
                
                if os.path.isfile(temp_file_path):
                    try:
                        # For executable files, we might need special handling
                        if getattr(sys, 'frozen', False) and file_name.endswith('.exe'):
                            # Try to rename current exe before replacing
                            if os.path.exists(target_file_path):
                                old_exe = target_file_path + '.old'
                                if os.path.exists(old_exe):
                                    os.remove(old_exe)
                                os.rename(target_file_path, old_exe)
                                self.app.log_to_response(f"Renamed current exe to: {old_exe}")
                        
                        shutil.move(temp_file_path, target_file_path)
                        updated_files.append(file_name)
                        self.app.log_to_response(f"Updated: {file_name}")
                        
                    except PermissionError as e:
                        self.app.log_to_response(f"Permission denied updating {file_name}: {e}")
                        # This is expected for running executables - the update will take effect on restart
                        if file_name.endswith('.exe'):
                            self.app.log_to_response(f"Executable {file_name} will be updated on restart")
                    except Exception as e:
                        self.app.log_to_response(f"Error updating {file_name}: {e}")
            
            # Clean up temp directory
            if os.path.exists(temp_extract_dir):
                shutil.rmtree(temp_extract_dir)
            
            # Update version file in app directory
            version_file_path = os.path.join(app_dir, "version.txt")
            try:
                with open(version_file_path, 'w', encoding='utf-8') as f:
                    f.write(version)
                self.app.log_to_response(f"Version updated to: {version}")
                
                # Verify version was written correctly
                with open(version_file_path, 'r', encoding='utf-8') as f:
                    written_version = f.read().strip()
                    if written_version == version:
                        self.app.log_to_response(f"Version verification successful: {written_version}")
                    else:
                        self.app.log_to_response(f"Version verification failed: expected {version}, got {written_version}")
                        
            except Exception as e:
                self.app.log_to_response(f"Error updating version file: {e}")
            
            # Show summary
            self.app.log_to_response(f"\nUpdate Summary:")
            self.app.log_to_response(f"- Backed up {len(backed_up_files)} files")
            self.app.log_to_response(f"- Updated {len(updated_files)} files")
            self.app.log_to_response(f"- Target version: {version}")
            
            self.app.root.after(0, lambda: self.app.log_to_response("Update installation completed"))
            
            # Show restart dialog
            self.app.root.after(0, self.show_restart_dialog)
            
        except Exception as e:
            self.app.log_to_response(f"Update installation failed: {str(e)}")
            # Restore from backup
            try:
                self.restore_from_backup()
            except Exception as restore_error:
                self.app.log_to_response(f"Backup restoration also failed: {restore_error}")
            raise e

    def restore_from_backup(self):
        """Restore application from backup - improved version"""
        try:
            if getattr(sys, 'frozen', False):
                app_dir = os.path.dirname(sys.executable)
            else:
                app_dir = os.getcwd()
                
            backup_dir = os.path.join(app_dir, "backup")
            
            if os.path.exists(backup_dir):
                restored_files = []
                for backup_file in os.listdir(backup_dir):
                    backup_file_path = os.path.join(backup_dir, backup_file)
                    target_file_path = os.path.join(app_dir, backup_file)
                    
                    if os.path.isfile(backup_file_path):
                        try:
                            shutil.copy2(backup_file_path, target_file_path)
                            restored_files.append(backup_file)
                        except Exception as e:
                            self.app.log_to_response(f"Could not restore {backup_file}: {e}")
                
                self.app.root.after(0, lambda: self.app.log_to_response(f"Restored {len(restored_files)} files from backup"))
            else:
                self.app.log_to_response("No backup directory found for restoration")
                
        except Exception as e:
            self.app.root.after(0, lambda: self.app.log_to_response(f"Backup restore failed: {str(e)}"))

    def show_restart_dialog(self):
        """Show restart dialog - no automatic restart for compiled executables"""
        # Check if we're running as compiled executable
        if getattr(sys, 'frozen', False):
            # For compiled executables, don't attempt automatic restart
            self.show_manual_restart_dialog()
        else:
            # For Python scripts, offer automatic restart
            if messagebox.askyesno("Update Complete", 
                                "Update installed successfully!\n\nThe application needs to restart to apply the changes.\n\nRestart now?"):
                self.restart_application()
            else:
                self.app.log_to_response("Please restart the application to complete the update")

    def show_manual_restart_dialog(self):
        """Show manual restart dialog for compiled executables"""
        dialog = tk.Toplevel(self.app.root)
        dialog.title("Update Complete - Manual Restart Required")
        dialog.geometry("450x300")
        dialog.resizable(False, False)
        dialog.transient(self.app.root)
        dialog.grab_set()
        
        # Center dialog
        dialog.geometry("+%d+%d" % (
            self.app.root.winfo_rootx() + 175,
            self.app.root.winfo_rooty() + 150
        ))
        
        main_frame = ttk.Frame(dialog, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Success message
        ttk.Label(main_frame, text="Update Installed Successfully!", 
                font=("Arial", 14, "bold"), 
                foreground="green").pack(pady=(0, 15))
        
        # Icon/Visual indicator
        ttk.Label(main_frame, text="🎉", font=("Arial", 24)).pack(pady=(0, 15))
        
        # Instructions
        instructions = (
            "The update has been installed successfully!\n\n"
            "To complete the update process:\n\n"
            "1. Close this application completely\n"
            "2. Restart the application\n"
            "3. Verify the new version is running\n\n"
            "The application will be ready with the latest features after restart."
        )
        
        ttk.Label(main_frame, text=instructions, 
                justify=tk.CENTER, 
                wraplength=400).pack(pady=(0, 20))
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
    
        def close_app():
            dialog.destroy()
            self.app.quit_app()
        
        def close_dialog():
            dialog.destroy()
            self.app.log_to_response("Update complete. Please restart the application when convenient.")
        
        ttk.Button(button_frame, text="Close & Exit Application", 
                command=close_app).pack(side=tk.RIGHT, padx=(10, 0))
        ttk.Button(button_frame, text="Continue Using (Restart Later)", 
                command=close_dialog).pack(side=tk.RIGHT)
        
        # Wait for user action
        self.app.root.wait_window(dialog)

    def restart_application(self):
        """Restart the application"""
        try:
            import sys
            import os
            
            # Get the current script path
            if getattr(sys, 'frozen', False):
                # Running as compiled executable
                os.execv(sys.executable, [sys.executable] + sys.argv)
            else:
                # Running as Python script
                os.execv(sys.executable, [sys.executable] + sys.argv)
                
        except Exception as e:
            self.app.log_to_response(f"❌ Restart failed: {str(e)}")
            messagebox.showerror("Restart Failed", 
                               f"Could not restart automatically.\nPlease restart the application manually.\n\nError: {str(e)}")
    
    def cleanup_after_update(self):
        """Reset UI after update process"""
        self.app.progress.configure(mode='indeterminate', value=0)
        self.app.fetch_button.configure(state='normal')
        self.app.status_var.set("Ready to fetch data...")

    def diagnose_update_environment(self):
        """Diagnose the current environment for update process"""
        self.app.log_to_response("\n" + "="*50)
        self.app.log_to_response("UPDATE ENVIRONMENT DIAGNOSTICS")
        self.app.log_to_response("="*50)
        
        # Get application directory
        app_dir = get_application_directory()
        self.app.log_to_response(f"Application directory: {app_dir}")
        
        # Basic environment info
        self.app.log_to_response(f"Python version: {sys.version}")
        self.app.log_to_response(f"Platform: {sys.platform}")
        self.app.log_to_response(f"Frozen (compiled): {getattr(sys, 'frozen', False)}")
        
        # Path information
        self.app.log_to_response(f"Current working directory: {os.getcwd()}")
        self.app.log_to_response(f"sys.executable: {sys.executable}")
        self.app.log_to_response(f"sys.argv[0]: {sys.argv[0]}")
        
        if getattr(sys, 'frozen', False):
            self.app.log_to_response(f"sys._MEIPASS: {getattr(sys, '_MEIPASS', 'Not available')}")
            exe_dir = os.path.dirname(sys.executable)
            self.app.log_to_response(f"Executable directory: {exe_dir}")
        
        # Check current version
        try:
            version_file = os.path.join(app_dir, "version.txt")
            if os.path.exists(version_file):
                with open(version_file, 'r', encoding='utf-8') as f:
                    current_version = f.read().strip()
                self.app.log_to_response(f"Current version (version.txt): {current_version}")
                self.app.log_to_response(f"Version file path: {version_file}")
            else:
                self.app.log_to_response(f"version.txt not found at: {version_file}")
        except Exception as e:
            self.app.log_to_response(f"Error reading version file: {e}")
        
        # Check file permissions in app directory
        try:
            test_file = os.path.join(app_dir, "update_test.tmp")
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
            self.app.log_to_response("File write permissions: OK")
        except Exception as e:
            self.app.log_to_response(f"File write permissions: FAILED - {e}")
            self.app.log_to_response("Note: You may need to run as administrator to update files in Program Files")
        
        # List app directory contents
        try:
            if os.path.exists(app_dir):
                files = os.listdir(app_dir)
                self.app.log_to_response(f"Application directory contains {len(files)} items:")
                for file in sorted(files)[:10]:  # Show first 10 items
                    file_path = os.path.join(app_dir, file)
                    if os.path.isfile(file_path):
                        size = os.path.getsize(file_path)
                        self.app.log_to_response(f"  - {file} ({size} bytes)")
                    else:
                        self.app.log_to_response(f"  - {file}/ (directory)")
                if len(files) > 10:
                    self.app.log_to_response(f"  ... and {len(files) - 10} more items")
            else:
                self.app.log_to_response(f"Application directory does not exist: {app_dir}")
        except Exception as e:
            self.app.log_to_response(f"Error listing directory: {e}")
        
        self.app.log_to_response("="*50)

    def verify_update_success(self, expected_version):
        """Verify if the update was actually successful"""
        self.app.log_to_response("\n" + "="*50)
        self.app.log_to_response("UPDATE VERIFICATION")
        self.app.log_to_response("="*50)
        
        success = True
        app_dir = get_application_directory()
        
        # Check version file in app directory
        try:
            version_file = os.path.join(app_dir, "version.txt")
            
            if os.path.exists(version_file):
                with open(version_file, 'r', encoding='utf-8') as f:
                    actual_version = f.read().strip()
                self.app.log_to_response(f"Version in {version_file}: {actual_version}")
                
                if actual_version == expected_version:
                    self.app.log_to_response(f"Version update SUCCESSFUL")
                else:
                    self.app.log_to_response(f"Version update FAILED - Expected: {expected_version}, Got: {actual_version}")
                    success = False
            else:
                self.app.log_to_response(f"Version file not found at: {version_file}")
                success = False
                    
        except Exception as e:
            self.app.log_to_response(f"Error verifying version: {e}")
            success = False
        
        # Check backup directory
        backup_dir = os.path.join(app_dir, "backup")
        if os.path.exists(backup_dir):
            backup_files = os.listdir(backup_dir)
            self.app.log_to_response(f"Backup directory contains {len(backup_files)} files")
            self.app.log_to_response("Backup created: SUCCESS")
        else:
            self.app.log_to_response("Backup directory not found - backup may have failed")
        
        # Overall result
        if success:
            self.app.log_to_response("OVERALL UPDATE STATUS: SUCCESS")
        else:
            self.app.log_to_response("OVERALL UPDATE STATUS: FAILED")
        
        self.app.log_to_response("="*50)
        return success
    # Add this method to your GitHubUpdateManager class to call diagnostics
    def download_and_install_update(self, download_url, version):
        """Download and install the update - with diagnostics"""
        def update_thread():
            try:
                # Run diagnostics before starting
                self.diagnose_update_environment()
                
                self.app.log_to_response("Downloading update...")
                self.app.fetch_button.configure(state='disabled')
                
                # Switch progress bar to determinate mode
                self.app.progress.configure(mode='determinate', value=0)
                
                # Create temporary directory
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_file = os.path.join(temp_dir, f"leadfetcher-update-v{version}.zip")
                    
                    # Download file with progress
                    response = requests.get(download_url, stream=True, timeout=30)
                    response.raise_for_status()
                    
                    total_size = int(response.headers.get('content-length', 0))
                    downloaded = 0
                    
                    with open(temp_file, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                
                                if total_size > 0:
                                    progress = (downloaded / total_size) * 100
                                    self.app.root.after(0, lambda p=progress: self.update_progress(p))
                    
                    self.app.root.after(0, lambda: self.app.log_to_response("Download completed"))
                    self.app.root.after(0, lambda: self.app.status_var.set("Installing update..."))
                    
                    # Install update
                    self.install_update(temp_file, version)
                    
                    # Verify update success
                    self.app.root.after(0, lambda: self.verify_update_success(version))
                    
            except Exception as e:
                self.app.root.after(0, lambda: self.app.log_to_response(f"Update failed: {str(e)}"))
                self.app.root.after(0, lambda: messagebox.showerror("Update Failed", f"Update installation failed:\n{str(e)}"))
            finally:
                self.app.root.after(0, self.cleanup_after_update)
        
        threading.Thread(target=update_thread, daemon=True).start()

if __name__ == "__main__":
    main()