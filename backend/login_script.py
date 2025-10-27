from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from pyvirtualdisplay import Display
from selenium.webdriver.common.keys import Keys
import os
import time
import subprocess
import sys
import json
import signal
import threading
import select
import pickle
import requests
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Global variables
received_otp = None
otp_event = threading.Event()
stdin_lock = threading.Lock()
worker_process = None

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
    
    print("Starting OTP listener thread...", flush=True)
    sys.stdout.flush()
    
    while not otp_event.is_set():
        try:
            if select.select([sys.stdin], [], [], 0.5) == ([sys.stdin], [], []):
                with stdin_lock:
                    line = sys.stdin.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    
                    try:
                        data = json.loads(line.strip())
                        print(f"Received data in OTP thread: {data}", flush=True)
                        sys.stdout.flush()
                        
                        if data.get("type") == "OTP_RESPONSE":
                            received_otp = data.get("otp")
                            print(f"OTP captured: {received_otp}", flush=True)
                            sys.stdout.flush()
                            otp_event.set()
                            return
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error in OTP thread: {e}", flush=True)
                        sys.stdout.flush()
                        continue
            else:
                time.sleep(0.1)
                
        except Exception as e:
            print(f"Error in OTP listener: {e}", flush=True)
            sys.stdout.flush()
            time.sleep(0.1)
    
    print("OTP listener thread exiting...", flush=True)
    sys.stdout.flush()

def stop_execution(signum, frame):
    """Handle stop signal"""
    global worker_process
    print("Received stop signal. Exiting gracefully...", flush=True)
    if worker_process:
        worker_process.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, stop_execution)

def execute_login(driver, wait, input_data):
    """Execute the login process"""
    global received_otp, otp_event
    
    try:
        print("Refreshing page...", flush=True)
        driver.refresh()
        time.sleep(3)
        
        user_mobile_number = input_data.get("mobileNumber", "")
        
        # Enter mobile number
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))
        input_field.clear()
        input_field.send_keys(user_mobile_number)
        print(f"Entered mobile number {user_mobile_number}.", flush=True)
        
        # Click 'Start Selling'
        start_selling_button = wait.until(EC.element_to_be_clickable((By.CLASS_NAME, "login_btn")))
        start_selling_button.click()
        print("Clicked 'Start Selling' button.", flush=True)

        try:
            received_otp = None
            otp_event.clear()
            otp_request_button = wait.until(EC.element_to_be_clickable((By.ID, "reqOtpMobBtn")))
            otp_request_button.click()
            print("Clicked 'Request OTP on Mobile' button.", flush=True)
            
            print("OTP_REQUEST_INITIATED", flush=True)
            sys.stdout.flush()
            
            otp_thread = threading.Thread(target=listen_for_otp, daemon=True)
            otp_thread.start()
            start_time = time.time()
            print("Waiting for OTP input...", flush=True)

            while time.time() - start_time < 90:
                if otp_event.wait(timeout=5):
                    otp_event.clear()

                    if received_otp and len(received_otp) == 4 and received_otp.isdigit():
                        otp_fields = ["first", "second", "third", "fourth_num"]
                        for i, field_id in enumerate(otp_fields):
                            try:
                                otp_input = wait.until(EC.presence_of_element_located((By.ID, field_id)))
                                otp_input.clear()
                                otp_input.send_keys(received_otp[i])
                            except (TimeoutException, NoSuchElementException):
                                print(f"Could not find OTP field: {field_id}", flush=True)
                                return False

                        print("Entered OTP successfully.", flush=True)

                        try:
                            otp_submit_button = wait.until(EC.element_to_be_clickable((By.ID, "sbmtbtnOtp")))
                            otp_submit_button.click()
                            print("Clicked 'Submit OTP' button.", flush=True)
                            time.sleep(2)

                            try:
                                error_elem = driver.find_element(By.ID, "otp_verify_err")
                                if error_elem.is_displayed() and "Incorrect OTP" in error_elem.text:
                                    print("OTP_FAILED_INCORRECT", flush=True)
                                    continue
                            except NoSuchElementException:
                                pass
                            break
                        except Exception as e:
                            print(f"Failed to click OTP submit button: {e}", flush=True)
                            continue
                    else:
                        print("Invalid OTP format received.", flush=True)
                else:
                    print("Still waiting for OTP...", flush=True)

            if time.time() - start_time >= 90:
                print("Timeout waiting for correct OTP.", flush=True)
                return False
                        
        except (TimeoutException, NoSuchElementException) as e:
            print(f"OTP flow failed: {e}", flush=True)
            return False
        
        # Check for successful login
        time.sleep(5)
        try:
            dashboard_element = wait.until(EC.presence_of_element_located((By.ID, "leftnav_dash_link")))
            print("Sign in successful. 'Dashboard' element found.", flush=True)
            return True
        except TimeoutException:
            print("Dashboard element not found after login. Sign in may have failed.", flush=True)
            return False
            
    except Exception as e:
        print(f"An error occurred during login: {e}", flush=True)
        return False

def save_session(driver, unique_id):
    """Save the browser session to a file"""
    try:
        session_file = f"session_{unique_id}.pkl"
        session_data = {
            'cookies': driver.get_cookies(),
            'current_url': driver.current_url
        }
        with open(session_file, 'wb') as f:
            pickle.dump(session_data, f)
        print(f"Session saved to {session_file}", flush=True)
        return session_file
    except Exception as e:
        print(f"Error saving session: {e}", flush=True)
        return None

def monitor_worker():
    """Monitor the worker script and restart it if it crashes"""
    global worker_process
    
    while True:
        if worker_process and worker_process.poll() is not None:
            print("Worker process ended. Restarting...", flush=True)
            start_worker()
        time.sleep(5)

def start_worker():
    """Start the worker script as a subprocess"""
    global worker_process
    
    try:
        unique_id = input_data.get("uniqueId", "")
        session_file = f"session_{unique_id}.pkl"
        
        if not os.path.exists(session_file):
            print("Session file not found, cannot start worker", flush=True)
            return
        
        # Pass the session file and input data to worker
        worker_input = json.dumps({
            "session_file": session_file,
            "input_data": input_data
        })
        
        worker_process = subprocess.Popen(
            ["python3", "-u", "worker_script.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Send input data to worker
        worker_process.stdin.write(worker_input + "\n")
        worker_process.stdin.flush()
        
        print("Worker process started", flush=True)
        
        # Forward worker output to main stdout
        def forward_output(pipe, prefix):
            for line in iter(pipe.readline, ''):
                if line:
                    print(f"{prefix}: {line.strip()}", flush=True)
        
        threading.Thread(target=forward_output, args=(worker_process.stdout, "WORKER"), daemon=True).start()
        threading.Thread(target=forward_output, args=(worker_process.stderr, "WORKER_ERR"), daemon=True).start()
        
    except Exception as e:
        print(f"Error starting worker: {e}", flush=True)

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

def extract_all_products(driver):
    """Extract all product listings HTML content"""
    print("Extracting all product listings...", flush=True)
    
    html_content = ""
    try:
        # Wait for the product list to load
        wait = WebDriverWait(driver, 20)
        product_list = wait.until(
            EC.presence_of_element_located((By.ID, "product_lists"))
        )
        print("Found product list container", flush=True)
        
        # Count products before and after scrolling
        initial_count = count_products(driver)
        print(f"Initial product count: {initial_count}", flush=True)
        
        # Scroll to load all products
        scroll_and_load_products(driver, max_scrolls=20)
        
        # Count products after scrolling
        final_count = count_products(driver)
        print(f"Final product count: {final_count}", flush=True)
        
        # Get the entire HTML content of the ul element
        html_content = product_list.get_attribute("outerHTML")
        print(f"Extracted HTML content ({len(html_content)} characters)", flush=True)
        
        return html_content, final_count
        
    except (TimeoutException, NoSuchElementException) as e:
        print(f"Error finding product list: {str(e)}", flush=True)
        return "", 0

def save_html_content(html_content, unique_id):
    """Save HTML content to file"""
    try:
        # Create proper filename with unique_id
        filename = f"json_lister_{unique_id}.txt"
        file_path = os.path.join(os.getcwd(), filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"HTML content saved to {file_path}", flush=True)
        print(f"File size: {len(html_content)} characters", flush=True)
        
        return file_path
    except Exception as e:
        print(f"Error saving HTML file: {str(e)}", flush=True)
        return None
     
def scroll_and_load_products(driver, max_scrolls=10):
    """Scroll down to load all products dynamically"""
    print("Starting to scroll and load products...", flush=True)
    
    last_height = driver.execute_script("return document.body.scrollHeight")
    scroll_count = 0
    
    while scroll_count < max_scrolls:
        # Scroll down to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        
        # Wait for new content to load
        time.sleep(3)
        
        # Calculate new scroll height and compare with last scroll height
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        print(f"Scroll {scroll_count + 1}: Height changed from {last_height} to {new_height}", flush=True)
        
        # Check if we've reached the bottom (no new content loaded)
        if new_height == last_height:
            print("No more content to load, stopping scroll", flush=True)
            break
            
        last_height = new_height
        scroll_count += 1
    
    print(f"Completed scrolling after {scroll_count + 1} attempts", flush=True)

def count_products(driver):
    """Count the number of product listings"""
    try:
        products = driver.find_elements(By.CLASS_NAME, "listElement")
        return len(products)
    except:
        return 0

def main():
    global worker_process
    
    # Read input data
    input_line = sys.stdin.readline()
    global input_data
    input_data = json.loads(input_line.strip())
    
    # Configure Chrome
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-popup-blocking")
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

    unique_id = input_data.get("uniqueId", "")
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)
    
    try:
        # Check if already logged in
        try:
            dashboard_element = wait.until(EC.presence_of_element_located((By.ID, "leftnav_dash_link")))
            print("Already logged in - Dashboard found.", flush=True)
            logged_in = True
        except:
            print("Not logged in. Executing login process...", flush=True)
            logged_in = execute_login(driver, wait, input_data)
            user_mobile_number = input_data.get("mobileNumber", "")
            user_password = input_data.get("password", "")
            if logged_in:
                analytics_success = fetch_analytics_data(driver, user_mobile_number, user_password)
                if analytics_success:
                    print("Analytics data fetched and stored successfully!", flush=True)
                else:
                    print("Failed to fetch analytics data, continuing with main process...", flush=True)

                time.sleep(2)
                driver.get("https://seller.indiamart.com/product/manageproducts/")

                # Wait for the page to load
                time.sleep(10)

                # Extract the entire HTML content of the product list
                print("Extracting product list HTML content", flush=True)

                        # Extract all products with scrolling
                html_content, product_count = extract_all_products(driver)
                
                if html_content:
                    # Save the complete HTML content
                    file_path = save_html_content(html_content, unique_id)
                    
                    # Create a summary file
                    print(f"Successfully scraped {product_count} products", flush=True)
                else:
                    print("Failed to extract product data", flush=True)
                # Execute the JSON creator script
                print("Executing JSON creator script", flush=True)
                try:
                    
                    # Execute the json_creator.py script
                    json_creator_path = "json_creator.py"

                    if os.path.exists(json_creator_path):
                        res = subprocess.run(
                        [sys.executable, json_creator_path, unique_id], 
                        capture_output=True, 
                        text=True, 
                        cwd=os.getcwd())
                        if res.returncode == 0:
                            print("JSON creator script executed successfully", flush=True)
                            print("Output:", res.stdout, flush=True)
                        else:
                            print(f"JSON creator script failed with return code {res.returncode}", flush=True)
                            print("Error:", res.stderr, flush=True)
                    else:
                        print(f"JSON creator script not found at {json_creator_path}", flush=True)
                        print("Please create the JSON creator script to process the HTML content", flush=True)
                    
                except Exception as e:
                    print(f"Error executing JSON creator script: {str(e)}", flush=True)

                print("HTML content extraction and processing completed", flush=True)
        
        if not logged_in:
            print("Login failed. Exiting...", flush=True)
            return
        
        # Save session after successful login
        session_file = save_session(driver, unique_id)
        if not session_file:
            print("Failed to save session. Exiting...", flush=True)
            return
        
        # Start worker process
        start_worker()
        
        # Start worker monitor thread
        monitor_thread = threading.Thread(target=monitor_worker, daemon=True)
        monitor_thread.start()
        
        # Keep the login script running and maintain session
        print("Login script running. Monitoring worker...", flush=True)
        while True:
            # Check if session is still valid
            try:
                driver.execute_script("return document.readyState")
                time.sleep(30)  # Check every 30 seconds
            except:
                print("Session lost. Attempting to re-login...", flush=True)
                logged_in = execute_login(driver, wait, input_data)
                if logged_in:
                    save_session(driver, unique_id)
                else:
                    print("Re-login failed. Exiting...", flush=True)
                    break
                    
    except KeyboardInterrupt:
        print("\nLogin script manually exited.", flush=True)
    except Exception as e:
        print(f"\nUnexpected error in login script: {e}", flush=True)
    finally:
        if worker_process:
            worker_process.terminate()
        try:
            driver.quit()
            display.stop()
        except:
            pass

if __name__ == "__main__":
    main()