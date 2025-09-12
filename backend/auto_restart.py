import time, os, importlib
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import scraper
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
import requests
def stop_execution(signum, frame):
    print("Received stop signal. Exiting gracefully...", flush=True)
    sys.exit(0)
received_otp = None
otp_event = threading.Event()
stdin_lock = threading.Lock()
skip_lead = False  # Global variable to skip lead if duplicate detected
signal.signal(signal.SIGINT, stop_execution)

input_line = sys.stdin.readline()
input_data = json.loads(input_line.strip())
lead_count = int(input_data.get("leadCount", 0))
max_captures = int(input_data.get("maxCaptures", 0))

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
            # Check if table exists with the correct selector based on the HTML structure
            table_selector = '#Enquiries_reportTableCSS__34_qU'
            
            tables_exist = driver.execute_script(f"""
                return document.querySelector('{table_selector}') !== null;
            """)
            
            if tables_exist:
                print(f"Found table with selector: {table_selector}", flush=True)
                
                # Extract category data (default view - Top Categories tab is active)
                category_data = driver.execute_script("""
                    const table = document.querySelector('#Enquiries_reportTableCSS__34_qU');
                    const rows = Array.from(table.querySelectorAll('tbody tr'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('td'));
                        return {
                            category: cells[0]?.textContent?.trim() || '',
                            leadsConsumed: parseInt(cells[1]?.textContent?.trim() || '0'),
                            enquiries: parseInt(cells[2]?.textContent?.trim() || '0'),
                            calls: parseInt(cells[3]?.textContent?.trim() || '0')
                        };
                    });
                """)
                print(f"Extracted {len(category_data)} category records", flush=True)
                
                # Check if there are location/category tabs to switch between
                try:
                    # Look for the specific location tab using the correct selector
                    location_tab = driver.find_element(By.CSS_SELECTOR, "#locations")
                    if location_tab:
                        print("Found location tab, switching to extract location data...", flush=True)
                        location_tab.click()
                        time.sleep(3)  # Wait for table to update
                        
                        # Extract location data
                        location_data = driver.execute_script("""
                            const table = document.querySelector('#Enquiries_reportTableCSS__34_qU');
                            const rows = Array.from(table.querySelectorAll('tbody tr'));
                            return rows.map(row => {
                                const cells = Array.from(row.querySelectorAll('td'));
                                return {
                                    location: cells[0]?.textContent?.trim() || '',
                                    leadsConsumed: parseInt(cells[1]?.textContent?.trim() || '0'),
                                    enquiries: parseInt(cells[2]?.textContent?.trim() || '0'),
                                    calls: parseInt(cells[3]?.textContent?.trim() || '0')
                                };
                            });
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
    unique_id = "123456"
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)

    # Start Selenium browser once
    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://www.python.org/")  # just an example site

    # Track last modification time of scraper.py
    last_mtime = os.path.getmtime("scraper.py")

    while True:
        try:
            # Check if scraper.py was modified
            new_mtime = os.path.getmtime("scraper.py")
            if new_mtime != last_mtime:
                importlib.reload(scraper)
                print("🔄 Reloaded scraper.py", flush=True)
                last_mtime = new_mtime

            # Run scraper function
            scraper.main(driver)

        except Exception as e:
            print("❌ Error:", e, flush=True)

        time.sleep(5)  # run every 5 seconds

if __name__ == "__main__":
    main()