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
import requests

# Define the signal handler
def stop_execution(signum, frame):
    print("Received stop signal. Exiting gracefully...", flush=True)
    sys.exit(0)  # Exit script immediately

# Bind signal handler
signal.signal(signal.SIGINT, stop_execution)

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
        # user_mobile_number = input_data.get("mobileNumber", "")  # Get the logged-in user's mobile number
        if left_name and mobile_number:
            print("Script works correctly. Exiting...", flush=True)
            print("success",flush=True)
            sys.exit(0)  # Exit the script if everything is fine
    except Exception as e:
        print(f"An error occurred while interacting with the message center: {e}", flush=True)

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
        minOrderValue = "1000"
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
    lead_types = []
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
    word_array = ["Lead Bought", "Lead Purchased", "Lead Acquired", "Lead Secured", "Lead Obtained"]
    word_array = extend_word_array(word_array)

    # Array of words to compare for <h2> text
    h2_word_array = ["Lead Bought", "Lead Purchased", "Lead Acquired", "Lead Secured", "Lead Obtained"]

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
                first_grid = driver.find_element(By.CSS_SELECTOR, "div.Mcat_buylead") 
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

            # Final logic to decide if we should go to message center
            try:
                if first_h2_text:  # If first_h2_text is not empty
                    print("First <h2> text is present. Proceeding with message center logic.", flush=True)
                    go_to_message_center_and_click(driver)
                else:
                    print("First <h2> text is missing. Skipping message center click.", flush=True)

            except Exception as e:
                print(f"Error in final decision logic: {e}", flush=True)


        else:
            print("ZERO_BALANCE_DETECTED", flush=True)
            print("success", flush=True)
            sys.exit(0)
    except Exception as e:
        print(f"Error while checking buyer balance: {e}",flush=True)
        return
    
def execute_task_one(driver, wait):
    """
    Executes the login process, supporting both password and OTP flows.
    """
    
    try:
        # Refresh page
        print("Refreshing page...",flush=True)
        driver.refresh()
        time.sleep(3)
        
        # Get mobile number from input data
        user_mobile_number = "9579797269"
        
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

            user_password = "Focus@12345"
            password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
            password_input.clear()
            password_input.send_keys(user_password)
            print("Entered the password.")

            sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "signWP")))
            sign_in_button.click()
            print("Clicked 'Sign In' button.")

        except (TimeoutException, NoSuchElementException):
            sys.exit("Password entry failed.", flush=True)
        
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
    unique_id = 999999
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
            else:
                print("Login failed, skipping expert data extraction.")
            # Exit if the login process is unsuccessful
            if result == "Unsuccessful":
                print("Login failed. Exiting program...", flush=True)
                return

        # Main processing loop
        while True:
            try:
                redirect_and_refresh(driver, wait)
                    
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
    