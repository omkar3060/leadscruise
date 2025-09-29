from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from pyvirtualdisplay import Display
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
from selenium.common.exceptions import ElementClickInterceptedException, StaleElementReferenceException
import pytz

def reset_lead_count_daily():
    global lead_count
    ist = pytz.timezone("Asia/Kolkata")
    
    while True:
        now_ist = datetime.now(ist)
        # Reset exactly at 5:00:00 AM IST
        if now_ist.hour == 5 and now_ist.minute == 0 and now_ist.second == 0:
            print("⏰ It's 5 AM IST → resetting lead_count to 0", flush=True)
            lead_count = 0
            # Sleep 1 second to avoid multiple resets in the same second
            time.sleep(1)
        time.sleep(0.5)  # check twice every second

# Start reset thread
reset_thread = threading.Thread(target=reset_lead_count_daily, daemon=True)
reset_thread.start()

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
lead_count = int(input_data.get("leadCount", 0))
max_captures = int(input_data.get("maxCaptures", 0))
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

def send_data_to_sheets(name, mobile, email=None, user_mobile_number=None, timestamp_text=None, address=None, uniqueId=None):
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
    if address:
        data["address"] = address
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

def close_scroll_popup_if_present(driver):
    """Check and close the scroll popup if it appears"""
    try:
        # Wait briefly for popup to appear - try multiple selectors
        popup_selectors = [
            "//div[contains(@class, 'fs15') and contains(@class, 'txt_cntr') and contains(@class, 'pop_align')]",
            "//div[contains(text(), 'Attention! It looks like')]",
            "//span[contains(text(), 'Attention! It looks like')]/parent::div"
        ]
        
        popup = None
        for selector in popup_selectors:
            try:
                popup = WebDriverWait(driver, 2).until(
                    EC.presence_of_element_located((By.XPATH, selector))
                )
                if popup.is_displayed():
                    break
            except TimeoutException:
                continue
        
        if popup and popup.is_displayed():
            print("Scroll warning popup detected. Closing it...", flush=True)
            
            # Method 1: Try clicking the close (X) button
            close_selectors = [
                ".//div[contains(@class, 'poa') and contains(@class, 'rgt10')]//svg",
                ".//svg[@width='12px']",
                ".//svg[contains(@class, 'fr')]",
                ".//path[contains(@d, 'M 2.75 2.042969')]/parent::g/parent::svg"
            ]
            
            for close_selector in close_selectors:
                try:
                    close_button = popup.find_element(By.XPATH, close_selector)
                    if close_button.is_displayed():
                        # Try both click methods
                        try:
                            close_button.click()
                        except:
                            driver.execute_script("arguments[0].click();", close_button)
                        time.sleep(1)
                        print("Popup closed using close button.", flush=True)
                        return True
                except:
                    continue
            
            # Method 2: Try clicking OK button
            ok_selectors = [
                ".//button[contains(text(),'OK')]",
                ".//button[contains(@class, 'bgmim')]"
            ]
            
            for ok_selector in ok_selectors:
                try:
                    ok_button = popup.find_element(By.XPATH, ok_selector)
                    if ok_button.is_displayed():
                        try:
                            ok_button.click()
                        except:
                            driver.execute_script("arguments[0].click();", ok_button)
                        time.sleep(1)
                        print("Popup closed using OK button.", flush=True)
                        return True
                except:
                    continue
            
            # Method 3: Try pressing Escape key
            try:
                from selenium.webdriver.common.keys import Keys
                driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
                time.sleep(1)
                print("Popup closed using Escape key.", flush=True)
                return True
            except:
                pass
            
            # Method 4: Click outside the popup
            try:
                driver.execute_script("arguments[0].style.display = 'none';", popup)
                print("Popup hidden using JavaScript.", flush=True)
                return True
            except:
                pass
            
            print("Popup detected but could not close it automatically.", flush=True)
            return False
            
    except Exception as e:
        # Popup didn't show up or other error occurred
        print(f"No popup detected or error occurred: {e}", flush=True)
        return True
    
    return True

def process_messages_incrementally(driver):
    """
    Simple approach: Process messages as they become available
    Keep scrolling and processing until we reach 30-day limit
    """
    global lead_bought
    global skip_lead
    print("Starting incremental message processing...", flush=True)
    
    third_url = "https://seller.indiamart.com/messagecentre/"
    thirty_days_ago = datetime.now() - timedelta(days=100000)
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
    max_scroll_attempts = 100000  # Prevent infinite loops
    scroll_attempts = 0
    no_new_messages_count = 0
    
    while scroll_attempts < max_scroll_attempts:
        print(f"\n--- Scroll attempt {scroll_attempts + 1} ---", flush=True)
        close_scroll_popup_if_present(driver)
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
                    company_elem = msg.find_element(By.XPATH, ".//div[contains(@class, 'fs12') and contains(@class, 'fwb')]")
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
                # if not is_within_30_days(timestamp_text, thirty_days_ago):
                #     print(f"Reached 30-day limit at: {timestamp_text}", flush=True)
                #     messages_to_stop = True
                #     break
                
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
            
            if no_new_messages_count >= 10:  # If no new messages for 5 attempts
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
        if processed_messages >= 500000:  # Adjust this number as needed
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

        try:
            address_element = driver.find_element(By.XPATH, "//span[contains(text(),'Address')]/following::span[1]/span")
            address = address_element.text
        except:
            address = "Address not found"

        # Get user mobile number from input_data
        user_mobile_number = input_data.get("mobileNumber", "")
        
        # Send data to dashboard
        try:
            send_data_to_sheets(left_name, mobile_number, email_id, user_mobile_number, timestamp, address)
            if skip_lead:
                print("Skipping this lead due to duplication...", flush=True)
                return
            print(f"Successfully sent data to dashboard", flush=True)
            time.sleep(10)
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
def send_data_to_dashboard(name, mobile, email=None, user_mobile_number=None, address=None):
    global lead_bought  # Access the global variable
    global lead_count

    url = "https://api.leadscruise.com/api/store-lead"
    data = {
        "name": name,
        "mobile": mobile,
        "user_mobile_number": user_mobile_number,
        "lead_bought": lead_bought if lead_bought else "Not Available",  # Provide default value
        "address": address if address else "Not Available"  # Provide default value
    }
    
    if email:
        data["email"] = email
    
    # Print the data being sent for debugging
    print(f"Sending data to dashboard: {data}", flush=True)
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print("Lead data sent successfully!", flush=True)
            lead_count += 1
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

def go_to_message_center_and_click(driver, first_h2_text):

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

        # Check if WhatsApp text is found
        whatsapp_found = False
        try:
            print("Looking for WhatsApp-related elements...", flush=True)
            whatsapp_elements = driver.find_elements(
                By.XPATH,
                "//div[contains(@class, 'reply-template')]//span[normalize-space(text())='Introduction' or normalize-space(text())='Share more details' or normalize-space(text())='Catalog Link']"
            )

            if whatsapp_elements:
                print("WhatsApp message template found - proceeding with WhatsApp flow", flush=True)
                whatsapp_found = True
                execute_whatsapp_flow(driver, first_h2_text)
            else:
                print("WhatsApp message not found - proceeding with regular flow", flush=True)
                execute_regular_flow(driver, first_h2_text)

        except Exception as detection_error:
            print(f"Error detecting WhatsApp elements: {detection_error}", flush=True)
            print("Fallback: proceeding with regular flow", flush=True)
            execute_regular_flow(driver, first_h2_text)

        
    except Exception as e:
        print(f"An error occurred while interacting with the message center: {e}", flush=True)


def execute_whatsapp_flow(driver, first_h2_text):
    """Execute the WhatsApp-specific flow: click introduction/catalog, view more, ask for review, then send messages"""
    try:
        print("Starting WhatsApp flow...", flush=True)
        
        # Step 1: Click either Introduction or Catalog Link button
        template_clicked = False
        send_messages(driver, first_h2_text)
        
        # Try to click Introduction first
        try:
            introduction_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'reply-template')]//span[contains(text(), 'Introduction')]"))
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", introduction_button)
            time.sleep(1)
            introduction_button.click()
            print("Clicked the Introduction button.", flush=True)
            template_clicked = True
            time.sleep(2)
        except Exception as e:
            print(f"Introduction button not found: {e}", flush=True)
        
        # If Introduction not found, try Catalog Link
        if not template_clicked:
            try:
                catalog_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'reply-template')]//span[contains(text(), 'Catalog Link')]"))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", catalog_button)
                time.sleep(1)
                catalog_button.click()
                print("Clicked the Catalog Link button.", flush=True)
                template_clicked = True
                time.sleep(2)
            except Exception as e:
                print(f"Catalog Link button not found: {e}", flush=True)
        
        # Fallback: try any available template
        if not template_clicked:
            try:
                any_template = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'reply-template')]"))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", any_template)
                time.sleep(1)
                any_template.click()
                print("Clicked an available template button.", flush=True)
                template_clicked = True
                time.sleep(2)
            except Exception as e:
                print(f"No template buttons found: {e}", flush=True)

        # Step 2: Click 'View More' button
        try:
            # Wait for view more button to be available
            view_more_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[@class='vd_text_vert por cp' and contains(text(), 'View More')]"))
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", view_more_button)
            time.sleep(1)
            view_more_button.click()
            print("Clicked the 'View More' button.", flush=True)
            time.sleep(3)  # Give more time for the page to load
        except Exception as e:
            print(f"Error clicking View More button: {e}", flush=True)
            # Try alternative selector
            try:
                view_more_alt = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.ID, "viewDetails"))
                )
                driver.execute_script("arguments[0].click();", view_more_alt)
                print("Clicked 'View More' using alternative method.", flush=True)
                time.sleep(3)
            except Exception as e2:
                print(f"Alternative View More click also failed: {e2}", flush=True)

        # Step 3: Click 'Ask For Review' button
        try:
            # Enhanced selectors for Ask For Review button
            ask_review_selectors = [
                "//div[contains(@class, 'afrVd')]//span[contains(text(), 'Ask For Review')]",
                "//span[contains(@class, 'small_btn_filled_std')]//span[contains(text(), 'Ask For Review')]",
                "//span[contains(text(), 'Ask For Review')]",
                "//div[contains(@class, 'por mb5')]//span[contains(text(), 'Ask For Review')]",
                "//div[contains(@class, 'afrVd')]//span[contains(@class, 'small_btn_filled_std')]"
            ]
            
            ask_review_clicked = False
            for selector in ask_review_selectors:
                try:
                    ask_review_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    # Scroll to element and ensure it's visible
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", ask_review_button)
                    time.sleep(1)
                    
                    # Try regular click first
                    try:
                        ask_review_button.click()
                    except:
                        # Fallback to JavaScript click
                        driver.execute_script("arguments[0].click();", ask_review_button)
                    
                    print(f"Clicked the 'Ask For Review' button using selector: {selector}", flush=True)
                    ask_review_clicked = True
                    break
                except Exception as e:
                    print(f"Failed to click with selector '{selector}': {e}", flush=True)
                    continue
            
            if not ask_review_clicked:
                # Final fallback: search by text content
                try:
                    buttons = driver.find_elements(By.XPATH, "//*[contains(text(), 'Ask For Review')]")
                    for button in buttons:
                        try:
                            if button.is_displayed() and button.is_enabled():
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
                                time.sleep(1)
                                driver.execute_script("arguments[0].click();", button)
                                print("Clicked the 'Ask For Review' button using text search", flush=True)
                                ask_review_clicked = True
                                break
                        except Exception as e:
                            continue
                except Exception as e:
                    print(f"Text search fallback failed: {e}", flush=True)
            
            if ask_review_clicked:
                time.sleep(3)  # Wait for any modal or page changes
            else:
                print("Could not find or click 'Ask For Review' button, continuing...", flush=True)
            
        except Exception as e:
            print(f"Error in Ask For Review section: {e}", flush=True)

        # Step 4: Now proceed with message sending
        # send_messages(driver, first_h2_text)
        
        # Step 5: Extract contact details
        extract_contact_details(driver)
        
    except Exception as e:
        print(f"An error occurred in WhatsApp flow: {e}", flush=True)


def send_messages_improved(driver, first_h2_text):
    """Improved message sending function with better element handling"""
    try:
        print("Starting to send messages...", flush=True)
        
        # Wait for the page to stabilize
        time.sleep(2)
        
        # Try to dismiss any overlays or footers that might be blocking
        try:
            # Check if there are any modal overlays or blocking elements
            blocking_elements = driver.find_elements(By.XPATH, "//footer[@id='convFooter']")
            for element in blocking_elements:
                if element.is_displayed():
                    driver.execute_script("arguments[0].style.display = 'none';", element)
                    print("Temporarily hid blocking footer element.", flush=True)
        except Exception as e:
            print(f"No blocking elements found or couldn't hide them: {e}", flush=True)
        
        # Enhanced selectors for message input
        message_input_selectors = [
            "//div[@id='massage-text']",
            "//div[@contenteditable='true' and contains(@data-placeholder, 'WhatsApp')]",
            "//div[contains(@class, 'edit_div_new')][@contenteditable='true']",
            "//div[@contenteditable='true' and contains(@class, 'edt_div')]",
            "//textarea[contains(@placeholder, 'message') or contains(@placeholder, 'Message')]",
            "//input[contains(@placeholder, 'message') or contains(@placeholder, 'Message')]"
        ]
        
        message_input = None
        for selector in message_input_selectors:
            try:
                message_input = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"Found message input using selector: {selector}", flush=True)
                break
            except Exception as e:
                print(f"Selector '{selector}' failed: {e}", flush=True)
                continue
        
        if not message_input:
            print("Could not find message input element!", flush=True)
            return
        
        # Scroll to the message input and ensure it's in view
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", message_input)
        time.sleep(1)
        
        # Clear any existing text
        try:
            message_input.clear()
        except:
            # For contenteditable divs, use JavaScript to clear
            driver.execute_script("arguments[0].innerHTML = '';", message_input)
        
        # Define messages to send
        messages = [
            "Hello! I hope you're having a great day.",
            f"I noticed you're interested in {first_h2_text}. I'd love to help you with that!",
            "Could you please share more details about your specific requirements?",
            "What quantity are you looking for and what's your expected timeline?",
            "I'm here to provide you with the best solution. Feel free to ask any questions!"
        ]
        
        # Send each message
        for i, message in enumerate(messages, 1):
            try:
                print(f"Sending message {i}/{len(messages)}: {message[:50]}...", flush=True)
                
                # Focus on the input element
                try:
                    message_input.click()
                except:
                    # Use JavaScript to focus if regular click fails
                    driver.execute_script("arguments[0].focus();", message_input)
                
                time.sleep(1)
                
                # Type the message
                if message_input.tag_name.lower() in ['input', 'textarea']:
                    message_input.send_keys(message)
                else:
                    # For contenteditable div, use JavaScript
                    driver.execute_script("arguments[0].innerText = arguments[1];", message_input, message)
                
                time.sleep(1)
                
                # Try to find and click send button
                send_button_selectors = [
                    "//button[contains(@class, 'send') or contains(text(), 'Send')]",
                    "//div[contains(@class, 'send') or contains(@title, 'Send')]",
                    "//span[contains(@class, 'send')]",
                    "//*[@data-testid='send' or contains(@aria-label, 'Send')]"
                ]
                
                send_button_found = False
                for send_selector in send_button_selectors:
                    try:
                        send_button = WebDriverWait(driver, 3).until(
                            EC.element_to_be_clickable((By.XPATH, send_selector))
                        )
                        send_button.click()
                        print(f"Message {i} sent successfully using send button.", flush=True)
                        send_button_found = True
                        break
                    except Exception as e:
                        continue
                
                if not send_button_found:
                    # Try pressing Enter key as fallback
                    try:
                        message_input.send_keys(Keys.RETURN)
                        print(f"Message {i} sent using Enter key.", flush=True)
                    except Exception as e:
                        print(f"Failed to send message {i}: {e}", flush=True)
                
                # Wait between messages
                time.sleep(2)
                
                # Clear the input for next message
                try:
                    message_input.clear()
                except:
                    driver.execute_script("arguments[0].innerHTML = '';", message_input)
                
            except Exception as e:
                print(f"Error sending message {i}: {e}", flush=True)
                continue
        
        print("Finished sending messages.", flush=True)
        
    except Exception as e:
        print(f"An error occurred while sending messages: {e}", flush=True)

def execute_regular_flow(driver, first_h2_text):
    """Execute the regular message sending flow"""
    try:
        print("Starting regular flow...", flush=True)
        
        # Send messages directly
        send_messages(driver, first_h2_text)
        
        # Click 'View More'
        view_more_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@class='vd_text_vert por cp' and contains(text(), 'View More')]"))
        )
        view_more_button.click()
        print("Clicked the 'View More' button.", flush=True)
        time.sleep(2)

        # Extract contact details
        extract_contact_details(driver)
        
    except Exception as e:
        print(f"An error occurred in regular flow: {e}", flush=True)


def send_messages(driver, first_h2_text):
    """Send all messages using the provided templates"""
    try:
        message_input = WebDriverWait(driver, 15).until(EC.visibility_of_element_located((By.XPATH, "//div[@id='massage-text' and @contenteditable='true']")))

        sentences = input_data.get("sentences", [])
        
        print(f"Processing {len(sentences)} message templates...", flush=True)
        print(f"Product name to replace: '{first_h2_text}'", flush=True)

        for i, sentence in enumerate(sentences):
            # Replace {Requested_product_name} with first_h2_text if present
            processed_sentence = sentence
            if "{Requested_product_name}" in sentence:
                processed_sentence = sentence.replace("{Requested_product_name}", first_h2_text)
                print(f"Template {i+1} - Original: '{sentence}'", flush=True)
                print(f"Template {i+1} - Processed: '{processed_sentence}'", flush=True)
            else:
                print(f"Template {i+1} - No replacement needed: '{sentence}'", flush=True)
            
            # Clear the input field and enter the processed message
            message_input.click()
            message_input.send_keys(Keys.CONTROL + "a")
            message_input.send_keys(Keys.DELETE)
            message_input.send_keys(processed_sentence)
            print(f"Entered processed message: '{processed_sentence}'", flush=True)

            # Send the message
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

        print(f"Successfully sent all {len(sentences)} processed messages.", flush=True)
        
    except Exception as e:
        print(f"An error occurred while sending messages: {e}", flush=True)


def extract_contact_details(driver):
    """Extract and send contact details to dashboard"""
    try:
        # Wait for view more button to be available
        view_more_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@class='vd_text_vert por cp' and contains(text(), 'View More')]"))
        )
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", view_more_button)
        time.sleep(1)
        view_more_button.click()
        print("Clicked the 'View More' button.", flush=True)
        time.sleep(3)  # Give more time for the page to load
    except Exception as e:
        print(f"Error clicking View More button: {e}", flush=True)
    try:
        # Extract and print contact details with multiple fallback selectors
        left_name = None
        mobile_number = None
        email_id = None
        address = "Address not found"
        
        # Try to find left name with multiple selectors
        name_selectors = [
            "//div[@id='left-name']",
            "//div[contains(@class, 'left-name')]",
            "//span[contains(@class, 'left-name')]",
            "//div[contains(text(), 'Name')]/following-sibling::*",
            "//span[contains(text(), 'Name')]/following-sibling::*"
        ]
        
        for selector in name_selectors:
            try:
                left_name = driver.find_element(By.XPATH, selector)
                print(f"Left Name: {left_name.text}", flush=True)
                break
            except:
                continue
        
        if not left_name:
            print("Left Name not found", flush=True)
            left_name_text = "Name not found"
        else:
            left_name_text = left_name.text
        
        # Try to find mobile number with multiple selectors based on the HTML structure
        mobile_selectors = [
            "//div[@id='headerMobile']//span[last()]",  # Based on your HTML structure
            "//div[contains(@class, 'headerMobile')]//span[last()]",
            "//span[@class='fl mxwdt75 ml5 mt2 wbba']",  # Original selector
            "//span[contains(@class, 'mxwdt75')]",
            "//div[contains(@class, 'por cp')]//span[last()]",
            "//span[contains(text(), '09') or contains(text(), '08') or contains(text(), '07')]",  # Look for phone number patterns
            "//div[contains(@class, 'headerMobile')]//span[not(contains(@class, 'mlminus5'))]"  # Exclude the icon span
        ]
        
        for selector in mobile_selectors:
            try:
                mobile_number = driver.find_element(By.XPATH, selector)
                mobile_text = mobile_number.text.strip()
                # Validate that it looks like a phone number
                if mobile_text and (mobile_text.isdigit() or len(mobile_text) >= 10):
                    print(f"Mobile Number: {mobile_text}", flush=True)
                    break
            except:
                continue
        
        if not mobile_number:
            print("Mobile Number not found", flush=True)
            mobile_text = "Mobile not found"
        else:
            mobile_text = mobile_number.text.strip()
        
        # Try to find email with multiple selectors based on the HTML structure
        email_selectors = [
            "//span[@class='fl mxwdt75 ml5 wbba']",  # Exact class from HTML
            "//span[contains(@class, 'wbba') and contains(text(), '@')]",  # Class with email validation
            "//span[contains(text(), '@')]",  # Any span with @ symbol
            "//a[contains(@href, 'mailto:')]",  # Mailto links
            "//div[contains(text(), '@')]",  # Any div with @ symbol
            "//span[contains(@class, 'mxwdt75') and contains(@class, 'wbba')]"  # Alternative class combination
        ]
        
        for selector in email_selectors:
            try:
                email_element = driver.find_element(By.XPATH, selector)
                email_text = email_element.text.strip()
                if '@' in email_text and '.' in email_text:  # Basic email validation
                    email_id = email_text
                    print(f"Email ID: {email_id}", flush=True)
                    break
            except:
                continue
        
        if not email_id:
            print("Email ID not found.", flush=True)
            email_id = None
        
        # Try to find address based on the HTML structure
        address_selectors = [
            "//span[contains(text(),'Address')]/following-sibling::span[contains(@class, 'clr68')]",  # Based on your HTML structure
            "//span[contains(text(),'Address')]/following::span[contains(@class, 'clr68')]",  # Alternative path
            "//span[contains(@class, 'clr68') and contains(@class, 'fs12')]",  # Class-based selector
            "//div[contains(@class, 'wcalc160')]//span[contains(@class, 'clr68')]",  # Container-based selector
            "//span[contains(text(),'Address')]/following::span[1]/span",  # Original selector
            "//div[contains(text(),'Address')]/following-sibling::*",  # Fallback
            "//span[contains(text(),'Address')]/following-sibling::*",  # Fallback
            "//div[contains(@class, 'address')]",  # Generic address class
            "//span[contains(@class, 'address')]"  # Generic address class
        ]
        
        for selector in address_selectors:
            try:
                address_element = driver.find_element(By.XPATH, selector)
                address = address_element.text.strip()
                if address and address != "Address not found" and len(address) > 5:  # Basic validation
                    print(f"Address: {address}", flush=True)
                    break
            except:
                continue
        
        user_mobile_number = input_data.get("mobileNumber", "")  # Get the logged-in user's mobile number
        send_data_to_dashboard(left_name_text, mobile_text, email_id, user_mobile_number, address)
        
    except Exception as e:
        print(f"An error occurred while extracting contact details: {e}", flush=True)
        # Try to send whatever data we have
        try:
            user_mobile_number = input_data.get("mobileNumber", "")
            send_data_to_dashboard("Name not found", "Mobile not found", None, user_mobile_number, "Address not found")
        except Exception as send_error:
            print(f"Error sending fallback data: {send_error}", flush=True)

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

def wait_for_overlay_to_disappear(driver, timeout=10):
    """Wait for overlay elements to disappear or become hidden"""
    try:
        # Wait for overlay to either disappear or become hidden
        WebDriverWait(driver, timeout).until(
            lambda d: not d.find_elements(By.CSS_SELECTOR, ".overlay_fltr[style*='display: block']")
        )
        print("Overlay disappeared.")
        return True
    except TimeoutException:
        print("Overlay didn't disappear in time, trying to dismiss it.")
        return False

def dismiss_overlay(driver):
    """Try to dismiss any blocking overlays"""
    try:
        # Try clicking outside the overlay or finding a close button
        overlays = driver.find_elements(By.CSS_SELECTOR, ".overlay_fltr")
        for overlay in overlays:
            if overlay.is_displayed():
                # Try to find close button or click outside
                close_buttons = driver.find_elements(By.CSS_SELECTOR, ".close, .dismiss, .cancel, [aria-label='Close']")
                if close_buttons:
                    close_buttons[0].click()
                    time.sleep(1)
                    return True
                else:
                    # Try pressing Escape key or removing overlay
                    try:
                        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
                        time.sleep(1)
                        return True
                    except:
                        # Force remove overlay using JavaScript
                        driver.execute_script("arguments[0].style.display = 'none';", overlay)
                        print("Force removed overlay using JavaScript")
                        time.sleep(1)
                        return True
        return False
    except Exception as e:
        print(f"Error dismissing overlay: {e}")
        return False

def click_element_safely(driver, element, max_attempts=3):
    """Safely click an element, handling overlays and interceptions"""
    for attempt in range(max_attempts):
        try:
            # First, wait for overlay to disappear
            wait_for_overlay_to_disappear(driver, timeout=5)
            
            # Scroll element into view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.5)
            
            # Try regular click first
            element.click()
            print("Element clicked successfully")
            return True
            
        except ElementClickInterceptedException:
            print(f"Click intercepted on attempt {attempt + 1}, trying to handle overlay...")
            
            # Try to dismiss overlay
            if dismiss_overlay(driver):
                time.sleep(1)
                continue
            
            # Try JavaScript click as alternative
            try:
                driver.execute_script("arguments[0].click();", element)
                print("Element clicked using JavaScript")
                return True
            except Exception as js_error:
                print(f"JavaScript click also failed: {js_error}")
                
            # Try ActionChains click
            try:
                ActionChains(driver).move_to_element(element).click().perform()
                print("Element clicked using ActionChains")
                return True
            except Exception as action_error:
                print(f"ActionChains click failed: {action_error}")
                
            if attempt == max_attempts - 1:
                print("All click attempts failed")
                return False
            
            time.sleep(2)  # Wait before next attempt
            
        except Exception as e:
            print(f"Unexpected error clicking element: {e}")
            if attempt == max_attempts - 1:
                return False
            time.sleep(1)
    
    return False

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
    print(f"Redirecting to {second_url} to check buyer balance...", flush=True)
    driver.get(second_url)
    time.sleep(3)  # Static wait for dashboard loading

    try:
        # Check the value of the element
        time.sleep(3)  # Static wait
        buyer_balance_element = driver.find_element(By.ID, "cstm_bl_bal1")
        buyer_balance = int(buyer_balance_element.text)
        print(f"BUYER_BALANCE:{buyer_balance}", flush=True)

        if buyer_balance > 0:
            print("Buyer balance is greater than 0. Redirecting back to the first link...", flush=True)
            driver.get(first_url)
            time.sleep(10)  # Static wait

            driver.refresh()
            time.sleep(3)  # Static wait

            # Wait for overlays to disappear after refresh
            wait_for_overlay_to_disappear(driver, timeout=10)

            # State selection with comprehensive error handling
            def handle_state_selection():
                """Handle state selection with graceful error handling"""
                try:
                    # Select specific states instead of 'All India'
                    selected_states = input_data.get("selectedStates", [])

                    # Map of alternative state names or spellings in case exact match fails
                    state_alternatives = {
                        "Karnataka": ["Karnataka", "Bangalore", "Bengaluru"],
                        "Maharashtra": ["Maharashtra", "Mumbai", "Pune"],
                        "Delhi": ["Delhi", "New Delhi", "NCR"]
                    }

                    if selected_states:
                        # If there are 36 or more states, directly select All India instead
                        if len(selected_states) >= 36:
                            print(f"Found {len(selected_states)} states (>= 36). Selecting 'All India' instead of individual states.", flush=True)
                            try:
                                # Wait for overlays to disappear
                                wait_for_overlay_to_disappear(driver, timeout=5)
                                
                                all_india_element = WebDriverWait(driver, 10).until(
                                    EC.presence_of_element_located((By.ID, "location_2"))
                                )
                                
                                if click_element_safely(driver, all_india_element):
                                    print("Successfully selected 'All India' for large state list.", flush=True)
                                else:
                                    print("Could not click 'All India' label for large state list, but continuing...", flush=True)
                                    
                            except Exception as e:
                                print(f"Could not click the 'All India' label for large state list: {e}, but continuing execution...", flush=True)
                            
                            return  # Exit the state selection function since All India is selected
                        
                        print(f"Attempting to select {len(selected_states)} states individually: {selected_states}", flush=True)
                        
                        try:
                            # Wait for any initial overlays to disappear
                            wait_for_overlay_to_disappear(driver, timeout=10)
                            
                            # First, hover over the dropdown arrow to trigger the state selection interface
                            try:
                                dropdown_arrow = driver.find_element(By.CSS_SELECTOR, "span.dropdown_arrow")
                                ActionChains(driver).move_to_element(dropdown_arrow).perform()
                                print("Hovered over dropdown arrow.")
                                time.sleep(2)
                            except:
                                # Fallback: hover over the location container
                                try:
                                    location_container = driver.find_element(By.CLASS_NAME, "SLC_dflx")
                                    ActionChains(driver).move_to_element(location_container).perform()
                                    print("Hovered over location container.")
                                    time.sleep(2)
                                except:
                                    print("Could not hover over any location elements, continuing anyway...")
                            
                            # Wait for the state selection area to appear and become visible
                            try:
                                state_selection_area = WebDriverWait(driver, 10).until(
                                    EC.visibility_of_element_located((By.CSS_SELECTOR, ".fltr_relead_hover[style*='display: block'], .fltr_relead_hover:not([style*='display: none'])"))
                                )
                                print("State selection area is now visible.")
                            except:
                                print("State selection area not found, but continuing with execution...")
                                return  # Exit gracefully from state selection
                            
                            # Find and focus on the search input field
                            try:
                                search_input = WebDriverWait(driver, 10).until(
                                    EC.element_to_be_clickable((By.ID, "city_others_filter"))
                                )
                                
                                # Click on the input field to focus it
                                search_input.click()
                                time.sleep(1)
                            except:
                                print("Search input field not found, skipping state selection...")
                                return  # Exit gracefully from state selection
                            
                            # Process each state with individual error handling
                            for state_name in selected_states:
                                try:
                                    alternatives_to_try = state_alternatives.get(state_name, [state_name])
                                    state_successfully_selected = False
                                    
                                    for attempt_name in alternatives_to_try:
                                        if state_successfully_selected:
                                            break
                                            
                                        try:
                                            print(f"Searching for state: {attempt_name}")
                                            
                                            # Clear the search field completely using multiple methods
                                            search_input.clear()
                                            search_input.send_keys(Keys.CONTROL + "a")  # Select all
                                            search_input.send_keys(Keys.DELETE)  # Delete selected text
                                            time.sleep(0.5)
                                            
                                            # Focus on the input field and type the state name
                                            search_input.click()
                                            time.sleep(0.5)
                                            
                                            # Type character by character to trigger autocomplete
                                            for char in attempt_name:
                                                search_input.send_keys(char)
                                                time.sleep(0.1)  # Small delay between characters
                                            
                                            print(f"Typed '{attempt_name}' in search field character by character")
                                            
                                            time.sleep(4)  # Wait longer for autocomplete results
                                            
                                            # Wait for the autocomplete dropdown to appear
                                            try:
                                                # Look for the specific autocomplete container that's actually visible
                                                autocomplete_container = None
                                                
                                                # First try to find the specific bl_city_filter autocomplete that's visible
                                                potential_containers = driver.find_elements(By.CSS_SELECTOR, ".ui-autocomplete.bl_city_filter")
                                                
                                                for container in potential_containers:
                                                    container_style = container.get_attribute("style") or ""
                                                    if "display: block" in container_style and container.is_displayed():
                                                        autocomplete_container = container
                                                        print(f"Found visible autocomplete container with bl_city_filter class")
                                                        break
                                                
                                                # If not found, try broader search
                                                if not autocomplete_container:
                                                    all_autocomplete = driver.find_elements(By.CSS_SELECTOR, ".ui-autocomplete.ui-menu")
                                                    for container in all_autocomplete:
                                                        if container.is_displayed():
                                                            container_style = container.get_attribute("style") or ""
                                                            if "display: block" in container_style:
                                                                autocomplete_container = container
                                                                print(f"Found visible autocomplete container with broader search")
                                                                break
                                                
                                                if autocomplete_container:
                                                    print(f"Autocomplete dropdown found for {attempt_name}")
                                                    
                                                    # Get all autocomplete list items - try multiple selectors
                                                    autocomplete_items = []
                                                    
                                                    # Try different selectors for list items
                                                    item_selectors = [
                                                        "li.ui-menu-item",
                                                        "li.as_D",
                                                        "li",
                                                        ".ui-menu-item",
                                                        "ul li"
                                                    ]
                                                    
                                                    for selector in item_selectors:
                                                        items = autocomplete_container.find_elements(By.CSS_SELECTOR, selector)
                                                        if items:
                                                            autocomplete_items = items
                                                            print(f"Found {len(items)} autocomplete items using selector: {selector}")
                                                            break
                                                    
                                                    if autocomplete_items:
                                                        print(f"Found {len(autocomplete_items)} autocomplete results")
                                                        
                                                        # Find the matching state in the results
                                                        for item in autocomplete_items:
                                                            try:
                                                                item_text = item.text.strip()
                                                                print(f"Checking autocomplete item: '{item_text}'")
                                                                
                                                                # More flexible matching - check for state name in the text
                                                                if (state_name.lower() in item_text.lower() or 
                                                                    attempt_name.lower() in item_text.lower()):
                                                                    
                                                                    # Try to click the anchor element within the li, or the li itself
                                                                    try:
                                                                        anchor = item.find_element(By.TAG_NAME, "a")
                                                                        click_target = anchor
                                                                    except:
                                                                        click_target = item
                                                                    
                                                                    # Use JavaScript click for more reliability
                                                                    driver.execute_script("arguments[0].click();", click_target)
                                                                    print(f"Successfully selected state from autocomplete: {attempt_name} -> {item_text}")
                                                                    state_successfully_selected = True
                                                                    time.sleep(2)
                                                                    break
                                                                    
                                                            except Exception as item_error:
                                                                print(f"Error clicking autocomplete item: {item_error}")
                                                                continue
                                                        
                                                        # If no match found, try the first result as fallback
                                                        if not state_successfully_selected and autocomplete_items:
                                                            try:
                                                                first_item = autocomplete_items[0]
                                                                try:
                                                                    first_anchor = first_item.find_element(By.TAG_NAME, "a")
                                                                    click_target = first_anchor
                                                                except:
                                                                    click_target = first_item
                                                                
                                                                driver.execute_script("arguments[0].click();", click_target)
                                                                print(f"Selected first available autocomplete result for: {attempt_name}")
                                                                state_successfully_selected = True
                                                                time.sleep(2)
                                                            except Exception as first_error:
                                                                print(f"Failed to click first autocomplete result: {first_error}")
                                                    
                                                    else:
                                                        print(f"No autocomplete items found in container for {attempt_name}")
                                                
                                                else:
                                                    print(f"No visible autocomplete container found for {attempt_name}")
                                                    
                                            except Exception as autocomplete_error:
                                                print(f"Error finding autocomplete dropdown: {autocomplete_error}")
                                            
                                            # If autocomplete selection was successful, skip the fallback to suggested states
                                            if state_successfully_selected:
                                                print(f"Successfully selected {attempt_name} from autocomplete, skipping suggested states fallback")
                                            else:
                                                print(f"No autocomplete dropdown appeared for state: {attempt_name}")
                                                
                                                # Fallback: Try to find the state in suggested states
                                                try:
                                                    print(f"Trying to find {attempt_name} in suggested states...")
                                                    
                                                    # First try exact match with data-val or title
                                                    suggested_state = None
                                                    try:
                                                        suggested_state = driver.find_element(By.XPATH, 
                                                            f"//div[@class='SLc_brs3 SLC_f14 SLC_cp filt_cps suggested_states_cls common_loc' and (@data-val='{attempt_name}' or @title='{attempt_name}')]")
                                                    except:
                                                        # Try case-insensitive search
                                                        try:
                                                            suggested_states = driver.find_elements(By.CSS_SELECTOR, 
                                                                "div.suggested_states_cls.common_loc")
                                                            for state_elem in suggested_states:
                                                                if (state_elem.get_attribute("data-val").lower() == attempt_name.lower() or 
                                                                    state_elem.get_attribute("title").lower() == attempt_name.lower() or
                                                                    state_elem.text.lower() == attempt_name.lower()):
                                                                    suggested_state = state_elem
                                                                    break
                                                        except Exception as search_error:
                                                            print(f"Error searching suggested states: {search_error}")
                                                    
                                                    if suggested_state:
                                                        if click_element_safely(driver, suggested_state):
                                                            print(f"Found and selected state from suggested list: {attempt_name}")
                                                            state_successfully_selected = True
                                                        else:
                                                            print(f"Failed to click suggested state: {attempt_name}")
                                                    else:
                                                        print(f"State {attempt_name} not found in suggested states list")
                                                        
                                                except Exception as suggested_error:
                                                    print(f"State {attempt_name} not found in suggested list either: {suggested_error}")
                                            
                                            # Clear the search field before next attempt/state
                                            try:
                                                search_input.clear()
                                                time.sleep(0.5)
                                            except:
                                                pass
                                                
                                            # If successful, break out of alternatives loop
                                            if state_successfully_selected:
                                                break
                                                
                                            # Small delay between attempts
                                            time.sleep(1)
                                            
                                        except Exception as state_error:
                                            print(f"Error processing state '{attempt_name}': {state_error}")
                                            # Clear search field even if there's an error
                                            try:
                                                search_input.clear()
                                            except:
                                                pass
                                    
                                    if not state_successfully_selected:
                                        print(f"Failed to select any variant of state: {state_name}, but continuing...")
                                    
                                    # Small delay between different states
                                    time.sleep(1)
                                    
                                except Exception as individual_state_error:
                                    print(f"Error processing individual state {state_name}: {individual_state_error}, continuing with next state...")
                                    continue
                            
                            # Final clear of the search field
                            try:
                                search_input.clear()
                                print("Cleared search field after all state selections")
                            except:
                                pass
                                
                            print(f"Completed processing {len(selected_states)} states.")
                            
                        except Exception as main_error:
                            print(f"Error in main state selection process: {main_error}, trying fallback...")
                            # Fallback: if state selection fails, try to click All India as backup
                            try:
                                # Wait for overlays to disappear before fallback
                                wait_for_overlay_to_disappear(driver, timeout=5)
                                
                                all_india_element = WebDriverWait(driver, 5).until(
                                    EC.presence_of_element_located((By.ID, "location_2"))
                                )
                                
                                if click_element_safely(driver, all_india_element):
                                    print("Fallback: Successfully clicked the 'All India' label after state selection failure.", flush=True)
                                else:
                                    print("Fallback: Could not click 'All India' even with safe click method.", flush=True)
                                    
                            except Exception as fallback_error:
                                print(f"Fallback also failed: {fallback_error}, but continuing execution...", flush=True)
                                
                    else:
                        # If no specific states are selected, default to All India
                        try:
                            # Wait for overlays to disappear
                            wait_for_overlay_to_disappear(driver, timeout=5)
                            
                            all_india_element = WebDriverWait(driver, 5).until(
                                EC.presence_of_element_located((By.ID, "location_2"))
                            )
                            
                            if click_element_safely(driver, all_india_element):
                                print("No specific states provided, clicked 'All India' label.", flush=True)
                            else:
                                print("Could not click 'All India' label, but continuing...", flush=True)
                                
                        except Exception as e:
                            print(f"Could not click the 'All India' label: {e}, but continuing execution...", flush=True)
                
                except Exception as outer_error:
                    print(f"Outer error in state selection: {outer_error}, but continuing with main execution...", flush=True)

            # Call the state selection function with comprehensive error handling
            print("Starting state selection process...", flush=True)
            handle_state_selection()
            print("State selection process completed (with or without success), continuing with main execution...", flush=True)

            # Continue with the rest of the function logic - THIS WILL ALWAYS EXECUTE
            time.sleep(3)

            # Read the data from the span element with color: rgb(42, 166, 153)
            span_result = False
            try:
                time.sleep(3)  # Static wait
                first_grid = driver.find_element(By.CSS_SELECTOR, "div.Mcat_buylead") 
                coupling_spans = first_grid.find_elements(By.CSS_SELECTOR, "span[style*='color: rgb(42, 166, 153)']")
                found_texts = [span.text.strip() for span in coupling_spans if span.text.strip()]
                print(f"data from span: {found_texts}", flush=True)

                # Check if the extracted text matches any word in the array
                span_result = any(text in word_array for text in found_texts)
                print(span_result, flush=True)

            except Exception as e:
                print(f"Failed to read data from span with specified color: {e}", flush=True)

            # After reading the span, get the first <h2> element on the page
            h2_result = False
            try:
                time.sleep(3)  # Static wait
                first_h2 = driver.find_element(By.XPATH, "//h2")
                first_h2_text = first_h2.text
                lead_bought = first_h2_text
                print(f"Read data from the first <h2>: {first_h2_text}", flush=True)

                # Check if the extracted text matches any word in the h2_word_array
                h2_result = first_h2_text not in h2_word_array
                print(h2_result)

            except Exception as e:
                print(f"Failed to read data from the first <h2>: {e}", flush=True)

            # Get the time element using the updated XPath based on the provided HTML structure
            time_result = False
            try:
                time.sleep(3)  # Static wait
                
                # Updated XPath to match the actual HTML structure
                time_element = driver.find_element(By.XPATH, "//div[contains(@class, 'lstNwLftLoc') and contains(@class, 'lstNwDflx')]//strong")
                time_text = time_element.text
                print(f"Time text: {time_text}", flush=True)

                # Parse the time value
                if 'mins ago' in time_text:
                    time_value = int(time_text.split()[0])
                elif 'secs ago' in time_text:
                    time_value = int(time_text.split()[0]) / 60  # Convert seconds to minutes
                elif 'hrs ago' in time_text:
                    time_value = int(time_text.split()[0]) * 60  # Convert hours to minutes
                else:
                    time_value = 11  # Default to a value greater than 10 mins if parsing fails

                time_result = time_value < 1000000
                print(time_result, flush=True)

            except Exception as e:
                print(f"Failed to read the time text: {e}", flush=True)
                # Try an alternative selector as a fallback
                try:
                    time_element = driver.find_element(By.CSS_SELECTOR, "div.lstNwLftLoc.lstNwDflx strong")
                    time_text = time_element.text
                    print(f"Time text (alternative method): {time_text}", flush=True)
                    
                    # Parse the time value
                    if 'mins ago' in time_text:
                        time_value = int(time_text.split()[0])
                    elif 'secs ago' in time_text:
                        time_value = int(time_text.split()[0]) / 60  # Convert seconds to minutes
                    elif 'hrs ago' in time_text:
                        time_value = int(time_text.split()[0]) * 60  # Convert hours to minutes
                    else:
                        time_value = 11  # Default to a value greater than 10 mins if parsing fails

                    # Check if time is less than specified threshold
                    time_result = time_value < 1000000
                    print(time_result, flush=True)
                    
                except Exception as e2:
                    print(f"Failed to read the time text with alternative method: {e2}", flush=True)
                    print("Screenshot saved as time_element_error.png", flush=True)

            # Check if the close button is available and click it if found
            try:
                close_button = driver.find_element(By.XPATH, "//span[@class='glob_sa_close' and contains(text(), '—')]")
                if click_element_safely(driver, close_button):
                    print("Clicked the close button.", flush=True)
                else:
                    print("Failed to click close button safely.", flush=True)
            except Exception as e:
                if 'no such element' in str(e).lower():
                    print("Close button not found. Skipping this step.", flush=True)
                else:
                    print(f"Close button not found or failed to click: {e}", flush=True)

            # If all conditions are True, click the "Contact Buyer Now" button
            if span_result and h2_result and time_result:
                if click_contact_buyer_now_button(driver, wait):
                    # Call the function to go to message center and click the 'Reply Now' button
                    go_to_message_center_and_click(driver, first_h2_text)
                else:
                    print("Failed to click the 'Contact Buyer Now' button.", flush=True)

                # Refresh the page three times
                print("Waiting for 10 seconds...", flush=True)
                time.sleep(10)  # Static wait for refresh
                
        else:
            print("ZERO_BALANCE_DETECTED", flush=True)
            return
            
    except Exception as e:
        print(f"Error while checking buyer balance: {e}", flush=True)
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

        # try:
        #     enter_password_button = wait.until(
        #         EC.element_to_be_clickable((By.ID, "passwordbtn1"))
        #     )
        #     enter_password_button.click()
        #     print("Clicked 'Enter Password' button.")
        #     user_password = input_data.get("password", "")
        #     password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
        #     password_input.clear()
        #     password_input.send_keys(user_password)
        #     print("Entered the password.")
        #     sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "signWP")))
        #     sign_in_button.click()
        #     print("Clicked 'Sign In' button.")
        # except (TimeoutException, NoSuchElementException):
        #     print("Enter password button not found. Please login to your leads provider account first.",flush=True)
        #     print("ROUTE_TO:/execute-task",flush=True)
        #     return "Unsuccessful"

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
                                 
def send_to_node_api(expert_details):
    url = "https://api.leadscruise.com/api/support/bulk"

    payload = []
    for expert in expert_details:
        if expert["email"]:
            payload.append({
                "name": expert.get("name", "Unknown"),
                "email": expert["email"],
                "phoneNumber": expert.get("phone", ""),
            })

    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print("Status Code:", response.status_code)
        print("Raw Response Text:", response.text)

        try:
            data = response.json()
            print("Parsed JSON Response:", data)
        except ValueError:
            print("Response is not JSON!")

    except Exception as e:
        print(f"Failed to send data to API: {e}")
 
def get_expert_details(driver):
    """
    Extracts expert details from the '#expert_assistance_main_box' section.
    Returns a list of dictionaries with name, role, phone, email, videoMeet, and photoUrl.
    """
    try:
        # Wait for the DOM to load
        time.sleep(2)

        try:
            expert_box = driver.find_element(By.ID, "expert_assistance_main_box")
        except NoSuchElementException:
            print("Expert box not found.")
            return []

        expert_elements = expert_box.find_elements(By.CLASS_NAME, "avtar_cont")
        experts = []

        for expert in expert_elements:
            try:
                name = expert.find_element(By.CSS_SELECTOR, "p.Dash_c10.SLC_f14.SLC_fwb").text.strip()
            except NoSuchElementException:
                name = None

            try:
                role = expert.find_element(By.CSS_SELECTOR, "p.SLC_f14.Dash_c11.Dash_p2").text.strip()
            except NoSuchElementException:
                role = None

            try:
                phone = expert.find_element(By.CSS_SELECTOR, ".SLC_dflx.SLC_aic .Dash_c12").text.strip()
            except NoSuchElementException:
                phone = None

            try:
                email = expert.find_element(By.CSS_SELECTOR, "a[href^='mailto:']").text.strip()
            except NoSuchElementException:
                email = None

            try:
                video_meet = expert.find_element(By.ID, "req_meet").text.strip()
            except NoSuchElementException:
                video_meet = None

            try:
                photo_url = expert.find_element(By.TAG_NAME, "img").get_attribute("src")
            except NoSuchElementException:
                photo_url = None

            experts.append({
                "name": name,
                "role": role,
                "phone": phone,
                "email": email,
                "videoMeet": video_meet,
                "photoUrl": photo_url
            })

        return experts

    except Exception as e:
        print(f"Error while fetching expert details: {e}")
        return []

def fetch_analytics_data(driver, user_mobile_number, user_password):
    """
    Fetch analytics data (charts and tables) from IndiaMART and store in database
    """
    try:
        print("Starting analytics data fetch...", flush=True)
        
        # Navigate to analytics page
        analytics_url = "https://seller.indiamart.com/reportnew/home"
        print(f"Navigating to analytics page: {analytics_url}", flush=True)
        driver.get(analytics_url)
        time.sleep(5)  # Increased wait time
        
        # Set viewport and zoom
        driver.execute_script("document.body.style.zoom = '100%';")
        driver.set_window_size(1920, 1080)
        
        # Wait for page to load completely
        wait = WebDriverWait(driver, 60)
        
        # Wait for analytics page to load
        try:
            # Try multiple selectors for the analytics page
            analytics_loaded = False
            selectors_to_try = [
                ".Enquiries_header__2_RoR button",
                "#Week",
                "canvas[role='img']",
                ".Enquiries_header__2_RoR"
            ]
            
            for selector in selectors_to_try:
                try:
                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                    analytics_loaded = True
                    print(f"Analytics page loaded, found selector: {selector}", flush=True)
                    break
                except:
                    continue
            
            if not analytics_loaded:
                print("Analytics page not loaded properly, aborting...", flush=True)
                return False
                
        except Exception as e:
            print(f"Error waiting for analytics page: {e}", flush=True)
            return False
        
        # Initialize data
        weekly_base64 = ""
        monthly_base64 = ""
        location_data = []
        category_data = []
        
        # Get weekly chart (default)
        try:
            print("Fetching weekly chart...", flush=True)
            week_button = wait.until(EC.element_to_be_clickable((By.ID, "Week")))
            week_button.click()
            time.sleep(3)  # Increased wait time for chart to render
            
            # Find and capture weekly chart
            weekly_canvas = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[role='img']")))
            weekly_base64 = driver.execute_script("""
                const canvas = arguments[0];
                return canvas.toDataURL('image/png').split(',')[1];
            """, weekly_canvas)
            print("Weekly chart captured successfully", flush=True)
            
        except Exception as e:
            print(f"Error capturing weekly chart: {e}", flush=True)
        
        # Get monthly chart
        try:
            print("Fetching monthly chart...", flush=True)
            month_button = wait.until(EC.element_to_be_clickable((By.ID, "Month")))
            month_button.click()
            time.sleep(3)  # Increased wait time for chart to render
            
            # Find and capture monthly chart
            monthly_canvas = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[role='img']")))
            monthly_base64 = driver.execute_script("""
                const canvas = arguments[0];
                return canvas.toDataURL('image/png').split(',')[1];
            """, monthly_canvas)
            print("Monthly chart captured successfully", flush=True)
            
        except Exception as e:
            print(f"Error capturing monthly chart: {e}", flush=True)
        
        # Scrape table data
        print("Fetching table data...", flush=True)
        try:
            # Use flexible selector that matches the table ID pattern
            table_selector = 'table[id^="Enquiries_reportTableCSS"]'
            
            # Wait for table to be present
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, table_selector)))
            
            tables_exist = driver.execute_script(f"""
                return document.querySelector('{table_selector}') !== null;
            """)
            
            if tables_exist:
                print(f"Found table with selector: {table_selector}", flush=True)
                
                # Debug: Get the actual table ID
                actual_table_id = driver.execute_script("""
                    const table = document.querySelector('table[id^="Enquiries_reportTableCSS"]');
                    return table ? table.id : null;
                """)
                print(f"Actual table ID found: {actual_table_id}", flush=True)
                
                # Extract category data (default view - Top Categories tab is active)
                category_data = driver.execute_script("""
                    const table = document.querySelector('table[id^="Enquiries_reportTableCSS"]');
                    if (!table) return [];
                    
                    const rows = Array.from(table.querySelectorAll('tbody tr'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('td'));
                        return {
                            category: cells[0]?.textContent?.trim() || '',
                            leadsConsumed: parseInt(cells[1]?.textContent?.trim().replace(/,/g, '') || '0'),
                            enquiries: parseInt(cells[2]?.textContent?.trim().replace(/,/g, '') || '0'),
                            calls: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '') || '0')
                        };
                    }).filter(item => item.category !== ''); // Filter out empty rows
                """)
                print(f"Extracted {len(category_data)} category records", flush=True)
                
                # Check if there are location/category tabs to switch between
                try:
                    # Look for the specific location tab using the correct selector
                    location_tab = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#locations")))
                    if location_tab:
                        print("Found location tab, switching to extract location data...", flush=True)
                        location_tab.click()
                        time.sleep(4)  # Wait for table to update
                        
                        # Wait for table to refresh with location data
                        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, table_selector)))
                        
                        # Extract location data
                        location_data = driver.execute_script("""
                            const table = document.querySelector('table[id^="Enquiries_reportTableCSS"]');
                            if (!table) return [];
                            
                            const rows = Array.from(table.querySelectorAll('tbody tr'));
                            return rows.map(row => {
                                const cells = Array.from(row.querySelectorAll('td'));
                                return {
                                    location: cells[0]?.textContent?.trim() || '',
                                    leadsConsumed: parseInt(cells[1]?.textContent?.trim().replace(/,/g, '') || '0'),
                                    enquiries: parseInt(cells[2]?.textContent?.trim().replace(/,/g, '') || '0'),
                                    calls: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '') || '0')
                                };
                            }).filter(item => item.location !== ''); // Filter out empty rows
                        """)
                        print(f"Extracted {len(location_data)} location records", flush=True)
                    else:
                        print("Location tab not found", flush=True)
                        location_data = []
                            
                except Exception as tab_error:
                    print(f"Error switching tabs: {tab_error}", flush=True)
                    location_data = []
                    
            else:
                print("No tables found on analytics page", flush=True)
                category_data = []
                location_data = []
                
        except Exception as e:
            print(f"Error in table scraping: {e}", flush=True)
            
            # Additional debugging
            try:
                page_source_snippet = driver.execute_script("""
                    const tableContainer = document.querySelector('.Enquiries_tableRen__3RhuF');
                    return tableContainer ? tableContainer.innerHTML.substring(0, 500) : 'Table container not found';
                """)
                print(f"Page source snippet: {page_source_snippet}", flush=True)
            except:
                pass
                
            category_data = []
            location_data = []
        
        # Only proceed if we have at least some data
        if not weekly_base64 and not monthly_base64:
            print("No charts captured, aborting analytics storage", flush=True)
            return False
        
        # Prepare analytics data
        analytics_data = {
            "charts": {
                "weekly": weekly_base64,
                "monthly": monthly_base64
            },
            "tables": {
                "locations": location_data,
                "categories": category_data
            },
            "userMobileNumber": user_mobile_number
        }
        
        # Store analytics data in database
        store_analytics_data(analytics_data)
        
        print("Analytics data fetched and stored successfully!", flush=True)
        return True
        
    except Exception as e:
        print(f"Error fetching analytics data: {e}", flush=True)
        return False
    
def store_analytics_data(analytics_data):
    """
    Store analytics data in the database via API call
    """
    try:
        # API endpoint to store analytics data
        api_url = "https://api.leadscruise.com/api/analytics/store"  # Use localhost for development
        
        payload = {
            "charts": analytics_data["charts"],
            "tables": analytics_data["tables"],
            "userMobileNumber": analytics_data["userMobileNumber"],
            "fetchedAt": time.time()
        }
        
        print(f"Sending analytics data to API: {api_url}", flush=True)
        print(f"Payload keys: {list(payload.keys())}", flush=True)
        print(f"Charts keys: {list(payload['charts'].keys()) if payload['charts'] else 'None'}", flush=True)
        print(f"Tables keys: {list(payload['tables'].keys()) if payload['tables'] else 'None'}", flush=True)
        
        try:
            response = requests.post(api_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                print("Analytics data stored successfully in database", flush=True)
                return True
            else:
                print(f"Failed to store analytics data. Status: {response.status_code}, Response: {response.text}", flush=True)
                return False
                
        except requests.exceptions.ConnectionError as e:
            print(f"Connection error - API server may not be running: {e}", flush=True)
            print("Attempting to save analytics data locally...", flush=True)
            return save_analytics_data_locally(analytics_data)
        except requests.exceptions.Timeout as e:
            print(f"Timeout error: {e}", flush=True)
            print("Attempting to save analytics data locally...", flush=True)
            return save_analytics_data_locally(analytics_data)
            
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error storing analytics data: {e}", flush=True)
        print("Attempting to save analytics data locally...", flush=True)
        return save_analytics_data_locally(analytics_data)
    except requests.exceptions.Timeout as e:
        print(f"Timeout error storing analytics data: {e}", flush=True)
        print("Attempting to save analytics data locally...", flush=True)
        return save_analytics_data_locally(analytics_data)
    except Exception as e:
        print(f"Error storing analytics data: {e}", flush=True)
        print("Attempting to save analytics data locally...", flush=True)
        return save_analytics_data_locally(analytics_data)


def save_analytics_data_locally(analytics_data):
    """
    Save analytics data locally as a fallback when API is not available
    """
    try:
        import json
        import os
        from datetime import datetime
        
        # Create analytics directory if it doesn't exist
        analytics_dir = "analytics_data"
        if not os.path.exists(analytics_dir):
            os.makedirs(analytics_dir)
        
        # Create filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{analytics_dir}/analytics_{analytics_data['userMobileNumber']}_{timestamp}.json"
        
        # Save data to file
        with open(filename, 'w') as f:
            json.dump(analytics_data, f, indent=2)
        
        print(f"Analytics data saved locally to: {filename}", flush=True)
        return True
        
    except Exception as e:
        print(f"Error saving analytics data locally: {e}", flush=True)
        return False


def main():
    global redirect_count
    global lead_count
    global max_captures
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
    unique_id = input_data.get("uniqueId", "123456")
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
            if result == "Success":
                expert_details = get_expert_details(driver)
                print(expert_details)
                send_to_node_api(expert_details)
          
                # Fetch analytics data after successful login and expert details
                user_mobile_number = input_data.get("mobileNumber", "")
                user_password = input_data.get("password", "")
          
                if user_mobile_number and user_password:
                    print("Fetching analytics data after successful login...", flush=True)
                    analytics_success = fetch_analytics_data(driver, user_mobile_number, user_password)
                    if analytics_success:
                        print("Analytics data fetched and stored successfully!", flush=True)
                    else:
                        print("Failed to fetch analytics data, continuing with main process...", flush=True)
                else:
                    print("Mobile number or password not available, skipping analytics fetch...", flush=True)
                
            else:
                print("Login failed, skipping expert data extraction.")
            if result == "Unsuccessful":
                print("Login failed. Exiting program...", flush=True)
                return

        # Main processing loop
        while True:
            try:
                # If we haven't completed redirect_and_refresh yet
                if redirect_count < 10 and lead_count < max_captures:
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
    # print("hi")
    main()
    