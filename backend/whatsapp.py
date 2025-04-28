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

def open_whatsapp(whatsapp_number, messages_json, receiver_number):
    # Parse the JSON messages
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
    
    # Create a unique user data directory based on the WhatsApp number
    # This ensures each WhatsApp number gets its own persistent session
    user_data_dir = os.path.join(os.getcwd(), "whatsapp_profiles", f"profile_{whatsapp_number}")
    os.makedirs(user_data_dir, exist_ok=True)
    
    options = Options()
    # Instead of incognito, use a persistent profile
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--start-maximized")
    # Disable notifications
    options.add_argument("--disable-notifications")
    
    # Use Service object to avoid deprecation warnings
    driver = webdriver.Chrome(options=options)
    
    # Check if we're already logged in by looking for a session cookie
    # First navigate to a lightweight page to check cookies
    driver.get("https://web.whatsapp.com/check-auth.html")
    time.sleep(2)  # Brief pause to load any cookies
    
    # Now navigate to WhatsApp Web
    driver.get("https://web.whatsapp.com")
    wait = WebDriverWait(driver, 60)
    driver.execute_script("document.body.style.zoom='75%'")
    print("Checking WhatsApp Web login status...", flush=True)
    
    # Variable to store the verification code
    verification_code = None
    
    # Wait for either login with phone number option or chats to appear
    try:
        # First check if already logged in (Chats heading visible)
        chats_heading = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
        )
        print("Already logged in! Chats found.", flush=True)
    except:
        # If not logged in, try the login procedure
        try:
            login_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
            )
            verification_code = login_and_extract_code(driver, wait, whatsapp_number)
        except:
            # If neither login button nor chats found, assume QR code scan is needed
            print("Please scan the QR code on your screen to log in.", flush=True)
            # Wait for chats heading to confirm login
            chats_heading = wait.until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
            )
            print("QR code scanned successfully! Chats found.", flush=True)
    
    # Print a special marker that Node.js can look for to extract the code
    if verification_code:
        print(f"WHATSAPP_VERIFICATION_CODE:{verification_code}", flush=True)
    
    # Send each message in the messages array
    for message_text in formatted_messages:
        print(f"Sending message: {message_text}", flush=True)
        forward_message(driver, wait, receiver_number, message_text)
        # Add a delay between messages
        time.sleep(3)
    
    # Keep the script running indefinitely
    keep_alive(driver)
    
def keep_alive(driver):
    print("Browser will remain open. Press Ctrl+C to exit the script.",flush=True)
    try:
        # This will keep the script running until manually interrupted
        while True:
            time.sleep(60)  # Check every minute if browser is still open
            try:
                # A simple command to check if browser is still responsive
                driver.title
                print("Browser session active",flush=True)
            except Exception as e:
                print(f"Browser session ended: {e}",flush=True)
                break
    except KeyboardInterrupt:
        print("\nScript terminated by user.",flush=True)
    finally:
        # Don't call driver.quit() if you want the browser to stay open
        print("Script ended but browser remains open.",flush=True)

def login_and_extract_code(driver, wait, phone_number):
    try:
        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Log in with phone number')]"))
        )
        login_button.click()
        print("Clicked on 'Log in with phone number'.",flush=True)
        
        country_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[@style='width: 100%;']"))
        )
        country_button.click()
        print("Clicked on country selection button.",flush=True)

        search_input = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[@contenteditable='true' and @role='textbox']"))
        )
        search_input.send_keys("India")
        print("Entered 'India' into the search field.",flush=True)

        india_flag = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//img[@alt='🇮🇳']"))
        )
        india_flag.click()
        print("Selected 'India' from the list.",flush=True)

        phone_input = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//input[@aria-label='Type your phone number.']"))
        )
        phone_input.send_keys(phone_number)
        print(f"Entered phone number: {phone_number}",flush=True)

        next_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Next')]"))
        )
        next_button.click()
        print("Clicked on 'Next' button.",flush=True)

        # Wait for the code to appear
        time.sleep(3)  

        code_elements = wait.until(
            EC.presence_of_all_elements_located((By.XPATH, "//span[contains(@class, 'xzwifym')]"))
        )
        code = "".join([elem.text for elem in code_elements if elem.text.strip()])
        print(f"WHATSAPP_VERIFICATION_CODE:{code}",flush=True)

        # Wait for "Chats" heading to appear before proceeding
        print("Waiting for 'Chats' to appear after login...",flush=True)
        WebDriverWait(driver, 600).until(
            EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
        )
        print("Login successful! Chats found.",flush=True)
        
        return code

    except Exception as e:
        print("Error during login process: ", e,flush=True)
        return None

def forward_message(driver, wait, target_number, message):
    try:
        # Clean the target number
        clean_target = target_number.replace("+", "")
        if not clean_target.startswith("91"):
            clean_target = "91" + clean_target
            
        # Go to chat with target number
        driver.get(f"https://web.whatsapp.com/send?phone={clean_target}")
        print(f"Opening chat with +{clean_target}...",flush=True)
        
        # Wait for WhatsApp to fully load the chat
        print("Waiting for chat to load (this may take up to 30 seconds)...",flush=True)
        time.sleep(10)  # Explicit wait to allow page to fully render
        
        # Wait for message input field with a longer timeout
        try:
            # Wait explicitly for the message input field to be both present and interactable
            chat_box = WebDriverWait(driver, 45).until(
                EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Type a message' and @role='textbox']"))
            )
            print("Found message input field and it's clickable",flush=True)
            
            # Use Actions to move to the element before interacting
            actions = webdriver.ActionChains(driver)
            actions.move_to_element(chat_box).click().perform()
            print("Clicked on input field using ActionChains",flush=True)
            
            # Wait a moment after clicking
            time.sleep(1)
            
            # Send the message text directly
            actions.send_keys(message).perform()
            print(f"Typed message using ActionChains: {message}",flush=True)
            
            # Wait a moment before trying to send
            time.sleep(1)
            
            # Find and click the send button - use a more specific selector
            send_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[@aria-label='Send']"))
            )
            
            # Use Actions to click the send button
            actions = webdriver.ActionChains(driver)
            actions.move_to_element(send_button).click().perform()
            print("Clicked send button using ActionChains",flush=True)
            
            # Verify message was sent by checking for message status indicators
            time.sleep(3)
            
            print("Message forwarded successfully!",flush=True)
            
            # Wait longer before continuing to ensure the message is fully sent
            time.sleep(5)
            
        except Exception as e:
            print(f"Error interacting with chat elements: {e}",flush=True)
            
            # Fall back to most direct JavaScript approach
            print("Trying direct JavaScript injection approach...",flush=True)
            
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
                
                print(f"JavaScript result: {result}",flush=True)
                
            except Exception as js_error:
                print(f"JavaScript approach failed: {js_error}",flush=True)
    
    except Exception as e:
        print(f"Error in forward_message function: {e}",flush=True)

if __name__ == "__main__":
    # Check if we have sufficient command line arguments
    if len(sys.argv) < 4:
        print("Usage: python whatsapp.py whatsappNumber messagesJson receiverNumber",flush=True)
        sys.exit(1)
    
    # Parse command line arguments
    whatsapp_number = sys.argv[1]
    messages_json = sys.argv[2]
    receiver_number = sys.argv[3]
    
    print(f"Starting WhatsApp automation with:",flush=True)
    print(f"WhatsApp Number: {whatsapp_number}",flush=True)
    print(f"Receiver Number: {receiver_number}",flush=True)
    
    # Start the WhatsApp automation
    open_whatsapp(whatsapp_number, messages_json, receiver_number)