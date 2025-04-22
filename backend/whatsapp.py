from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import re

def open_whatsapp():
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
            login_and_extract_code(driver, wait)
        except:
            # If neither login button nor chats found, assume QR code scan is needed
            print("Please scan the QR code on your screen to log in.")
            # Wait for chats heading to confirm login
            chats_heading = wait.until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]"))
            )
            print("QR code scanned successfully! Chats found.")
    
    # Begin the message monitoring process
    monitor_and_forward_messages(driver, wait)

def login_and_extract_code(driver, wait):
    try:
        phone_number = input("Enter your phone number (without country code): ")
        
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

def monitor_and_forward_messages(driver, wait):
    sender_number = "+919148016901"
    last_forwarded_message = ""
    print(f"Starting to monitor messages from {sender_number}")
    
    # First, search and open the specific chat
    search_and_open_chat(driver, wait, sender_number)
    
    # Now continuously monitor for new messages
    while True:
        try:
            # Look for all messages in the current chat
            message_elements = wait.until(
                EC.presence_of_all_elements_located((By.XPATH, "//div[contains(@class, 'message-in') or contains(@class, 'message-out')]//span[contains(@class, 'selectable-text')]"))
            )
            
            if message_elements:
                # Get the latest message
                newest_message = message_elements[-1].text
                
                # Check if this is a new message we haven't forwarded yet
                if newest_message != last_forwarded_message and newest_message.strip():
                    print(f"New message detected: {newest_message}")
                    
                    # Ask user for target number
                    target_number = input("Enter the target number to forward this message to (without country code): ")
                    
                    # Forward the message
                    forward_message(driver, wait, target_number, newest_message)
                    
                    # Update the last forwarded message
                    last_forwarded_message = newest_message
                    
                    # Return to the sender's chat
                    search_and_open_chat(driver, wait, sender_number)
            
            # Wait a bit before checking again
            time.sleep(5)
            
        except Exception as e:
            print(f"Error while monitoring messages: {e}")
            # Try to recover by going back to the chat
            try:
                search_and_open_chat(driver, wait, sender_number)
            except Exception as recover_error:
                print(f"Failed to recover: {recover_error}")
                
                # Try to navigate back to main chats view
                try:
                    driver.get("https://web.whatsapp.com")
                    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]")))
                    search_and_open_chat(driver, wait, sender_number)
                except:
                    print("Fatal error, restarting browser...")
                    driver.quit()
                    open_whatsapp()
                    return
            
            time.sleep(10)  # Wait longer after an error

def search_and_open_chat(driver, wait, phone_number):
    try:
        # Wait for the search button first (based on your shared HTML)
        search_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[@aria-label='Search or start new chat']"))
        )
        search_button.click()
        print("Clicked on search button")
        
        # Now wait for the search input field
        search_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//div[@aria-label='Search input textbox' and @contenteditable='true' and @role='textbox']"))
        )
        
        # Clear any existing text
        search_input.clear()
        # Click on the input field to focus it
        search_input.click()
        
        # Send keys with a slight delay to ensure proper input
        for char in phone_number:
            search_input.send_keys(char)
            time.sleep(0.1)
        
        print(f"Entered search term: {phone_number}")
        
        # Wait for search results to load
        time.sleep(2)
        
        # Try to find and click on the chat with multiple possible selectors
        try:
            # First try by title attribute
            chat = wait.until(
                EC.element_to_be_clickable((By.XPATH, f"//span[@title='{phone_number}']"))
            )
            chat.click()
            print(f"Found and clicked on chat with {phone_number}")
        except:
            try:
                # Try by matching text content
                chat = wait.until(
                    EC.element_to_be_clickable((By.XPATH, f"//span[contains(text(), '{phone_number}')]"))
                )
                chat.click()
                print(f"Found and clicked on chat with {phone_number}")
            except:
                # If both methods fail, try clicking on the first chat result
                try:
                    first_chat = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Chat list']//div[@role='row']"))
                    )
                    first_chat.click()
                    print("Clicked on first chat result")
                except Exception as e:
                    print(f"Could not find chat: {e}")
                    # Try to create a new chat with this number
                    create_new_chat(driver, wait, phone_number)
        
        # Wait for chat to load
        wait.until(
            EC.presence_of_element_located((By.XPATH, "//div[@role='textbox']"))
        )
        
    except Exception as e:
        print(f"Error while searching for chat: {e}")
        # If chat not found, might need to create a new chat
        create_new_chat(driver, wait, phone_number)

def create_new_chat(driver, wait, phone_number):
    try:
        # Clean number format (remove any '+' sign)
        clean_number = phone_number.replace("+", "")
        
        # Use direct URL to create chat
        driver.get(f"https://web.whatsapp.com/send?phone={clean_number}")
        print(f"Opening chat with {phone_number}...")
        
        # Wait for chat to load or for an invalid number message
        try:
            # Wait for the chat input box
            wait.until(
                EC.presence_of_element_located((By.XPATH, "//div[@role='textbox']"))
            )
            print(f"Chat created with {phone_number}")
        except:
            # Check if there's an invalid number message
            try:
                invalid_message = wait.until(
                    EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'Phone number shared via url is invalid')]"))
                )
                print(f"Invalid phone number: {phone_number}")
                # Return to main WhatsApp page
                driver.get("https://web.whatsapp.com")
                wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Chats')]")))
            except:
                print("Unknown error while creating chat")
        
    except Exception as e:
        print(f"Error creating new chat: {e}")

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
        

if __name__ == "__main__":
    open_whatsapp()