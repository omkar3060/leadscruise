from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium import webdriver
from selenium.webdriver.common.by import By
from pyvirtualdisplay import Display
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys
# from webdriver_manager.chrome import ChromeDriverManager
import os
import time
import subprocess
import sys
import json
import signal
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import threading
import select
from datetime import datetime, timedelta
# Global variable to store OTP when received
received_otp = None
otp_event = threading.Event()
stdin_lock = threading.Lock()

def read_stdin_non_blocking():
    """Read from stdin without blocking"""
    try:
        if select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], []):
            line = sys.stdin.readline()
            return line.strip() if line else None
    except:
        pass
    return None

def listen_for_otp():
    """Listen for OTP input from Node.js backend"""
    global received_otp
    
    print("Starting OTP listener thread...",flush=True)
    sys.stdout.flush()
    
    while not otp_event.is_set():
        try:
            # Check for input with a short timeout
            if select.select([sys.stdin], [], [], 0.5) == ([sys.stdin], [], []):
                with stdin_lock:
                    line = sys.stdin.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    
                    try:
                        data = json.loads(line.strip())
                        print(f"Received data in OTP thread: {data}",flush=True)
                        sys.stdout.flush()
                        
                        if data.get("type") == "OTP_RESPONSE":
                            received_otp = data.get("otp")
                            print(f"OTP captured: {received_otp}",flush=True)
                            sys.stdout.flush()
                            otp_event.set()  # Signal that OTP is received
                            return
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error in OTP thread: {e}",flush=True)
                        sys.stdout.flush()
                        continue
            else:
                # No input available, continue with short sleep
                time.sleep(0.1)
                
        except Exception as e:
            print(f"Error in OTP listener: {e}",flush=True)
            sys.stdout.flush()
            time.sleep(0.1)
    
    print("OTP listener thread exiting...",flush=True)
    sys.stdout.flush()

# Define the signal handler
def stop_execution(signum, frame):
    print("Received stop signal. Exiting gracefully...", flush=True)
    sys.exit(0)  # Exit script immediately

# Bind signal handler
signal.signal(signal.SIGINT, stop_execution)
signal.signal(signal.SIGTERM, stop_execution)

input_line = sys.stdin.readline()
input_data = json.loads(input_line.strip())
import requests
lead_bought=""

def parse_timestamp(timestamp_text):
    now = datetime.now()

    if "AM" in timestamp_text or "PM" in timestamp_text:
        # Just a time — assume today's date
        dt = datetime.strptime(timestamp_text, "%I:%M %p")
        combined = now.replace(hour=dt.hour, minute=dt.minute, second=0, microsecond=0)
        return combined.isoformat()

    elif timestamp_text.lower() == "yesterday":
        # Use yesterday's date, set time to 12:00 PM (or any default time)
        combined = (now - timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
        return combined.isoformat()

    else:
        # e.g., "28 May" — append year and parse
        dt = datetime.strptime(f"{timestamp_text} {now.year}", "%d %b %Y")
        return dt.isoformat()

def send_data_to_sheets(name, mobile, email=None, user_mobile_number=None, timestamp_text=None, uniqueId=None):
    global lead_bought  # Access the global variable

    try:
        iso_timestamp = parse_timestamp(timestamp_text)
    except Exception as e:
        print(f"Timestamp parsing failed: {e}", flush=True)
        return

    url = "https://api.leadscruise.com/api/store-fetched-lead"
    data = {
        "name": name,
        "mobile": mobile,
        "user_mobile_number": user_mobile_number,
        "lead_bought": lead_bought if lead_bought else "Not Available",
        "timestamp_text": iso_timestamp,
        "uniqueId": uniqueId  # Add uniqueId to identify the process
    }
    if email:
        data["email"] = email

    print(f"Sending data to dashboard: {data}", flush=True)

    try:
        response = requests.post(url, json=data)
        
        # Check for duplicate lead detection - stop script immediately
        if response.status_code == 409:
            response_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
            if response_data.get('error') == 'DUPLICATE_LEAD_STOP_SCRIPT' or 'script_terminated' in response.text:
                print("Duplicate lead detected. Stopping script immediately...", flush=True)
                print(f"Response: {response.text}", flush=True)
                sys.exit(0)  # Stop the script immediately
        
        elif response.status_code == 200:
            print("Lead data sent successfully!", flush=True)
        else:
            print(f"Failed to send data: {response.text}", flush=True)
            
    except requests.exceptions.RequestException as e:
        print(f"Request error sending data to backend: {e}", flush=True)
    except Exception as e:
        print(f"Error sending data to backend: {e}", flush=True)

def extend_word_array(word_array):
    """
    Extends the word_array to include singular/plural variations of each word.
    """
    extended_array = set(word_array)
    for word in word_array:
        if word.endswith("s"):
            extended_array.add(word[:-1])
        else:
            extended_array.add(word + "s")
    return list(extended_array)

def set_browser_zoom(driver, zoom_level=0.75):
    """
    Uses Chrome DevTools Protocol (CDP) to set browser zoom.
    """
    driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": 1920,
        "height": 1080,
        "deviceScaleFactor": zoom_level,  # 0.75 = 75% zoom
        "mobile": False
    })
    #print(f"Browser zoom set to {zoom_level * 100}% using Chrome DevTools Protocol.")

def process_messages_incrementally(driver):
    """
    Simple approach: Process messages as they become available
    Keep scrolling and processing until we reach 30-day limit
    """
    global lead_bought
    print("Starting incremental message processing...", flush=True)
    
    third_url = "https://seller.indiamart.com/messagecentre/"
    thirty_days_ago = datetime.now() - timedelta(days=30)
    processed_messages = 0
    processed_identifiers = set()
    
    # Navigate to message center
    driver.get(third_url)
    time.sleep(5)
    
    # Hide tooltip
    try:
        driver.execute_script("""
            const tooltip = document.querySelector('.Headertooltip');
            if (tooltip) tooltip.style.display = 'none';
        """)
    except:
        pass
    
    # Get scroll container
    try:
        scroll_container = driver.find_element(By.CLASS_NAME, "ReactVirtualized__List")
    except:
        print("Could not find scroll container", flush=True)
        return
    
    scroll_position = 0
    max_scroll_attempts = 200  # Prevent infinite loops
    scroll_attempts = 0
    no_new_messages_count = 0
    
    while scroll_attempts < max_scroll_attempts:
        print(f"\n--- Scroll attempt {scroll_attempts + 1} ---", flush=True)
        
        # Scroll to current position
        driver.execute_script("arguments[0].scrollTop = arguments[1];", scroll_container, scroll_position)
        time.sleep(2)  # Wait for messages to load
        
        # Get currently visible messages
        current_messages = driver.find_elements(By.XPATH, "//div[contains(@class, 'por lftcntctnew')]")
        print(f"Found {len(current_messages)} messages at scroll position {scroll_position}", flush=True)
        
        new_messages_processed = 0
        messages_to_stop = False
        
        # Process each visible message
        for msg_index, msg in enumerate(current_messages):
            try:
                # Extract basic info for identification
                timestamp_elem = msg.find_element(By.XPATH, ".//div[contains(@class, 'fr')]/span[contains(@class, 'fs12')]")
                timestamp_text = timestamp_elem.text.strip()
                
                try:
                    company_elem = msg.find_element(By.XPATH, ".//div[contains(@class, 'fs14') and contains(@class, 'fwb')]")
                    company_text = company_elem.text.strip()
                except:
                    company_text = "Unknown"
                
                # Create identifier
                message_id = f"{timestamp_text}_{company_text}"
                
                # Skip if already processed
                if message_id in processed_identifiers:
                    continue
                
                print(f"Processing new message: {company_text} - {timestamp_text}", flush=True)
                
                # Check 30-day limit
                if not is_within_30_days(timestamp_text, thirty_days_ago):
                    print(f"Reached 30-day limit at: {timestamp_text}", flush=True)
                    messages_to_stop = True
                    break
                
                # Process this message
                success = process_single_message(driver, msg, timestamp_text, company_text, third_url)
                
                if success:
                    processed_messages += 1
                    processed_identifiers.add(message_id)
                    new_messages_processed += 1
                    print(f"Successfully processed message #{processed_messages}", flush=True)
                
                # Break after processing one message to refresh the page
                break
                
            except Exception as e:
                print(f"Error processing message {msg_index}: {e}", flush=True)
                continue
        
        if messages_to_stop:
            print("Reached 30-day limit. Stopping processing.", flush=True)
            break
        
        # If no new messages were processed, scroll down
        if new_messages_processed == 0:
            no_new_messages_count += 1
            print(f"No new messages processed (count: {no_new_messages_count})", flush=True)
            
            if no_new_messages_count >= 5:  # If no new messages for 5 attempts
                print("No new messages found after multiple attempts. Ending process.", flush=True)
                break
            
            # Scroll down
            scroll_position += 400  # Scroll by 400px
            
            # Get scroll container height to check if we're at bottom
            try:
                scroll_height = driver.execute_script("return arguments[0].scrollHeight;", scroll_container)
                if scroll_position >= scroll_height:
                    print("Reached bottom of scroll container.", flush=True)
                    break
            except:
                pass
        else:
            no_new_messages_count = 0  # Reset counter if we processed messages
            # Don't change scroll position if we processed a message
            # The page refresh will reset our position
        
        scroll_attempts += 1
        
        # Safety check - if we've processed a reasonable number, we might be done
        if processed_messages >= 500:  # Adjust this number as needed
            print(f"Processed {processed_messages} messages. Stopping for safety.", flush=True)
            break
    
    print(f"\nCompleted processing. Total messages processed: {processed_messages}", flush=True)
    return processed_messages

def process_single_message(driver, message_element, timestamp, company, return_url):
    """Process a single message and return success status"""
    global lead_bought
    
    try:
        # Scroll message into view
        driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", message_element)
        time.sleep(1)
        
        # Click the message
        driver.execute_script("arguments[0].click();", message_element)
        time.sleep(2)
        
        # Set lead_bought
        lead_bought = company
        
        # Click 'View More' if available
        try:
            view_more_button = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'View More')]"))
            )
            view_more_button.click()
            time.sleep(2)
        except:
            pass  # View More not available
        
        # Extract contact details
        try:
            left_name = driver.find_element(By.XPATH, "//div[@id='left-name']").text
        except:
            left_name = "Name not found"
        
        try:
            mobile_number = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 mt2 wbba']").text
        except:
            mobile_number = "Mobile not found"
        
        try:
            email_id = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 wbba']").text
        except:
            email_id = None
        
        # Get user mobile number from input_data
        user_mobile_number = input_data.get("mobileNumber", "")
        
        # Send data to dashboard
        try:
            send_data_to_sheets(left_name, mobile_number, email_id, user_mobile_number, timestamp)
            print(f"Successfully sent data to dashboard", flush=True)
        except Exception as e:
            print(f"Error sending data to dashboard: {e}", flush=True)
        
        # Return to message center
        # driver.get(return_url)
        time.sleep(3)
        
        # Hide tooltip again
        try:
            driver.execute_script("""
                const tooltip = document.querySelector('.Headertooltip');
                if (tooltip) tooltip.style.display = 'none';
            """)
        except:
            pass
        
        return True
        
    except Exception as e:
        print(f"Error processing single message: {e}", flush=True)
        
        # Try to return to message center
        try:
            time.sleep(3)
        except:
            pass
        
        return False

# REPLACE YOUR EXISTING FUNCTION WITH THIS ONE:
def go_to_message_center_and_fetch(driver):
    """Updated main function using incremental processing"""
    print("Starting message center processing with incremental approach...", flush=True)
    
    # Navigate to message center
    third_url = "https://seller.indiamart.com/messagecentre/"
    time.sleep(5)
    
    # Hide tooltip
    try:
        driver.execute_script("""
            const tooltip = document.querySelector('.Headertooltip');
            if (tooltip) tooltip.style.display = 'none';
        """)
    except:
        pass
    
    # Use incremental processing
    total_processed = process_messages_incrementally(driver)
    
    print(f"Message processing completed. Total messages processed: {total_processed}", flush=True)

def is_within_30_days(timestamp_text, thirty_days_ago):
    """Check if the timestamp is within the last 30 days"""
    try:
        current_year = datetime.now().year
        
        # Handle time formats like "11:35 AM" or "2:15 PM" (assume today)
        if "AM" in timestamp_text.upper() or "PM" in timestamp_text.upper():
            print(f"Time format detected ({timestamp_text}). Assuming it's from today - within 30 days.", flush=True)
            return True
        
        # Handle "Yesterday"
        elif timestamp_text.lower() == "yesterday":
            print(f"Yesterday detected - within 30 days.", flush=True)
            return True
        
        # Handle "Today"
        elif timestamp_text.lower() == "today":
            print(f"Today detected - within 30 days.", flush=True)
            return True
        
        # Handle formats like "28 May", "15 Dec", etc.
        elif any(month in timestamp_text for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                                                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]):
            # Parse date like "28 May"
            try:
                timestamp_date = datetime.strptime(f"{timestamp_text} {current_year}", "%d %b %Y")
                
                # If the parsed date is in the future, it's probably from last year
                if timestamp_date > datetime.now():
                    timestamp_date = timestamp_date.replace(year=current_year - 1)
                
                is_within = timestamp_date >= thirty_days_ago
                print(f"Date format parsed: {timestamp_text} -> {timestamp_date.strftime('%Y-%m-%d')}. Within 30 days: {is_within}", flush=True)
                return is_within
            except ValueError as e:
                print(f"Could not parse date format: {timestamp_text}. Error: {e}. Assuming it's recent.", flush=True)
                return True
        
        # Handle full date formats like "28 May 2024"
        elif len(timestamp_text.split()) == 3:
            try:
                timestamp_date = datetime.strptime(timestamp_text, "%d %b %Y")
                is_within = timestamp_date >= thirty_days_ago
                print(f"Full date format parsed: {timestamp_text} -> {timestamp_date.strftime('%Y-%m-%d')}. Within 30 days: {is_within}", flush=True)
                return is_within
            except ValueError as e:
                print(f"Could not parse full date format: {timestamp_text}. Error: {e}. Assuming it's recent.", flush=True)
                return True
        
        # Handle numeric dates like "28/05/2024" or "28-05-2024"
        elif "/" in timestamp_text or "-" in timestamp_text:
            separator = "/" if "/" in timestamp_text else "-"
            date_parts = timestamp_text.split(separator)
            if len(date_parts) == 3:
                # Try different date formats
                for date_format in ["%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y"]:
                    try:
                        timestamp_date = datetime.strptime(timestamp_text, date_format)
                        is_within = timestamp_date >= thirty_days_ago
                        print(f"Numeric date format parsed: {timestamp_text} -> {timestamp_date.strftime('%Y-%m-%d')}. Within 30 days: {is_within}", flush=True)
                        return is_within
                    except ValueError:
                        continue
        
        # If we can't parse the date, assume it's recent to be safe
        print(f"Could not parse timestamp: {timestamp_text}. Assuming it's recent.", flush=True)
        return True
        
    except Exception as e:
        print(f"Error parsing timestamp '{timestamp_text}': {e}. Assuming it's recent.", flush=True)
        return True
    
def execute_task_one(driver, wait):
    """
    Executes the login process, supporting both password and OTP flows.
    """
    global received_otp, otp_event
    
    try:
        # Refresh page
        print("Refreshing page...",flush=True)
        driver.refresh()
        time.sleep(3)
        
        # Get mobile number from input data
        user_mobile_number = input_data.get("mobileNumber", "")
        
        # Enter mobile number
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))
        input_field.clear()
        input_field.send_keys(user_mobile_number)
        print(f"Entered mobile number {user_mobile_number}.",flush=True)
        
        # Click 'Start Selling'
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()
        print("Clicked 'Start Selling' button.",flush=True)

        try:
            enter_password_button = wait.until(
                EC.element_to_be_clickable((By.ID, "passwordbtn1"))
            )
            enter_password_button.click()
            print("Clicked 'Enter Password' button.")

            user_password = input_data.get("password", "")
            password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
            password_input.clear()
            password_input.send_keys(user_password)
            print("Entered the password.")

            sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "signWP")))
            sign_in_button.click()
            print("Clicked 'Sign In' button.")

        except (TimeoutException, NoSuchElementException):
            try:
                # Click 'Request OTP on Mobile' button
                received_otp = None
                otp_event.clear()
                otp_request_button = wait.until(
                    EC.element_to_be_clickable((By.ID, "reqOtpMobBtn"))
                )
                otp_request_button.click()
                print("Clicked 'Request OTP on Mobile' button.",flush=True)
                
                # Signal to backend that OTP request has been initiated
                print("OTP_REQUEST_INITIATED",flush=True)
                sys.stdout.flush()
                
                # Start OTP listener thread
                otp_thread = threading.Thread(target=listen_for_otp, daemon=True)
                otp_thread.start()
                
                # Wait for OTP to be received (with timeout)
                print("Waiting for OTP input...",flush=True)
                if otp_event.wait(timeout=60):  # Wait up to 60 seconds for OTP
                    if received_otp and len(received_otp) == 4 and received_otp.isdigit():
                        # Enter OTP digit by digit
                        otp_fields = ["first", "second", "third", "fourth_num"]
                        for i, field_id in enumerate(otp_fields):
                            try:
                                otp_input = wait.until(EC.presence_of_element_located((By.ID, field_id)))
                                otp_input.clear()
                                otp_input.send_keys(received_otp[i])
                            except (TimeoutException, NoSuchElementException):
                                print(f"Could not find OTP field: {field_id}",flush=True)
                                return "Unsuccessful"
                        
                        print("Entered OTP successfully.",flush=True)
                        
                        # Click submit OTP button if it exists
                        otp_submit_button = wait.until(EC.element_to_be_clickable((By.ID, "sbmtbtnOtp")))
                        otp_submit_button.click()
                        print("Clicked 'Submit OTP' button.",flush=True)
                    else:
                        print("Invalid OTP received.",flush=True)
                        return "Unsuccessful"
                else:
                    print("Timeout waiting for OTP.",flush=True)
                    return "Unsuccessful"
                    
            except (TimeoutException, NoSuchElementException) as e:
                print(f"OTP flow failed: {e}",flush=True)
                return "Unsuccessful"
        
        # Final check for dashboard
        time.sleep(5)
        try:
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Sign in successful. 'Dashboard' element found.",flush=True)
            return "Success"
        except TimeoutException:
            print("Dashboard element not found after login. Sign in may have failed.",flush=True)
            return "Unsuccessful"
            
    except Exception as e:
        print(f"An error occurred during login: {e}",flush=True)
        return "Unsuccessful"
    
def main():
    """
    Main function to run the program.
    If the login process is successful, it enters an infinite loop to refresh or check the dashboard.
    If unsuccessful, the program exits.
    """
    # Configure Chrome options
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

    # Set a realistic user-agent
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    chrome_options.add_argument(f"user-agent={user_agent}")

    # Start virtual display
    display = Display(visible=0, size=(1920, 1080))
    display.start()

    driver = webdriver.Chrome(options=chrome_options)
    #service = Service('/usr/local/bin/chromedriver')
    #driver = webdriver.Chrome(service=service, options=chrome_options)
    #driver.minimize_window() 
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    unique_id=int(input_data.get("uniqueId", 0))+100000
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}",flush=True)
    
    try:
        # Initial login attempt
        print("\nChecking for the 'Dashboard' element...",flush=True)
        try:
            # Check if the Dashboard element is present
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Dashboard found.",flush=True)
            go_to_message_center_and_fetch(driver)
        except:
            print("Dashboard not found. Executing login process...",flush=True)
            result = execute_task_one(driver, wait)
            print(f"Task Result: {result}",flush=True)

            # Exit if the login process is unsuccessful
            if result == "Unsuccessful":
                print("Login failed. Exiting program...",flush=True)
                return

        # Infinite loop after a successful login
        while True:
            print("\nChecking for the 'Dashboard' element in loop...",flush=True)
            try:
                # Check if the Dashboard element is present
                dashboard_element = wait.until(
                    EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
                )
                print("Dashboard found.",flush=True)
                go_to_message_center_and_fetch(driver)
            except:
                print("Dashboard not found. Executing login process...",flush=True)
                result = execute_task_one(driver, wait)
                print(f"Task Result: {result}",flush=True)

                # Exit if the login process is unsuccessful
                if result == "Unsuccessful":
                    print("Login failed during loop. Exiting program...",flush=True)
                    break

            print("\nRestarting the loop...",flush=True)
            time.sleep(5)  # Small delay before repeating the loop
    except KeyboardInterrupt:
        print("\nProgram manually exited.",flush=True)
    finally:
        driver.quit()
        print("Browser closed.",flush=True)

if __name__ == "__main__":
    main()
    