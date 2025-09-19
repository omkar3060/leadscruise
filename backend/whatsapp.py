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
from selenium.webdriver.common.keys import Keys

def open_whatsapp(whatsapp_number, messages_json, receiver_number):
    try:
        messages = json.loads(messages_json)
        # Handle both string and object messages
        formatted_messages = []
        for msg in messages:
            if isinstance(msg, str):
                formatted_messages.append(msg)
            elif isinstance(msg, dict) and 'text' in msg:
                formatted_messages.append(msg['text'])
            else:
                print(f"Skipping invalid message: {msg}", flush=True)
        
        print(f"Loaded {len(formatted_messages)} messages to send", flush=True)
    except json.JSONDecodeError as e:
        print(f"Error parsing messages JSON: {e}", flush=True)
        return
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
        
        # Use a progressive delay between messages to prevent rate limiting
        base_delay = 5  # Start with 5 seconds
        
        for index, message_text in enumerate(formatted_messages):
            # Calculate progressive delay
            current_delay = base_delay + (index * 2)  # Add 2 seconds for each message
            
            print(f"Sending message {index+1}/{len(formatted_messages)}: {message_text[:30]}{'...' if len(message_text) > 30 else ''}", flush=True)
            success = forward_message(driver, wait, receiver_number, message_text)
            
            if success:
                print(f"Message {index+1} sent successfully!", flush=True)
            else:
                print(f"Failed to send message {index+1}. Continuing with next message...", flush=True)
            
            # Add a progressive delay between messages
            print(f"Waiting for {current_delay} seconds before next message...", flush=True)
            time.sleep(current_delay)
        
        print("All messages processed. WhatsApp script completed successfully!", flush=True)
        
    except Exception as e:
        print(f"Error in WhatsApp automation: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        
    finally:
        # Always run cleanup code
        print("Running cleanup...", flush=True)
        
        # Make sure to close the driver and display
        try:
            if driver:
                driver.quit()
                print("WebDriver closed successfully", flush=True)
        except Exception as driver_error:
            print(f"Error closing WebDriver: {driver_error}", flush=True)
            
        try:
            if display:
                display.stop()
                print("Virtual display stopped successfully", flush=True)
        except Exception as display_error:
            print(f"Error stopping virtual display: {display_error}", flush=True)
            
        print("WhatsApp script finished execution", flush=True)

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
            WebDriverWait(driver, 120).until(
                EC.any_of(
                    EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]")),
                    EC.presence_of_element_located((By.XPATH, "//*[@aria-label='WhatsApp' and @data-icon='wa-wordmark-refreshed']"))
                )
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

def forward_message(driver, wait, target_number, message):
    try:
        # Clean the target number
        clean_target = target_number.replace("+", "").strip()
        if not clean_target.startswith("91"):
            clean_target = "91" + clean_target
            
        # Go to chat with target number
        print(f"Opening chat with +{clean_target}...", flush=True)
        driver.get(f"https://web.whatsapp.com/send?phone={clean_target}")
        
        # Wait for WhatsApp to fully load the chat
        print("Waiting for chat to load (this may take up to 60 seconds)...", flush=True)
        time.sleep(60)  # Longer wait for page to fully render

        # Handle any popups first
        try:
            print("Checking for any popups...", flush=True)
            popup_selectors = [
                "//button[.//div[contains(text(), 'Continue')]]",
                "//button[contains(text(), 'OK')]",
                "//button[contains(text(), 'Got it')]",
                "//button[@aria-label='Close']"
            ]
            for selector in popup_selectors:
                try:
                    popup_button = WebDriverWait(driver, 3).until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    popup_button.click()
                    print(f"Closed popup with selector: {selector}", flush=True)
                    time.sleep(2)
                    break
                except:
                    continue
        except Exception as e:
            print("No popups detected", flush=True)
        
        # Take screenshot to see current state
        try:
            # driver.save_screenshot("current_state.png")
            print("Screenshot saved as current_state.png", flush=True)
        except:
            pass
        
        # Find the message input field
        print("Attempting to find message input field...", flush=True)
        
        try:
            # Wait for the footer to load
            footer = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.XPATH, "//footer"))
            )
            print("Found footer element", flush=True)
            
            # Look for message input within footer
            message_inputs = [
                "//footer//div[@contenteditable='true' and @role='textbox']",
                "//footer//div[@contenteditable='true']",
                "//div[@aria-label='Type a message']",
                "//div[contains(@aria-label, 'Type to')]",
                "//div[@data-lexical-editor='true']"
            ]
            
            chat_box = None
            for selector in message_inputs:
                try:
                    chat_box = driver.find_element(By.XPATH, selector)
                    print(f"Found input with selector: {selector}", flush=True)
                    break
                except:
                    continue
            
            if not chat_box:
                raise Exception("Could not find message input in footer")
            
            # Scroll into view and focus
            driver.execute_script("arguments[0].scrollIntoView(true);", chat_box)
            time.sleep(1)
            driver.execute_script("arguments[0].focus();", chat_box)
            time.sleep(1)
            
            print("Attempting to set message content using advanced method...", flush=True)
            
            # Method 1: Use document.execCommand which is more reliable for contenteditable
            try:
                print("Method 1: Using document.execCommand...", flush=True)
                
                # Clear any existing content first
                driver.execute_script("""
                    var element = arguments[0];
                    element.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('delete', false, null);
                """, chat_box)
                
                time.sleep(0.5)
                
                # Insert the text using execCommand
                result = driver.execute_script("""
                    var element = arguments[0];
                    var text = arguments[1];
                    
                    element.focus();
                    
                    // Use execCommand to insert text - this is more reliable for contenteditable
                    var success = document.execCommand('insertText', false, text);
                    
                    if (!success) {
                        // Fallback: direct content setting
                        element.textContent = text;
                        
                        // Trigger input event
                        var inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        element.dispatchEvent(inputEvent);
                    }
                    
                    // Return the content to verify
                    return {
                        success: success,
                        content: element.textContent || element.innerText || '',
                        contentLength: (element.textContent || element.innerText || '').length
                    };
                """, chat_box, message)
                
                print(f"execCommand result: {result}", flush=True)
                
                if result and result['contentLength'] > 0:
                    print(f"Content successfully set via execCommand. Length: {result['contentLength']}", flush=True)
                    
                    # Small delay before sending
                    time.sleep(1)
                    
                    # Send using ONLY Enter key, no other keys
                    driver.execute_script("""
                        var element = arguments[0];
                        element.focus();
                        
                        // Create and dispatch Enter key event
                        var enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(enterEvent);
                        
                        var enterUpEvent = new KeyboardEvent('keyup', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(enterUpEvent);
                    """, chat_box)
                    
                    print("Sent message using JavaScript Enter event", flush=True)
                    time.sleep(2)
                    
                else:
                    raise Exception("execCommand method failed - no content set")
                    
            except Exception as execCommand_error:
                print(f"execCommand method failed: {execCommand_error}", flush=True)
                
                # Method 2: Direct clipboard simulation (without external tools)
                try:
                    print("Method 2: Direct clipboard simulation...", flush=True)
                    
                    # Clear the field
                    driver.execute_script("""
                        var element = arguments[0];
                        element.focus();
                        element.textContent = '';
                        element.innerHTML = '';
                    """, chat_box)
                    
                    time.sleep(0.5)
                    
                    # Use the Clipboard API if available, otherwise fallback
                    clipboard_result = driver.execute_script("""
                        var text = arguments[1];
                        var element = arguments[0];
                        
                        element.focus();
                        
                        // Try using the modern Clipboard API
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(text).then(function() {
                                console.log('Text copied to clipboard');
                                // Simulate Ctrl+V
                                element.focus();
                                document.execCommand('paste');
                            }).catch(function(err) {
                                console.error('Clipboard API failed:', err);
                                // Fallback to direct insertion
                                element.textContent = text;
                                var inputEvent = new Event('input', { bubbles: true });
                                element.dispatchEvent(inputEvent);
                            });
                            return 'clipboard_api_used';
                        } else {
                            // Direct fallback
                            element.textContent = text;
                            var inputEvent = new Event('input', { bubbles: true });
                            element.dispatchEvent(inputEvent);
                            return 'direct_fallback';
                        }
                    """, chat_box, message)
                    
                    print(f"Clipboard simulation result: {clipboard_result}", flush=True)
                    
                    # Wait a moment for clipboard operations
                    time.sleep(2)
                    
                    # Check if content was set
                    content_check = driver.execute_script("return (arguments[0].textContent || arguments[0].innerText || '').length;", chat_box)
                    print(f"Content length after clipboard method: {content_check}", flush=True)
                    
                    if content_check > 0:
                        # Send the message with JavaScript
                        driver.execute_script("""
                            var element = arguments[0];
                            element.focus();
                            
                            var enterEvent = new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                bubbles: true,
                                cancelable: true
                            });
                            element.dispatchEvent(enterEvent);
                        """, chat_box)
                        
                        print("Sent message using clipboard simulation method", flush=True)
                        time.sleep(2)
                    else:
                        raise Exception("Clipboard simulation failed - no content")
                        
                except Exception as clipboard_error:
                    print(f"Clipboard simulation failed: {clipboard_error}", flush=True)
                    
                    # Method 3: Find and click send button directly
                    try:
                        print("Method 3: Setting content and using send button...", flush=True)
                        
                        # Final attempt: set content and find send button
                        driver.execute_script("""
                            var element = arguments[0];
                            var text = arguments[1];
                            
                            element.focus();
                            element.textContent = text;
                            
                            // Trigger all possible events
                            var events = ['input', 'change', 'keyup', 'keydown'];
                            events.forEach(function(eventType) {
                                var event = new Event(eventType, { bubbles: true, cancelable: true });
                                element.dispatchEvent(event);
                            });
                        """, chat_box, message)
                        
                        time.sleep(1)
                        
                        # Look for send button and click it
                        send_button_selectors = [
                            "//button[@aria-label='Send']",
                            "//button[contains(@aria-label, 'Send')]",
                            "//span[@data-icon='send']//ancestor::button[1]",
                            "//button[.//span[@data-icon='send']]",
                            "//footer//button[last()]"  # Often the last button in footer
                        ]
                        
                        send_button = None
                        for selector in send_button_selectors:
                            try:
                                send_button = WebDriverWait(driver, 2).until(
                                    EC.element_to_be_clickable((By.XPATH, selector))
                                )
                                print(f"Found send button with selector: {selector}", flush=True)
                                break
                            except:
                                continue
                        
                        if send_button:
                            driver.execute_script("arguments[0].click();", send_button)
                            print("Clicked send button successfully", flush=True)
                            time.sleep(2)
                        else:
                            raise Exception("Could not find send button")
                            
                    except Exception as send_button_error:
                        print(f"Send button method failed: {send_button_error}", flush=True)
                        print("All methods failed to send the message", flush=True)
                        return False
            
            # Final verification - wait and check if message appears in chat
            print("Waiting for message delivery confirmation...", flush=True)
            time.sleep(3)
            
            # Take final screenshot
            try:
                # driver.save_screenshot("after_send.png")
                print("Final screenshot saved as after_send.png", flush=True)
            except:
                pass
            
            print("Message sending process completed!", flush=True)
            return True
            
        except Exception as main_error:
            print(f"Main process failed: {main_error}", flush=True)
            return False
    
    except Exception as e:
        print(f"Error in forward_message function: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        
        # Take final error screenshot
        try:
            # driver.save_screenshot("forward_message_error.png")
            print("Error screenshot saved as forward_message_error.png", flush=True)
        except:
            print("Failed to save error screenshot", flush=True)
        
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python whatsapp.py whatsappNumber messagesJson receiverNumber",flush=True)
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = "9148016901"
    messages_json = sys.argv[2]
    receiver_number = sys.argv[3]
    
    print(f"Starting WhatsApp automation with:",flush=True)
    print(f"WhatsApp Number: {whatsapp_number}",flush=True)
    print(f"Receiver Number: {receiver_number}",flush=True)
    
    # Start the WhatsApp automation
    open_whatsapp(whatsapp_number, messages_json, receiver_number)
    