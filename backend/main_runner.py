from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from pyvirtualdisplay import Display
from selenium.webdriver.chrome.service import Service
from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys
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
import requests

# Global variables
received_otp = None
otp_event = threading.Event()
stdin_lock = threading.Lock()
skip_lead = False
input_data = {}
lead_bought = ""
lead_count = 0
max_captures = 0
redirect_count = 0
stop_event = None
restart_event = None

def set_reload_events(stop_evt, restart_evt):
    """Function to receive reload events from the debug runner"""
    global stop_event, restart_event
    stop_event = stop_evt
    restart_event = restart_evt
    print("Reload events set successfully", flush=True)

def check_reload_request():
    """Check if a reload has been requested"""
    global stop_event, restart_event
    if stop_event and stop_event.is_set():
        print("Reload requested, stopping current execution...", flush=True)
        return True
    return False

def initialize_input_data():
    """Initialize input data - either from stdin or default values for testing"""
    global input_data, lead_count, max_captures
    
    try:
        # Check if we're running in a terminal with available input
        if sys.stdin.isatty():
            # Running interactively, use default test data
            print("Running in interactive mode, using default test data", flush=True)
            input_data = {
                "mobileNumber": "9579797269",
                "password": "testpassword",
                "leadCount": 0,
                "maxCaptures": 10,
                "sentences": [
                    "Hello! I hope you're having a great day.",
                    "I noticed you're interested in {Requested_product_name}. I'd love to help you with that!",
                    "Could you please share more details about your specific requirements?",
                    "What quantity are you looking for and what's your expected timeline?",
                    "I'm here to provide you with the best solution. Feel free to ask any questions!"
                ],
                "wordArray": ["coupling", "pipe", "fitting", "valve"],
                "h2WordArray": ["exclude1", "exclude2"],
                "selectedStates": ["Karnataka", "Maharashtra"],
                "leadTypes": ["bulk", "business"],
                "minOrder": "10000",
                "uniqueId": "test123"
            }
        else:
            # Try to read from stdin
            if select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], []):
                input_line = sys.stdin.readline()
                if input_line.strip():
                    input_data = json.loads(input_line.strip())
                    print("Input data loaded from stdin", flush=True)
                else:
                    print("Empty input from stdin, using defaults", flush=True)
                    input_data = get_default_input_data()
            else:
                print("No input available from stdin, using defaults", flush=True)
                input_data = get_default_input_data()
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}, using default data", flush=True)
        input_data = get_default_input_data()
    except Exception as e:
        print(f"Error reading input: {e}, using default data", flush=True)
        input_data = get_default_input_data()
    
    # Set global variables
    lead_count = int(input_data.get("leadCount", 0))
    max_captures = int(input_data.get("maxCaptures", 10))
    
    print(f"Initialized with lead_count: {lead_count}, max_captures: {max_captures}", flush=True)

def get_default_input_data():
    """Get default input data for testing"""
    return {
        "mobileNumber": "9876543210",
        "password": "testpassword",
        "leadCount": 0,
        "maxCaptures": 10,
        "sentences": [
            "Hello! I hope you're having a great day.",
            "I noticed you're interested in {Requested_product_name}. I'd love to help you with that!",
            "Could you please share more details about your specific requirements?",
            "What quantity are you looking for and what's your expected timeline?",
            "I'm here to provide you with the best solution. Feel free to ask any questions!"
        ],
        "wordArray": ["coupling", "pipe", "fitting", "valve"],
        "h2WordArray": ["exclude1", "exclude2"],
        "selectedStates": ["Karnataka", "Maharashtra"],
        "leadTypes": ["bulk", "business"],
        "minOrder": "10000",
        "uniqueId": "test123"
    }

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
        if check_reload_request():
            print("OTP listener stopping due to reload request", flush=True)
            break
            
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
    sys.exit(0)

# Bind signal handler
signal.signal(signal.SIGINT, stop_execution)

def parse_timestamp(timestamp_text):
    now = datetime.now()

    if "AM" in timestamp_text or "PM" in timestamp_text:
        dt = datetime.strptime(timestamp_text, "%I:%M %p")
        combined = now.replace(hour=dt.hour, minute=dt.minute, second=0, microsecond=0)
        return combined.isoformat()

    elif timestamp_text.lower() == "yesterday":
        combined = (now - timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
        return combined.isoformat()

    else:
        dt = datetime.strptime(f"{timestamp_text} {now.year}", "%d %b %Y")
        return dt.isoformat()

def send_data_to_sheets(name, mobile, email=None, user_mobile_number=None, timestamp_text=None, address=None, uniqueId=None):
    global lead_bought, skip_lead, redirect_count
    
    if check_reload_request():
        print("Stopping send_data_to_sheets due to reload request", flush=True)
        return
        
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
        "uniqueId": uniqueId
    }
    if email:
        data["email"] = email
    if address:
        data["address"] = address
    print(f"Sending data to dashboard: {data}", flush=True)

    try:
        response = requests.post(url, json=data)
        
        if response.status_code == 409:
            response_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
            if response_data.get('error') == 'DUPLICATE_LEAD_STOP_SCRIPT' or 'script_terminated' in response.text:
                print("Duplicate lead detected.", flush=True)
                skip_lead = True
                redirect_count = 0
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

# [Continue with the rest of your functions - process_messages_incrementally, etc.]
# I'll include just a few key functions to show the pattern, but you would include all of them

def process_messages_incrementally(driver):
    """Simple approach: Process messages as they become available"""
    global lead_bought, skip_lead
    
    if check_reload_request():
        print("Stopping message processing due to reload request", flush=True)
        return 0
        
    print("Starting incremental message processing...", flush=True)
    
    third_url = "https://seller.indiamart.com/messagecentre/"
    thirty_days_ago = datetime.now() - timedelta(days=30)
    processed_messages = 0
    processed_identifiers = set()
    
    # Navigate to message center
    driver.get(third_url)
    time.sleep(5)
    
    # Continue with your existing logic...
    # [Include the rest of your function here]
    
    print(f"Completed processing. Total messages processed: {processed_messages}", flush=True)
    return processed_messages

def main():
    global redirect_count, lead_count, max_captures
    
    # Initialize input data first
    initialize_input_data()
    
    print("Starting IndiaMART automation script...", flush=True)
    
    # Configure Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
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
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    chrome_options.add_argument(f"user-agent={user_agent}")

    # Start virtual display
    display = Display(visible=0, size=(1920, 1080))
    display.start()

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    unique_id = input_data.get("uniqueId", "123456")
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)
    redirect_count = 0
    
    try:
        # Main processing loop with reload checking
        while True:
            if check_reload_request():
                print("Main loop stopping due to reload request", flush=True)
                break
                
            try:
                # Your existing main loop logic here
                print("Checking for Dashboard element...", flush=True)
                
                # Add periodic checks for reload requests in your long-running operations
                time.sleep(1)
                
                if check_reload_request():
                    break
                    
                # Continue with your existing logic...
                
            except Exception as e:
                print(f"Error in main loop: {e}", flush=True)
                if check_reload_request():
                    break
                time.sleep(5)

            print("Loop iteration completed. Continuing...", flush=True)
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("Program manually exited.", flush=True)
    except Exception as e:
        print(f"Unexpected error in main: {e}", flush=True)
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