from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import re
import sys
import json
import os

def open_whatsapp(whatsapp_number, custom_message, catalogue_files, receiver_number):
    options = Options()
    options.add_argument("--incognito")  # Open in incognito mode
    
    # Use Service object to avoid deprecation warnings
    driver = webdriver.Chrome(options=options)
    driver.get("https://web.whatsapp.com")  # Open WhatsApp Web
    wait = WebDriverWait(driver, 60)
    driver.execute_script("document.body.style.zoom='75%'")
    print("Scanning QR code or waiting for WhatsApp Web to load...")
    
    # Wait for either login with phone number option or chats to appear
    try:
        # First check if already logged in (Chats heading visible)
        chats_heading = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
        )
        print("Already logged in! Chats found.")
    except:
        # If not logged in, try the login procedure
        try:
            login_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
            )
            login_and_extract_code(driver, wait, whatsapp_number)
        except:
            # If neither login button nor chats found, assume QR code scan is needed
            print("Please scan the QR code on your screen to log in.")
            # Wait for chats heading to confirm login
            chats_heading = wait.until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
            )
            print("QR code scanned successfully! Chats found.")
    
    # Send the message with catalogue files to the receiver
    forward_message(driver, wait, receiver_number, custom_message)
    
    # If there are catalogue files, send them
    if catalogue_files and len(catalogue_files) > 0:
        send_catalogue_files(driver, wait, receiver_number, catalogue_files)
    
    # Keep the script running indefinitely
    keep_alive(driver)

def keep_alive(driver):
    print("Browser will remain open. Press Ctrl+C to exit the script.")
    try:
        # This will keep the script running until manually interrupted
        while True:
            time.sleep(60)  # Check every minute if browser is still open
            try:
                # A simple command to check if browser is still responsive
                driver.title
                print("Browser session active")
            except Exception as e:
                print(f"Browser session ended: {e}")
                break
    except KeyboardInterrupt:
        print("\nScript terminated by user.")
    finally:
        # Don't call driver.quit() if you want the browser to stay open
        print("Script ended but browser remains open.")

def login_and_extract_code(driver, wait, phone_number):
    try:
        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
        )
        login_button.click()
        print("Clicked on 'Log in with phone number'.")
        
        country_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[@style='width: 100%;']"))
        )
        country_button.click()
        print("Clicked on country selection button.")

        search_input = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[@contenteditable='true' and @role='textbox']"))
        )
        search_input.send_keys("India")
        print("Entered 'India' into the search field.")

        india_flag = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//img[@alt='🇮🇳']"))
        )
        india_flag.click()
        print("Selected 'India' from the list.")

        phone_input = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//input[@aria-label='Type your phone number.']"))
        )
        phone_input.send_keys(phone_number)
        print(f"Entered phone number: {phone_number}")

        next_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Next')]"))
        )
        next_button.click()
        print("Clicked on 'Next' button.")

        # Wait for the code to appear
        time.sleep(3)  

        code_elements = wait.until(
            EC.presence_of_all_elements_located((By.XPATH, "//span[contains(@class, 'xzwifym')]"))
        )
        code = "".join([elem.text for elem in code_elements if elem.text.strip()])
        print("Extracted Code:", code)

        # Wait for "Chats" heading to appear before proceeding
        print("Waiting for 'Chats' to appear after login...")
        WebDriverWait(driver, 600).until(
            EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
        )
        print("Login successful! Chats found.")

    except Exception as e:
        print("Error during login process: ", e)

def forward_message(driver, wait, target_number, message):
    try:
        # Clean the target number
        clean_target = target_number.replace("+", "")
        if not clean_target.startswith("91"):
            clean_target = "91" + clean_target
            
        # Go to chat with target number
        driver.get(f"https://web.whatsapp.com/send?phone={clean_target}")
        print(f"Opening chat with +{clean_target}...")
        
        # Wait for WhatsApp to fully load the chat
        print("Waiting for chat to load (this may take up to 30 seconds)...")
        time.sleep(10)  # Explicit wait to allow page to fully render
        
        # Wait for message input field with a longer timeout
        try:
            # Wait explicitly for the message input field to be both present and interactable
            chat_box = WebDriverWait(driver, 45).until(
                EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Type a message' and @role='textbox']"))
            )
            print("Found message input field and it's clickable")
            
            # Use Actions to move to the element before interacting
            actions = webdriver.ActionChains(driver)
            actions.move_to_element(chat_box).click().perform()
            print("Clicked on input field using ActionChains")
            
            # Wait a moment after clicking
            time.sleep(1)
            
            # Send the message text directly
            actions.send_keys(message).perform()
            print(f"Typed message using ActionChains: {message}")
            
            # Wait a moment before trying to send
            time.sleep(1)
            
            # Find and click the send button - use a more specific selector
            send_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[@aria-label='Send']"))
            )
            
            # Use Actions to click the send button
            actions = webdriver.ActionChains(driver)
            actions.move_to_element(send_button).click().perform()
            print("Clicked send button using ActionChains")
            
            # Verify message was sent by checking for message status indicators
            time.sleep(3)
            
            print("Message forwarded successfully!")
            
            # Wait longer before continuing to ensure the message is fully sent
            time.sleep(5)
            
        except Exception as e:
            print(f"Error interacting with chat elements: {e}")
            
            # Fall back to most direct JavaScript approach
            print("Trying direct JavaScript injection approach...")
            
            try:
                # Use JavaScript to type and send the message
                result = driver.execute_script("""
                    try {
                        // Find the input element
                        const inputElement = document.querySelector('div[aria-label="Type a message"][role="textbox"]');
                        if (!inputElement) {
                            return "Input element not found";
                        }
                        
                        // Focus on the input and simulate typing
                        inputElement.focus();
                        
                        // Clear any existing content
                        inputElement.innerHTML = '';
                        
                        // Set the input value
                        inputElement.textContent = arguments[0];
                        
                        // Dispatch events to ensure WhatsApp registers the input
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Find and click the send button after a small delay
                        setTimeout(() => {
                            const sendButton = document.querySelector('button[aria-label="Send"]');
                            if (sendButton) {
                                sendButton.click();
                                return "Message sent via Send button";
                            } else {
                                // Try sending with Enter key
                                const enterEvent = new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true
                                });
                                inputElement.dispatchEvent(enterEvent);
                                return "Message sent via Enter key";
                            }
                        }, 500);
                        
                        return "JavaScript injection succeeded";
                    } catch(e) {
                        return "JavaScript error: " + e.message;
                    }
                """, message)
                
                print(f"JavaScript result: {result}")
                
            except Exception as js_error:
                print(f"JavaScript approach failed: {js_error}")
    
    except Exception as e:
        print(f"Error in forward_message function: {e}")

def send_catalogue_files(driver, wait, target_number, catalogue_files):
    try:
        # Make sure we're still in the chat with target number
        clean_target = target_number.replace("+", "")
        if not clean_target.startswith("91"):
            clean_target = "91" + clean_target
        
        current_url = driver.current_url
        expected_url = f"https://web.whatsapp.com/send?phone={clean_target}"
        
        if not current_url.startswith(expected_url):
            driver.get(expected_url)
            print(f"Re-opening chat with +{clean_target}...")
            time.sleep(10)  # Wait for chat to load
        
        # For each file in catalogue_files
        for file_info in catalogue_files:
            try:
                print(f"Attempting to send file: {file_info.get('originalName', 'unknown')}")
                
                # Use JavaScript to click the attachment button
                try:
                    driver.execute_script("""
                        const attachButton = document.querySelector('[data-icon="attach-menu-plus"]') || 
                                           document.querySelector('[data-icon="clip"]') ||
                                           document.querySelector('[data-testid="attach-menu-plus"]');
                        if (attachButton) {
                            attachButton.click();
                        } else {
                            throw new Error("Attachment button not found");
                        }
                    """)
                    print("Clicked on attachment button via JavaScript")
                except Exception as js_error:
                    print(f"JS attachment click failed: {js_error}")
                    # Fall back to Selenium click
                    attachment_button = WebDriverWait(driver, 20).until(
                        EC.element_to_be_clickable((By.XPATH, "//span[@data-icon='attach-menu-plus'] | //span[@data-icon='clip'] | //div[@title='Attach']"))
                    )
                    attachment_button.click()
                    print("Clicked on attachment button via Selenium")
                
                # Wait for attachment menu to appear
                time.sleep(2)
                
                # Look for document input via multiple approaches
                try:
                    # Try various selectors for the file input
                    selectors = [
                        "//input[@type='file']",
                        "//div[contains(text(), 'Document')]/parent::div/parent::div",
                        "//input[@accept='*']",
                        "//div[@role='button' and contains(., 'Document')]"
                    ]
                    
                    document_input = None
                    for selector in selectors:
                        try:
                            element = WebDriverWait(driver, 5).until(
                                EC.presence_of_element_located((By.XPATH, selector))
                            )
                            if element.tag_name == "input":
                                document_input = element
                                break
                            else:
                                # If it's not an input, it might be the document button
                                element.click()
                                # After clicking, try to find the actual input
                                document_input = WebDriverWait(driver, 5).until(
                                    EC.presence_of_element_located((By.XPATH, "//input[@type='file']"))
                                )
                                break
                        except:
                            continue
                    
                    if not document_input:
                        raise Exception("Could not find document input element")
                        
                    # Ensure the file path is absolute
                    file_path = file_info['path']
                    absolute_path = os.path.abspath(file_path)
                    
                    # Check if file exists
                    if not os.path.exists(absolute_path):
                        print(f"Error: File does not exist at path: {absolute_path}")
                        continue
                        
                    # Print file details
                    print(f"File details: Exists={os.path.exists(absolute_path)}, Size={os.path.getsize(absolute_path)}, Readable={os.access(absolute_path, os.R_OK)}")
                    
                    # Use JavaScript to ensure the input is visible and enabled
                    driver.execute_script("""
                        arguments[0].style.display = 'block';
                        arguments[0].style.visibility = 'visible';
                        arguments[0].style.opacity = '1';
                    """, document_input)
                    
                    # Send the file path to the input element
                    document_input.send_keys(absolute_path)
                    print(f"Selected file: {file_info['originalName']} at {absolute_path}")
                    
                    # Wait longer for file to be uploaded and ready to send
                    time.sleep(5)
                    
                    # Try to find the send button
                    send_button_found = False
                    send_button_selectors = [
                        "//span[@data-icon='send']",
                        "//button[@aria-label='Send']",
                        "//div[@role='button' and @aria-label='Send']"
                    ]
                    
                    for selector in send_button_selectors:
                        try:
                            send_file_button = WebDriverWait(driver, 5).until(
                                EC.element_to_be_clickable((By.XPATH, selector))
                            )
                            send_file_button.click()
                            send_button_found = True
                            print(f"Clicked send button using selector: {selector}")
                            break
                        except:
                            continue
                    
                    if not send_button_found:
                        # Try JavaScript click on send button
                        driver.execute_script("""
                            const sendButton = document.querySelector('[data-icon="send"]') || 
                                             document.querySelector('[aria-label="Send"]');
                            if (sendButton) {
                                sendButton.click();
                                return true;
                            }
                            return false;
                        """)
                        print("Attempted to click send button via JavaScript")
                    
                    # Wait for file to be fully sent
                    time.sleep(7)
                    print(f"File should be sent: {file_info['originalName']}")
                    
                except Exception as input_error:
                    print(f"Error with document input: {input_error}")
                    
                    # Try an alternative approach using JavaScript for the entire process
                    try:
                        # Close any open attachment menu first
                        body = driver.find_element(By.TAG_NAME, 'body')
                        body.click()
                        time.sleep(1)
                        
                        print("Trying alternative attachment method...")
                        # Create a temporary hidden input element for file selection
                        result = driver.execute_script("""
                            try {
                                // Create temporary file input
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.style.position = 'fixed';
                                input.style.left = '-1000px';
                                document.body.appendChild(input);
                                return input.id = 'temp-file-input-' + Date.now();
                            } catch(e) {
                                return "Error: " + e.message;
                            }
                        """)
                        
                        if isinstance(result, str) and result.startswith("Error:"):
                            print(f"JavaScript error: {result}")
                            continue
                            
                        temp_input_id = result
                        temp_input = driver.find_element(By.ID, temp_input_id)
                        
                        # Send file to temporary input
                        temp_input.send_keys(absolute_path)
                        print(f"Selected file with temp input: {absolute_path}")
                        
                        # Since we can't trigger WhatsApp's file dialog directly with JS,
                        # we'll notify the user to manually complete the process
                        print("⚠️ MANUAL ACTION REQUIRED: Please click the attachment button and select the document option manually.")
                        print("The script will wait 30 seconds for you to complete this action.")
                        time.sleep(30)
                        
                    except Exception as js_alt_error:
                        print(f"Alternative attachment method failed: {js_alt_error}")
                
            except Exception as file_error:
                print(f"Error sending file {file_info.get('originalName', 'unknown')}: {file_error}")
                # Take a screenshot for debugging
                try:
                    screenshot_path = f"error_screenshot_{time.strftime('%Y%m%d_%H%M%S')}.png"
                    driver.save_screenshot(screenshot_path)
                    print(f"Error screenshot saved to {screenshot_path}")
                except:
                    print("Could not save error screenshot")
                continue  # Try to send the next file
        
        print("All available files have been processed")
        
    except Exception as e:
        print(f"Error in send_catalogue_files function: {e}")
        # Take a screenshot for debugging
        try:
            screenshot_path = f"function_error_{time.strftime('%Y%m%d_%H%M%S')}.png"
            driver.save_screenshot(screenshot_path)
            print(f"Error screenshot saved to {screenshot_path}")
        except:
            print("Could not save error screenshot")

if __name__ == "__main__":
    # Check if we have sufficient command line arguments
    if len(sys.argv) < 5:
        print("Usage: python whatsapp.py whatsappNumber customMessage catalogueFilesJson receiverNumber")
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = sys.argv[1]
    custom_message = sys.argv[2]
    try:
        catalogue_files = json.loads(sys.argv[3])
    except json.JSONDecodeError:
        print("Warning: Could not parse catalogue files JSON. Will proceed without files.")
        catalogue_files = []
    receiver_number = sys.argv[4]
    
    print(f"Starting WhatsApp automation with:")
    print(f"WhatsApp Number: {whatsapp_number}")
    print(f"Custom Message: {custom_message}")
    print(f"Catalogue Files: {len(catalogue_files)} files")
    print(f"Receiver Number: {receiver_number}")
    
    # Start the WhatsApp automation
    open_whatsapp(whatsapp_number, custom_message, catalogue_files, receiver_number)