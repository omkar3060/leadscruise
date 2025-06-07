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
skip_lead = False  # Global variable to skip lead if duplicate detected
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

input_line = sys.stdin.readline()
input_data = json.loads(input_line.strip())
import requests

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
    global skip_lead, redirect_count
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
                print("Duplicate lead detected.", flush=True)
                skip_lead = True
                redirect_count = 0  # Reset redirect count
                print(f"Response: {response.text}", flush=True)
                return
        
        elif response.status_code == 200:
            print("Lead data sent successfully!", flush=True)
            skip_lead = False
        else:
            print(f"Failed to send data: {response.text}", flush=True)
            skip_lead = False
            
    except requests.exceptions.RequestException as e:
        print(f"Request error sending data to backend: {e}", flush=True)
        skip_lead = False
    except Exception as e:
        print(f"Error sending data to backend: {e}", flush=True)
        skip_lead = False

def process_messages_incrementally(driver):
    """
    Simple approach: Process messages as they become available
    Keep scrolling and processing until we reach 30-day limit
    """
    global lead_bought
    global skip_lead
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
        if skip_lead:
            print("Skipping this lead due to duplication...", flush=True)
            return
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
    global skip_lead
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
            if skip_lead:
                print("Skipping this lead due to duplication...", flush=True)
                return
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

def go_to_message_center_and_fetch(driver):
    global skip_lead
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
    if skip_lead:
        print("Skipping this lead due to duplication...", flush=True)
        skip_lead = False
        return
    
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
 
lead_bought=""
def send_data_to_dashboard(name, mobile, email=None, user_mobile_number=None):
    global lead_bought  # Access the global variable

    url = "https://api.leadscruise.com/api/store-lead"
    data = {
        "name": name,
        "mobile": mobile,
        "user_mobile_number": user_mobile_number,
        "lead_bought": lead_bought if lead_bought else "Not Available"  # Provide default value
    }
    
    if email:
        data["email"] = email
    
    # Print the data being sent for debugging
    print(f"Sending data to dashboard: {data}", flush=True)
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print("Lead data sent successfully!", flush=True)
        else:
            print(f"Failed to send data: {response.text}", flush=True)
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

def go_to_message_center_and_click(driver):

    print("Waiting for 3 seconds before going to the message center...", flush=True)
    time.sleep(3)

    third_url = "https://seller.indiamart.com/messagecentre/"
    print(f"Redirecting to {third_url} to interact with the message center...", flush=True)
    driver.get(third_url)
    time.sleep(3)

    try:
        # Force remove tooltip that might block the first message
        try:
            driver.execute_script("""
                const tooltip = document.querySelector('.Headertooltip');
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
            """)
            print("Forcefully hid the tooltip using JavaScript.", flush=True)
        except Exception as js_error:
            print(f"JS error while hiding tooltip: {js_error}", flush=True)

        # Click the first message element
        message_element = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@class='fl lh150 w100 hgt20']//div[@class='wrd_elip fl fs14 fwb maxwidth100m200']"))
        )
        message_element.click()
        print("Clicked the first element with the specified class parameters.", flush=True)
        time.sleep(2)

        message_input = WebDriverWait(driver, 15).until(EC.visibility_of_element_located((By.XPATH, "//div[@id='massage-text' and @contenteditable='true']")))

        sentences = input_data.get("sentences", [])

        for sentence in sentences:
            message_input.click()
            message_input.send_keys(Keys.CONTROL + "a")
            message_input.send_keys(Keys.DELETE)
            message_input.send_keys(sentence)
            print(f"Entered message: '{sentence}'", flush=True)

            send_div = driver.find_element(By.ID, "send-reply-span")
            send_div.click()
            print("Clicked the send button.", flush=True)
            time.sleep(2)

            # Close popup if it appears
            try:
                close_button = driver.find_element(By.XPATH, "//div[contains(@style,'background-color') and contains(@style,'position: relative')]//button[contains(text(),'✖')]")
                close_button.click()
                print("Closed the popup after sending the message.", flush=True)
            except:
                print("No popup appeared after message.", flush=True)

        # Click 'View More'
        view_more_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@class='vd_text_vert por cp' and contains(text(), 'View More')]"))
        )
        view_more_button.click()
        print("Clicked the 'View More' button.", flush=True)
        time.sleep(2)

        # Extract and print contact details
        left_name = driver.find_element(By.XPATH, "//div[@id='left-name']")
        print(f"Left Name: {left_name.text}", flush=True)

        mobile_number = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 mt2 wbba']")
        print(f"Mobile Number: {mobile_number.text}", flush=True)

        try:
            email_id = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 wbba']").text
            print(f"Email ID: {email_id}", flush=True)
        except:
            email_id = None
            print("Email ID not found.", flush=True)
        user_mobile_number = input_data.get("mobileNumber", "")  # Get the logged-in user's mobile number
        send_data_to_dashboard(left_name.text, mobile_number.text, email_id, user_mobile_number)
    except Exception as e:
        print(f"An error occurred while interacting with the message center: {e}", flush=True)

def click_contact_buyer_now_button(driver, wait):
    """
    Clicks the first 'Contact Buyer Now' button on the page.
    Includes scrolling up and handling overlays.
    """
    try:
        # Scroll up by 300 pixels (adjust the value as needed)
        driver.execute_script("window.scrollBy(0, -300);")
        print("Scrolled up by 300 pixels." ,flush=True)

        # Wait for a moment to let the scroll action complete
        time.sleep(1)

        # Wait for the overlay to disappear (if any)
        try:
            WebDriverWait(driver, 10).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "overlay_fltr"))
            )
            print("Overlay disappeared." ,flush=True)
        except Exception as e:
            print(f"Overlay did not disappear: {e}" ,flush=True)

        # Wait for the button to be clickable
        contact_buyer_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "(//span[text()='Contact Buyer Now'])[1]"))
        )

        # Scroll the button into view (if needed)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", contact_buyer_button)
        print("Scrolled the 'Contact Buyer Now' button into view." ,flush=True)

        # Click the button using JavaScript (to avoid interception issues)
        driver.execute_script("arguments[0].click();", contact_buyer_button)
        print("Clicked the 'Contact Buyer Now' button using JavaScript." ,flush=True)

        return True  # Return True if the button was clicked successfully

    except Exception as e:
        print(f"Failed to click the 'Contact Buyer Now' button: {e}",flush=True)
        return False  # Return False if an error occurred

def enter_custom_order_value(driver):
    try:
        print("Hovering over 'Order Value' section...")

        # Hover over the Order Value section
        order_value_element = driver.find_element(By.ID, "order_val_sec")
        ActionChains(driver).move_to_element(order_value_element).perform()
        time.sleep(2)

        # Ensure the hover menu is displayed
        hover_menu = driver.find_element(By.CLASS_NAME, "order_val_hover_1")
        driver.execute_script("arguments[0].style.display = 'block';", hover_menu)
        time.sleep(1)

        # Find the input field for custom minimum value
        min_input = driver.find_element(By.ID, "min_order_val")
        min_input.clear()
        minOrderValue = input_data.get("minOrder", "")
        min_input.send_keys(minOrderValue)
        print(f"Entered custom minimum value: {minOrderValue}", flush=True)
        time.sleep(1)

        # Press enter to trigger filtering (assuming that's the intended trigger)
        min_input.send_keys(Keys.ENTER)
        print("Entered custom minimum value and submitted.")
        time.sleep(5)

    except Exception as e:
        print(f"Error while entering custom order value: {e}")
        #driver.save_screenshot("order_value_error.png")
        print("Screenshot saved as order_value_error.png")

def select_lead_type(driver):
    lead_types = input_data.get("leadTypes", [])
    try:
        print("Setting lead type filters...")
        
        # Click on the Lead Type section to expand it if needed
        lead_type_div = driver.find_element(By.CLASS_NAME, "lead_type_wrap")
        lead_type_header = lead_type_div.find_element(By.CLASS_NAME, "lead_type")
        
        # Make sure it's visible and clickable
        driver.execute_script("arguments[0].scrollIntoView(true);", lead_type_header)
        time.sleep(1)
        
        # Only select "Bulk" lead type if it's in the lead_types array
        if "bulk" in [lt.lower() for lt in lead_types]:
            bulk_checkbox = driver.find_element(By.ID, "lead_type_2")
            if not bulk_checkbox.is_selected():
                # Use JavaScript to click in case of any overlay issues
                driver.execute_script("arguments[0].click();", bulk_checkbox)
                print("Selected 'Bulk' lead type.")
                time.sleep(2)
        else:
            print("'Bulk' lead type not in selection criteria, skipping.")
        
        # Only select "Business" lead type if it's in the lead_types array
        if "business" in [lt.lower() for lt in lead_types]:
            business_checkbox = driver.find_element(By.ID, "business_type_id")
            if not business_checkbox.is_selected():
                driver.execute_script("arguments[0].click();", business_checkbox)
                print("Selected 'Business' lead type.")
                time.sleep(2)
        else:
            print("'Business' lead type not in selection criteria, skipping.")
        
        # Only expand submenu and select GST if it's in the lead_types array
        if "gst" in [lt.lower() for lt in lead_types]:
            # Click the arrow to expand the submenu for additional options
            arrow_menu = driver.find_element(By.CLASS_NAME, "arwMenu")
            driver.execute_script("arguments[0].click();", arrow_menu)
            time.sleep(2)
            
            # Make sure the hover menu is displayed
            hover_menu = driver.find_element(By.CLASS_NAME, "lead_type_hover_1")
            driver.execute_script("arguments[0].style.display = 'block';", hover_menu)
            time.sleep(1)
            
            # Select "GST" option
            gst_checkbox = driver.find_element(By.ID, "gst_type_id")
            if not gst_checkbox.is_selected():
                driver.execute_script("arguments[0].click();", gst_checkbox)
                print("Selected 'GST' option.")
                time.sleep(2)
        else:
            print("'GST' option not in selection criteria, skipping.")
        
        print("Successfully set all requested lead type filters.")
    except Exception as e:
        print(f"Error while setting lead type filters: {e}")
        driver.save_screenshot("lead_type_error.png")
        print("Screenshot saved as lead_type_error.png")
   
def redirect_and_refresh(driver, wait):
    global lead_bought
    """
    Main function with updated functionality to set the zoom level and perform actions.
    """
    # Set Chrome instance to 75% zoom
    set_browser_zoom(driver, 75)

    first_url = "https://seller.indiamart.com/bltxn/?pref=recent"
    second_url = "https://seller.indiamart.com/bltxn/knowyourbuyer"

    # Array of words to compare for span text
    word_array = input_data.get("wordArray", []) 
    word_array = extend_word_array(word_array)

    # Array of words to compare for <h2> text
    h2_word_array = input_data.get("h2WordArray", []) 

    # Redirect to the second URL to check the buyer balance
    
    print(f"Redirecting to {second_url} to check buyer balance...",flush=True)
    driver.get(second_url)
    time.sleep(3)  # Static wait for dashboard loading

    try:
        # Check the value of the element
        time.sleep(3)  # Static wait
        buyer_balance_element = driver.find_element(By.ID, "cstm_bl_bal1")
        buyer_balance = int(buyer_balance_element.text)
        print(f"BUYER_BALANCE:{buyer_balance}", flush=True)

        if buyer_balance > 0:
            print("Buyer balance is greater than 0. Redirecting back to the first link...",flush=True)
            driver.get(first_url)
            time.sleep(10)  # Static wait

            # Click the 'India' label after redirecting back to the first URL
            try:
                driver.refresh()
                time.sleep(3)  # Static wait

                # First try to remove the overlay if it exists
                try:
                    overlay = driver.find_element(By.CLASS_NAME, "overlay_fltr")
                    if overlay.is_displayed():
                        # Remove the overlay using JavaScript
                        driver.execute_script("arguments[0].style.display = 'none';", overlay)
                        print("Removed overlay element blocking the India label.")
                        time.sleep(2)
                except Exception as e:
                    print(f"No overlay found or couldn't remove it: {e}")
                
                india_label = driver.find_element(By.XPATH, "//label[contains(text(), 'India')]")
                india_label.click()
                print("Clicked the 'India' label.",flush=True)
                
                time.sleep(5)
                
            except Exception as e:
                print(f"Failed to click the 'India' label: {e}",flush=True)
                driver.save_screenshot("screenshot_after_login.png")
                print("Screenshot saved as screenshot_after_login.png",flush=True)

            enter_custom_order_value(driver)
            time.sleep(3)
            select_lead_type(driver)

            # Read the data from the span element with color: rgb(42, 166, 153)
            span_result = False
            try:
                time.sleep(3)  # Static wait
                first_grid = driver.find_element(By.CSS_SELECTOR, "div.bl_grid.Prd_Enq")
                coupling_spans = first_grid.find_elements(By.CSS_SELECTOR, "span[style*='color: rgb(42, 166, 153)']")
                found_texts = [span.text.strip() for span in coupling_spans if span.text.strip()]
                print(f"data from span: {found_texts}", flush=True)

                # Check if the extracted text matches any word in the array
                span_result = any(text in word_array for text in found_texts)
                print(span_result, flush=True)

            except Exception as e:
                print(f"Failed to read data from span with specified color: {e}",flush=True)

            # After reading the span, get the first <h2> element on the page
            h2_result = False
            try:
                time.sleep(3)  # Static wait
                first_h2 = driver.find_element(By.XPATH, "//h2")
                first_h2_text = first_h2.text
                lead_bought=first_h2_text
                print(f"Read data from the first <h2>: {first_h2_text}",flush=True)

                # Check if the extracted text matches any word in the h2_word_array
                h2_result = first_h2_text not in h2_word_array
                print(h2_result)

            except Exception as e:
                print(f"Failed to read data from the first <h2>: {e}",flush=True)

            # Get the time element using the updated XPath based on the provided HTML structure
            time_result = False
            try:
                time.sleep(3)  # Static wait
                
                # Updated XPath to match the actual HTML structure
                # Looking for div with class containing "lstNwLftLoc" and "lstNwDflx" that has a strong element with time text
                time_element = driver.find_element(By.XPATH, "//div[contains(@class, 'lstNwLftLoc') and contains(@class, 'lstNwDflx')]//strong")
                time_text = time_element.text
                print(f"Time text: {time_text}",flush=True)

                # Parse the time value
                if 'mins ago' in time_text:
                    time_value = int(time_text.split()[0])
                elif 'secs ago' in time_text:
                    time_value = int(time_text.split()[0]) / 60  # Convert seconds to minutes
                elif 'hrs ago' in time_text:
                    time_value = int(time_text.split()[0]) * 60  # Convert hours to minutes
                else:
                    time_value = 11  # Default to a value greater than 10 mins if parsing fails

                # Check if time is less than 10 minutes
                time_result = time_value < 1000000
                print(time_result, flush=True)

            except Exception as e:
                print(f"Failed to read the time text: {e}",flush=True)
                # Try an alternative selector as a fallback
                try:
                    time_element = driver.find_element(By.CSS_SELECTOR, "div.lstNwLftLoc.lstNwDflx strong")
                    time_text = time_element.text
                    print(f"Time text (alternative method): {time_text}",flush=True)
                    
                    # Parse the time value
                    if 'mins ago' in time_text:
                        time_value = int(time_text.split()[0])
                    elif 'secs ago' in time_text:
                        time_value = int(time_text.split()[0]) / 60  # Convert seconds to minutes
                    elif 'hrs ago' in time_text:
                        time_value = int(time_text.split()[0]) * 60  # Convert hours to minutes
                    else:
                        time_value = 11  # Default to a value greater than 10 mins if parsing fails

                    # Check if time is less than 10 minutes
                    time_result = time_value < 1000000
                    print(time_result, flush=True)
                    
                except Exception as e2:
                    print(f"Failed to read the time text with alternative method: {e2}",flush=True)
                    # driver.save_screenshot("time_element_error.png")
                    print("Screenshot saved as time_element_error.png",flush=True)

            # Check if the close button is available and click it if found
            try:
                close_button = driver.find_element(By.XPATH, "//span[@class='glob_sa_close' and contains(text(), '—')]")
                close_button.click()
                print("Clicked the close button.",flush=True)
            except Exception as e:
                if 'no such element' in str(e).lower():
                    print("Close button not found. Skipping this step.",flush=True)
                else:
                    print(f"Close button not found or failed to click: {e}",flush=True)

            # If all conditions are True, click the "Contact Buyer Now" button
            if span_result and h2_result and time_result:
                if click_contact_buyer_now_button(driver, wait):
                    # Call the function to go to message center and click the 'Reply Now' button
                    go_to_message_center_and_click(driver)
                else:
                    print("Failed to click the 'Contact Buyer Now' button.",flush=True)

                # Refresh the page three times
                print("Waiting for 10 seconds...",flush=True)
                time.sleep(300)  # Static wait for refresh
        else:
            print("ZERO_BALANCE_DETECTED", flush=True)
            return
    except Exception as e:
        print(f"Error while checking buyer balance: {e}",flush=True)
        return
    
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
            start_time = time.time()
            print("Waiting for OTP input...", flush=True)

            while time.time() - start_time < 90:
                if otp_event.wait(timeout=5):  # Wait for OTP signal in small chunks
                    otp_event.clear()  # Reset event for next attempt

                    if received_otp and len(received_otp) == 4 and received_otp.isdigit():
                        otp_fields = ["first", "second", "third", "fourth_num"]
                        for i, field_id in enumerate(otp_fields):
                            try:
                                otp_input = wait.until(EC.presence_of_element_located((By.ID, field_id)))
                                otp_input.clear()
                                otp_input.send_keys(received_otp[i])
                            except (TimeoutException, NoSuchElementException):
                                print(f"Could not find OTP field: {field_id}", flush=True)
                                return "Unsuccessful"

                        print("Entered OTP successfully.", flush=True)

                        try:
                            otp_submit_button = wait.until(EC.element_to_be_clickable((By.ID, "sbmtbtnOtp")))
                            otp_submit_button.click()
                            print("Clicked 'Submit OTP' button.", flush=True)
                            time.sleep(2)

                            # Check if OTP was correct
                            try:
                                error_elem = driver.find_element(By.ID, "otp_verify_err")
                                if error_elem.is_displayed() and "Incorrect OTP" in error_elem.text:
                                    print("OTP_FAILED_INCORRECT", flush=True)
                                    continue  # Allow another attempt if time allows
                            except NoSuchElementException:
                                pass  # No error means success, break out of loop
                            break
                        except Exception as e:
                            print(f"Failed to click OTP submit button: {e}", flush=True)
                            continue
                    else:
                        print("Invalid OTP format received.", flush=True)
                else:
                    print("Still waiting for OTP...", flush=True)

            # Final check after loop ends
            if time.time() - start_time >= 90:
                print("Timeout waiting for correct OTP.", flush=True)
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
    global redirect_count
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
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    unique_id = input_data.get("uniqueId", [])
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)
    redirect_count = 0
    
    try:
        # Initial login attempt
        print("\nChecking for the 'Dashboard' element...", flush=True)
        try:
            # Check if the Dashboard element is present
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Dashboard found.", flush=True)
            redirect_and_refresh(driver, wait)
        except:
            print("Dashboard not found. Executing login process...", flush=True)
            result = execute_task_one(driver, wait)
            print(f"Task Result: {result}", flush=True)

            # Exit if the login process is unsuccessful
            if result == "Unsuccessful":
                print("Login failed. Exiting program...", flush=True)
                return

        # Main processing loop
        while True:
            try:
                # If we haven't completed redirect_and_refresh yet
                if redirect_count < 10:
                    print(f"Running redirect_and_refresh (count: {redirect_count + 1}/10)...", flush=True)
                    redirect_count += 1
                    redirect_and_refresh(driver, wait)
                    
                else:
                    # Continue with message processing in each loop iteration
                    print("Starting message center processing...", flush=True)
                    total_processed = go_to_message_center_and_fetch(driver)
                    print(f"Message processing iteration completed with {total_processed} messages processed.", flush=True)
                    
                    # Navigate back to dashboard after processing
                    print("Navigating back to dashboard...", flush=True)
                    driver.get("https://seller.indiamart.com/")
                    time.sleep(3)
                    
                    # Check if dashboard is accessible after navigation
                    try:
                        dashboard_element = wait.until(
                            EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
                        )
                        print("Dashboard accessible after message processing.", flush=True)
                    except:
                        print("Dashboard not found after message processing. May need to re-login...", flush=True)
                        # Reset redirect count to restart the process
                        redirect_count = 0
                        
                        result = execute_task_one(driver, wait)
                        if result == "Unsuccessful":
                            print("Re-login failed. Exiting program...", flush=True)
                            break

            except Exception as e:
                print(f"Error in main loop: {e}", flush=True)
                time.sleep(5)  # Wait before retrying
                
                # Try to recover by checking dashboard
                try:
                    driver.get("https://seller.indiamart.com/")
                    time.sleep(3)
                    dashboard_element = wait.until(
                        EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
                    )
                    print("Recovered - Dashboard found.", flush=True)
                except:
                    print("Recovery failed. Attempting re-login...", flush=True)
                    redirect_count = 0
                    
                    result = execute_task_one(driver, wait)
                    if result == "Unsuccessful":
                        print("Re-login failed. Exiting program...", flush=True)
                        break

            print("\nLoop iteration completed. Continuing...", flush=True)
            time.sleep(5)  # Small delay before next iteration
            
    except KeyboardInterrupt:
        print("\nProgram manually exited.", flush=True)
    except Exception as e:
        print(f"\nUnexpected error in main: {e}", flush=True)
    finally:
        try:
            driver.quit()
            print("Browser closed.", flush=True)
        except:
            print("Error closing browser.", flush=True)
        
        try:
            display.stop()
            print("Display stopped.", flush=True)
        except:
            print("Error stopping display.", flush=True)

if __name__ == "__main__":
    main()
    