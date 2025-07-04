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
from selenium.webdriver.common.keys import Keys

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
        # Delete the directory if it exists
        if os.path.exists(profile_dir):
            shutil.rmtree(profile_dir)
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
            chats_heading = wait.until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
            )
            print("Already logged in! Chats found.", flush=True)
            
        except:
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
                if verification_code:
                    print(f"Login successful! Verification code: {verification_code}", flush=True)
                    
                    # Wait a bit for WhatsApp to fully load
                    time.sleep(10)
                    
                    # Create group and add contact
                    group_created = create_group_and_add_contact(
                        driver, 
                        wait, 
                        "9148016901", 
                        "My New Group"
                    )
                    
                    if group_created:
                        print("Group creation and contact addition completed successfully!", flush=True)
                        return 0
                    else:
                        print("Failed to create group or add contact.", flush=True)
                        exit(1)
            except Exception as login_error:
                print(f"Unable to detect login method: {login_error}", flush=True)
                print(traceback.format_exc(), flush=True)
                # Take a screenshot to diagnose the issue
                try:
                    # driver.save_screenshot("login_error.png")
                    print("Screenshot saved as login_error.png", flush=True)
                except:
                    print("Failed to save screenshot", flush=True)
        
        # Now we should be logged in, proceed to send message
        time.sleep(5)  # Give a moment for the UI to fully load
        
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
            exit(1)
            driver.save_screenshot("verification_code_missing.png")
        
        # Wait for "Chats" heading to appear before proceeding (longer timeout)
        print("Waiting for 'Chats' to appear after login...", flush=True)
        try:
            WebDriverWait(driver, 600).until(
                EC.any_of(
                    EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]")),
                    EC.presence_of_element_located((By.XPATH, "//*[@aria-label='WhatsApp' and @data-icon='wa-wordmark-refreshed']"))
                )
            )
            print("Login successful! Chats found.", flush=True)
        except Exception as e:
            print(f"Error waiting for WhatsApp UI: {e}", flush=True)
        
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

def create_group_and_add_contact(driver, wait, phone_number, group_name="New Group"):
    """
    Create a new WhatsApp group and add a contact to it
    
    Args:
        driver: WebDriver instance
        wait: WebDriverWait instance
        phone_number: Phone number to add to the group (e.g., "9148016901")
        group_name: Name for the new group (default: "New Group")
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        try:
            print("Checking for 'Fresh look' popup...", flush=True)
            # Wait up to 10 seconds for the popup
            continue_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[.//div[contains(text(), 'Continue')]]"))
            )
            print("Found 'Fresh look' popup, clicking continue button...", flush=True)
            continue_button.click()
            print("Clicked continue button to close popup", flush=True)
            time.sleep(2)  # Wait a moment after closing popup
        except Exception as e:
            print("No 'Fresh look' popup detected or unable to close it:", e, flush=True)
        print(f"Starting group creation process...", flush=True)
        
        # Wait a bit to ensure WhatsApp is fully loaded
        time.sleep(3)
        
        # Try to scroll to top or dismiss any overlays
        try:
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
        except:
            pass
        
        # Click on the menu button (three dots) in the top left
        menu_button_selectors = [
            "//button[@aria-label='Menu'][@title='Menu']",
            "//button[@aria-label='Menu']",
            "//div[contains(@class, '_ajv7')]//button[@aria-label='Menu']",
            "//span[@data-icon='more-refreshed']/ancestor::button",
            "//button[@data-tab='2'][@title='Menu']",
            "//div[@aria-label='Menu']",
            "//div[@data-icon='menu']",
            "//span[@data-icon='menu']",
            "//button[@title='Menu']"
        ]
        
        menu_button = None
        for selector in menu_button_selectors:
            try:
                menu_button = wait.until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found menu button using selector: {selector}", flush=True)
                break
            except:
                print(f"Could not find menu button with selector: {selector}", flush=True)
        
        if not menu_button:
            print("Could not find menu button. Taking screenshot...", flush=True)
            # driver.save_screenshot("menu_button_missing.png")
            return False
        
        # Try multiple click methods to handle the obstruction
        click_successful = False
        
        # Method 1: Scroll element into view and click
        try:
            driver.execute_script("arguments[0].scrollIntoView(true);", menu_button)
            time.sleep(1)
            menu_button.click()
            click_successful = True
            print("Successfully clicked menu button using scrollIntoView method.", flush=True)
        except Exception as e:
            print(f"Method 1 failed: {e}", flush=True)
        
        # Method 2: JavaScript click
        if not click_successful:
            try:
                driver.execute_script("arguments[0].click();", menu_button)
                click_successful = True
                print("Successfully clicked menu button using JavaScript click.", flush=True)
            except Exception as e:
                print(f"Method 2 failed: {e}", flush=True)
        
        # Method 3: ActionChains move and click
        if not click_successful:
            try:
                from selenium.webdriver.common.action_chains import ActionChains
                actions = ActionChains(driver)
                actions.move_to_element(menu_button).click().perform()
                click_successful = True
                print("Successfully clicked menu button using ActionChains.", flush=True)
            except Exception as e:
                print(f"Method 3 failed: {e}", flush=True)
        
        # Method 4: Try to find parent element and click
        if not click_successful:
            try:
                parent_button = driver.find_element(By.XPATH, "//div[contains(@class, '_ajv7')]//button")
                driver.execute_script("arguments[0].click();", parent_button)
                click_successful = True
                print("Successfully clicked menu button using parent element.", flush=True)
            except Exception as e:
                print(f"Method 4 failed: {e}", flush=True)
        
        # Method 5: Try clicking by coordinates
        if not click_successful:
            try:
                location = menu_button.location
                size = menu_button.size
                x = location['x'] + size['width'] / 2
                y = location['y'] + size['height'] / 2
                
                actions = ActionChains(driver)
                actions.move_by_offset(x, y).click().perform()
                click_successful = True
                print("Successfully clicked menu button using coordinates.", flush=True)
            except Exception as e:
                print(f"Method 5 failed: {e}", flush=True)
        
        if not click_successful:
            print("All click methods failed. Taking screenshot...", flush=True)
            # driver.save_screenshot("menu_click_failed.png")
            return False
        
        time.sleep(2)
        
        # Click on "New group" option
        new_group_selectors = [
            "//div[contains(text(), 'New group')]",
            "//span[contains(text(), 'New group')]",
            "//div[@role='button' and contains(., 'New group')]",
            "//li[contains(., 'New group')]",
            "//div[contains(@class, 'menu-item') and contains(., 'New group')]"
        ]
        
        new_group_button = None
        for selector in new_group_selectors:
            try:
                new_group_button = wait.until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found 'New group' button using selector: {selector}", flush=True)
                break
            except:
                print(f"Could not find 'New group' button with selector: {selector}", flush=True)
        
        if not new_group_button:
            print("Could not find 'New group' button. Taking screenshot...", flush=True)
            # driver.save_screenshot("new_group_button_missing.png")
            return False
        
        # Click New group with fallback methods
        try:
            new_group_button.click()
            print("Clicked on 'New group' button.", flush=True)
        except:
            try:
                driver.execute_script("arguments[0].click();", new_group_button)
                print("Clicked on 'New group' button using JavaScript.", flush=True)
            except Exception as e:
                print(f"Failed to click 'New group' button: {e}", flush=True)
                return False
        
        time.sleep(3)
        
        # Search for the contact by phone number
        search_input_selectors = [
    "//input[@placeholder='Search name or number']",  # ✅ move this to top
    "//div[@role='textbox' and @contenteditable='true']",
    "//div[@contenteditable='true' and @data-tab='3']",
    "//div[@contenteditable='true' and contains(@class, 'selectable-text')]",
    "//div[@role='textbox']",
    "//div[@contenteditable='true']"
]
        
        search_input = None
        for selector in search_input_selectors:
            try:
                search_input = wait.until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found search input using selector: {selector}", flush=True)
                break
            except:
                print(f"Could not find search input with selector: {selector}", flush=True)
        
        if not search_input:
            print("Could not find search input field. Taking screenshot...", flush=True)
            # driver.save_screenshot("search_input_missing.png")
            return False
        
        # Clear and enter the phone number
        search_input.clear()
        search_input.send_keys(phone_number)
        print(f"Entered phone number: {phone_number}", flush=True)
        driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input'));", search_input, phone_number)
        time.sleep(3)
        
        # Click on the contact from search results
        # Format the phone number to match WhatsApp's display format
        if phone_number.startswith('+'):
            # Already formatted with country code
            formatted_number = phone_number
        elif phone_number.startswith('91') and len(phone_number) == 12:
            # 12-digit number starting with 91 (91 + 10 digit mobile)
            formatted_number = f"+{phone_number[:2]} {phone_number[2:7]} {phone_number[7:]}"
        elif len(phone_number) == 10:
            # 10-digit Indian mobile number
            formatted_number = f"+91 {phone_number[:5]} {phone_number[5:]}"
        else:
            # Default: assume it's an Indian number without country code
            formatted_number = f"+91 {phone_number}"
        
        try:
            # Wait for the contact to appear using the phone number title
            contact_card = wait.until(
                EC.element_to_be_clickable((By.XPATH, f"//div[@role='button'][.//span[@title='{formatted_number}']]"))
            )
            contact_card.click()
            print(f"Clicked on contact card for: {formatted_number}", flush=True)
        except Exception as e:
            print(f"Failed to select contact: {e}", flush=True)
            driver.save_screenshot("contact_selection_error.png")
            print("Taking screenshot of contact selection error.", flush=True)
            try:
                contact_cards = wait.until(
                    EC.presence_of_all_elements_located((By.XPATH, "//div[@role='button']"))
                )
                if contact_cards:
                    driver.execute_script("arguments[0].click();", contact_cards[0])
                    print("Clicked top contact result as fallback.", flush=True)
                else:
                    print("No contact cards found.", flush=True)
                    return False
            except Exception as e:
                print(f"Fallback contact selection failed: {e}", flush=True)
                return False

        time.sleep(2)
        
        try:
            arrow_forward_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[@role='button' and @aria-label='Next']"))
            )
            arrow_forward_button.click()
            print("Clicked Next button", flush=True)
        except:
            try:
                # Fallback to JavaScript click
                arrow_forward_button = driver.find_element(By.XPATH, "//div[@role='button' and @aria-label='Next']")
                driver.execute_script("arguments[0].click();", arrow_forward_button)
                print("Clicked Next button using JavaScript", flush=True)
            except Exception as e:
                print(f"Failed to click Next button: {e}", flush=True)
                return False
        
        time.sleep(3)
        
        try:
            checkmark_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[@role='button' and @aria-label='Create group']"))
            )
            checkmark_button.click()
            print("Clicked Create group button", flush=True)
        except:
            try:
                # Fallback to JavaScript click
                checkmark_button = driver.find_element(By.XPATH, "//div[@role='button' and @aria-label='Create group']")
                driver.execute_script("arguments[0].click();", checkmark_button)
                print("Clicked Create group button using JavaScript", flush=True)
            except Exception as e:
                print(f"Failed to click Create group button: {e}", flush=True)
                return False
        
        try:
            # Look for the "Name this group" button that's visible in the screenshot
            name_group_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Name this group')]"))
            )
            # Scroll into view and click
            driver.execute_script("arguments[0].scrollIntoView(true);", name_group_button)
            time.sleep(1)
            name_group_button.click()
            print("Clicked 'Name this group' button", flush=True)
            
        except Exception as e:
            try:
                # Alternative approach - look for button with pencil icon and "Name this group" text
                name_group_button = wait.until(
                    EC.element_to_be_clickable((By.XPATH, "//button[.//span[@data-icon='pencil']]"))
                )
                driver.execute_script("arguments[0].scrollIntoView(true);", name_group_button)
                time.sleep(1)
                name_group_button.click()
                print("Clicked 'Name this group' button (pencil icon method)", flush=True)
                
            except Exception as e2:
                try:
                    # JavaScript click as fallback
                    name_group_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Name this group')]")
                    driver.execute_script("arguments[0].scrollIntoView(true);", name_group_button)
                    time.sleep(1)
                    driver.execute_script("arguments[0].click();", name_group_button)
                    print("Clicked 'Name this group' button using JavaScript", flush=True)
                    
                except Exception as e3:
                    try:
                        # Try clicking on any element containing "Name this group"
                        name_element = driver.find_element(By.XPATH, "//*[contains(text(), 'Name this group')]")
                        driver.execute_script("arguments[0].scrollIntoView(true);", name_element)
                        time.sleep(1)
                        driver.execute_script("arguments[0].click();", name_element)
                        print("Clicked 'Name this group' element using JavaScript", flush=True)
                        
                    except Exception as e4:
                        print(f"Failed to click 'Name this group' button: {e}, {e2}, {e3}, {e4}", flush=True)
                        driver.save_screenshot("name_group_button_not_found.png")
                        return False

        time.sleep(3)  # Wait for the input field to appear

        # Diagnostic version to understand the input field behavior

        try:
            # Find the input field
            group_name_input = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[@contenteditable='true']"))
            )
            
            # Get initial state
            initial_text = group_name_input.text
            initial_innerHTML = driver.execute_script("return arguments[0].innerHTML;", group_name_input)
            initial_value = driver.execute_script("return arguments[0].value || '';", group_name_input)
            
            print(f"Initial text: '{initial_text}'", flush=True)
            print(f"Initial innerHTML: '{initial_innerHTML}'", flush=True)
            print(f"Initial value: '{initial_value}'", flush=True)
            
            # Get all attributes
            attributes = driver.execute_script("""
                var items = {};
                for (var i = 0; i < arguments[0].attributes.length; i++) {
                    items[arguments[0].attributes[i].name] = arguments[0].attributes[i].value;
                }
                return items;
            """, group_name_input)
            print(f"Element attributes: {attributes}", flush=True)
            
            # Try the JavaScript method with logging
            print("Focusing element...", flush=True)
            driver.execute_script("arguments[0].focus();", group_name_input)
            time.sleep(1)
            
            print("Clearing content...", flush=True)
            driver.execute_script("arguments[0].innerHTML = '';", group_name_input)
            time.sleep(0.5)
            
            # Check if clearing worked
            cleared_text = group_name_input.text
            cleared_innerHTML = driver.execute_script("return arguments[0].innerHTML;", group_name_input)
            print(f"After clearing - text: '{cleared_text}', innerHTML: '{cleared_innerHTML}'", flush=True)
            
            print(f"Setting text to '{group_name}'...", flush=True)
            driver.execute_script("arguments[0].textContent = arguments[1];", group_name_input, group_name)
            time.sleep(1)
            
            # Check if setting worked
            after_text = group_name_input.text
            after_innerHTML = driver.execute_script("return arguments[0].innerHTML;", group_name_input)
            print(f"After setting - text: '{after_text}', innerHTML: '{after_innerHTML}'", flush=True)
            
            print("Triggering events...", flush=True)
            driver.execute_script("""
                var element = arguments[0];
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('keyup', { bubbles: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true }));
            """, group_name_input)
            
            time.sleep(2)
            
            # Final check
            final_text = group_name_input.text
            final_innerHTML = driver.execute_script("return arguments[0].innerHTML;", group_name_input)
            print(f"Final - text: '{final_text}', innerHTML: '{final_innerHTML}'", flush=True)
            
            # Try to find and click any confirmation button
            print("Looking for confirmation button...", flush=True)
            try:
                confirm_selectors = [
                    "//div[@data-icon='checkmark-medium']",
                    "//span[@data-icon='checkmark']",
                    "//button[contains(@aria-label, 'Done')]",
                    "//button[contains(@aria-label, 'Save')]",
                    "//div[@role='button' and contains(@aria-label, 'Done')]",
                    "//div[@role='button' and contains(@aria-label, 'Save')]"
                ]
                
                for selector in confirm_selectors:
                    try:
                        confirm_button = driver.find_element(By.XPATH, selector)
                        print(f"Found confirm button with selector: {selector}", flush=True)
                        confirm_button.click()
                        print("Clicked confirm button", flush=True)
                        break
                    except:
                        continue
                else:
                    print("No confirm button found, trying Enter key", flush=True)
                    group_name_input.send_keys(Keys.ENTER)
            
            except Exception as e:
                print(f"Error with confirmation: {e}", flush=True)
            
            time.sleep(3)
            driver.save_screenshot("diagnostic_final.png")
            
            # Check if the group name changed in the UI
            try:
                # Look for the group name in the chat header or anywhere in the page
                group_name_elements = driver.find_elements(By.XPATH, f"//*[contains(text(), '{group_name}')]")
                if group_name_elements:
                    print(f"SUCCESS: Found '{group_name}' in {len(group_name_elements)} elements", flush=True)
                    return True
                else:
                    print(f"FAILED: Could not find '{group_name}' anywhere on the page", flush=True)
                    return False
            except Exception as e:
                print(f"Error checking for group name: {e}", flush=True)
                return False

        except Exception as e:
            print(f"Diagnostic failed: {e}", flush=True)
            driver.save_screenshot("diagnostic_error.png")
            return False
        # Verify group creation was successful
        try:
            # Look for group chat indicators
            group_indicators = [
                f"//span[contains(text(), '{group_name}')]",
                "//div[@data-testid='conversation-header']",
                "//div[contains(@class, 'group-info')]"
            ]
            
            for indicator in group_indicators:
                try:
                    wait.until(
                        EC.presence_of_element_located((By.XPATH, indicator))
                    )
                    print(f"Group creation verified using indicator: {indicator}", flush=True)
                    break
                except:
                    continue
            
            print(f"Group '{group_name}' created successfully with contact {phone_number}!", flush=True)
            # driver.save_screenshot("group_created_success.png")
            return True
            
        except Exception as verify_error:
            print(f"Could not verify group creation: {verify_error}", flush=True)
            # driver.save_screenshot("group_creation_verification_failed.png")
            return False
        
    except Exception as e:
        print(f"Error during group creation process: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        try:
            # driver.save_screenshot("group_creation_error.png")
            print("Screenshot saved as group_creation_error.png", flush=True)
        except:
            print("Failed to save screenshot", flush=True)
        return False
     
if __name__ == "__main__":
    # Main function to run the WhatsApp automation
    if len(sys.argv) < 1:
        print("Usage: python whatsapp.py whatsappNumber messagesJson receiverNumber",flush=True)
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = sys.argv[1]
        # Start the WhatsApp automation
    open_whatsapp(whatsapp_number)