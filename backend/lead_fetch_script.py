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

input_line = sys.stdin.readline()
input_data = json.loads(input_line.strip())
import requests
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
    time.sleep(5)

    # Hide tooltip if needed
    try:
        driver.execute_script("""
            const tooltip = document.querySelector('.Headertooltip');
            if (tooltip) tooltip.style.display = 'none';
        """)
    except Exception:
        pass

    messages = driver.find_elements(By.XPATH, "//div[@class='por lftcntctnew pl25 fl pd10 w100 hgt105 cp']")

    print(f"Found {len(messages)} messages. Checking timestamps...", flush=True)
    thirty_days_ago = datetime.now() - timedelta(days=30)

    for index, msg in enumerate(messages):
        try:
            time_element = msg.find_element(By.XPATH, ".//div[contains(@class, 'fr')]/span[contains(@class, 'fs12')]")
            timestamp_text = time_element.text.strip()

            if not is_within_30_days(timestamp_text, thirty_days_ago):
                continue  # Skip if older than 30 days

            driver.execute_script("arguments[0].scrollIntoView(true);", msg)
            msg.click()
            print(f"Clicked message #{index+1} with timestamp: {timestamp_text}", flush=True)
            time.sleep(2)

            # Click 'View More'
            try:
                view_more_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'View More')]"))
                )
                view_more_button.click()
                time.sleep(2)
            except:
                print("View More button not found or not clickable.")

            # Extract contact details
            left_name = driver.find_element(By.XPATH, "//div[@id='left-name']").text
            mobile_number = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 mt2 wbba']").text
            try:
                email_id = driver.find_element(By.XPATH, "//span[@class='fl mxwdt75 ml5 wbba']").text
            except NoSuchElementException:
                email_id = None

            user_mobile_number = input_data.get("mobileNumber", "")
            send_data_to_dashboard(left_name, mobile_number, email_id, user_mobile_number)
        except Exception as e:
            print(f"Error with message #{index+1}: {e}", flush=True)

def is_within_30_days(timestamp_text, thirty_days_ago):
    try:
        if "AM" in timestamp_text or "PM" in timestamp_text:
            return True  # Assume today
        elif timestamp_text.lower() == "yesterday":
            return True
        else:
            # e.g., "28 May"
            timestamp_date = datetime.strptime(f"{timestamp_text} {datetime.now().year}", "%d %b %Y")
            return timestamp_date >= thirty_days_ago
    except:
        return False

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
            go_to_message_center_and_click(driver)
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
                go_to_message_center_and_click(driver)
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
    