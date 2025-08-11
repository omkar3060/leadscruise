import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import threading
import select
import signal
import os
import subprocess
from pyvirtualdisplay import Display

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
                            print(f"OTP captured from frontend: {received_otp}",flush=True)
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

def execute_task_one(mobile_number, new_password,unique_id):
    global received_otp
    """
    Automates the sign-in process on the IndiaMART seller platform using the provided mobile number and password.
    After login, it navigates to the CRM API page and extracts the API key.
    Then navigates to privacy settings to extract preferred categories.
    """
    # Initialize result dictionary and password change flag
    result = {}
    password_changed_successfully = False
    
    print(f"Starting automation for mobile number: {mobile_number}", flush=True)
    print(f"Using provided password: {new_password}", flush=True)
    
    # Set up the browser in headless mode
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

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    chrome_options.add_argument(f"user-agent={user_agent}")

    # Start virtual display
    display = Display(visible=0, size=(1920, 1080))
    display.start()

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    wait = WebDriverWait(driver, 10)

    # Start Xvfb in the background
    # unique_id = input_data.get("uniqueId", [])
    # Start Xvfb with dynamic unique_id
    subprocess.Popen(['Xvfb', f':{unique_id}', '-screen', '0', '1920x1080x24'])

    # Set the DISPLAY environment variable
    os.environ['DISPLAY'] = f':{unique_id}'

    print(f"Xvfb started on display :{unique_id}", flush=True)
    
    driver = webdriver.Chrome(options=chrome_options)
    print("Chrome browser initialized", flush=True)
    
    try:
        # print("Navigating to IndiaMART seller platform", flush=True)
        driver.get("https://seller.indiamart.com/")
        
        # Refresh the page first
        print("Refreshing page", flush=True)
        driver.refresh()
        time.sleep(3)
        driver.refresh()
        time.sleep(3)
        
        # Wait for the input field to be present
        print("Waiting for mobile number input field", flush=True)
        wait = WebDriverWait(driver, 10)
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))

        # Enter the mobile number provided as an argument
        print("Entering mobile number", flush=True)
        input_field.clear()
        input_field.send_keys(mobile_number)

        # Wait for the "Start Selling" button to be clickable and click it
        print("Clicking Start Selling button", flush=True)
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()

        try:
            received_otp = None
            otp_event.clear()
            otp_request_button = wait.until(
                 EC.element_to_be_clickable((By.ID, "reqOtpMobBtn"))
             )
            otp_request_button.click()
            print("Clicked 'Request OTP on Mobile' button.",flush=True)
            
            # Signal to backend that OTP request has been initiated
            print("OTP_REQUEST_INITIATED",flush=True)
            print("Login OTP request initiated", flush=True)
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
                            # Try multiple approaches to find and click the submit button
                            otp_submit_button = None
                            
                            # First try by ID
                            try:
                                otp_submit_button = wait.until(EC.element_to_be_clickable((By.ID, "sbmtbtnOtp")))
                            except TimeoutException:
                                print("Submit button not found by ID, trying by value", flush=True)
                                # Try by value attribute
                                try:
                                    otp_submit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@value='Register for free']")))
                                except TimeoutException:
                                    print("Submit button not found by value, trying by class", flush=True)
                                    # Try by class
                                    try:
                                        otp_submit_button = wait.until(EC.element_to_be_clickable((By.CLASS_NAME, "sbmtbtn")))
                                    except TimeoutException:
                                        print("Submit button not found by class, trying any button with text", flush=True)
                                        # Try any button containing the text
                                        try:
                                            otp_submit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@type='button' and contains(@value, 'Register')]")))
                                        except TimeoutException:
                                            print("Could not find any submit button", flush=True)
                                            continue
                            
                            if otp_submit_button:
                                # Try regular click first
                                try:
                                    otp_submit_button.click()
                                    print("Clicked 'Submit OTP' button using regular click.", flush=True)
                                except Exception as e:
                                    print(f"Regular click failed, trying JavaScript click: {e}", flush=True)
                                    # Try JavaScript click
                                    try:
                                        driver.execute_script("arguments[0].click();", otp_submit_button)
                                        print("Clicked 'Submit OTP' button using JavaScript.", flush=True)
                                    except Exception as e2:
                                        print(f"JavaScript click also failed: {e2}", flush=True)
                                        continue
                                
                                time.sleep(3)  # Wait a bit longer for the response

                                # Check if OTP was correct
                                try:
                                    error_elem = driver.find_element(By.ID, "otp_verify_err")
                                    if error_elem.is_displayed() and ("Incorrect OTP" in error_elem.text or "Something went wrong" in error_elem.text):
                                        print("OTP_FAILED_INCORRECT", flush=True)
                                        continue  # Allow another attempt if time allows
                                except NoSuchElementException:
                                    pass  # No error means success, break out of loop
                                break
                            else:
                                print("No submit button found", flush=True)
                                continue
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

        # Wait for the "Sign In" button to be clickable and click it
        # print("Clicking Sign In button", flush=True)
        # sign_in_button = wait.until(
        #     EC.element_to_be_clickable((By.ID, "signWP"))
        # )
        # sign_in_button.click()

        # Wait for 5 seconds and check if the 'Dashboard' element is present
        print("Checking for successful login", flush=True)
        time.sleep(5)
        try:
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Login successful! Dashboard element found", flush=True)

            print("Navigating to company profile page", flush=True)
            driver.get("https://seller.indiamart.com/companyprofile/manageprofile")
            
            # Wait for the page to load
            time.sleep(5)
            
            # Extract company name and mobile numbers
            company_name = ""
            mobile_numbers = []
            
            print("Extracting company name and mobile numbers", flush=True)
            try:
                # Find the company profile card
                profile_card = wait.until(
                    EC.presence_of_element_located((By.CLASS_NAME, "SLC_pr.NCP_vitCard"))
                )
                print("Found company profile card", flush=True)
                
                # Extract company name
                try:
                    company_name_element = profile_card.find_element(By.XPATH, ".//a[contains(@class, 'SLC_c3')]//span[@class='SLC_toe SLC_wsn SLC_ovh SLC_db']")
                    company_name = company_name_element.text.strip()
                    print(f"Company name extracted: {company_name}", flush=True)
                except (NoSuchElementException, TimeoutException):
                    print("Could not extract company name", flush=True)
                
                # Extract mobile numbers
                try:
                    mobile_spans = profile_card.find_elements(By.XPATH, ".//span[@class='SLC_pr']")
                    for span in mobile_spans:
                        mobile_text = span.text.strip()
                        # Check if it's a valid mobile number (10 digits)
                        if mobile_text.isdigit() and len(mobile_text) == 10:
                            mobile_numbers.append(mobile_text)
                            print(f"Mobile number extracted: {mobile_text}", flush=True)
                    
                    print(f"Total mobile numbers found: {len(mobile_numbers)}", flush=True)
                except (NoSuchElementException, TimeoutException):
                    print("Could not extract mobile numbers", flush=True)
                
            except (TimeoutException, NoSuchElementException) as e:
                print(f"Error extracting company profile data: {str(e)}", flush=True)

            print("Navigating to privacy settings page", flush=True)
            driver.get("https://seller.indiamart.com/misc/privacysettings/#tab=locationpreferences")
            
            # Wait for the page to load
            time.sleep(5)
            
            # Extract preferred categories
            preferred_categories = []
            print("Extracting preferred categories", flush=True)
            try:
                # Look for the category preferences section
                category_section = wait.until(
                    EC.presence_of_element_located((By.XPATH, "//span[contains(text(), 'Preferred Categories')]"))
                )
                print("Found category preferences section", flush=True)
                
                # Find and click the accordion arrow to expand the section
                try:
                    accordion_arrow = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Category Preferences')]/following-sibling::span//span[@class='m61_dn_ar']"))
                    )
                    print("Clicking accordion arrow to expand categories", flush=True)
                    accordion_arrow.click()
                    time.sleep(2)  # Wait for the section to expand
                except (TimeoutException, NoSuchElementException):
                    # Try alternative selector for the accordion
                    try:
                        accordion_label = wait.until(
                            EC.element_to_be_clickable((By.XPATH, "//label[.//span[contains(text(), 'Category Preferences')]]"))
                        )
                        print("Clicking accordion label to expand categories", flush=True)
                        accordion_label.click()
                        time.sleep(2)
                    except (TimeoutException, NoSuchElementException):
                        print("Could not find accordion to expand categories", flush=True)
                
                # Find all list items in the "Based on your products" section
                category_items = driver.find_elements(By.XPATH, "//p[contains(text(), 'Based on your products')]/following-sibling::div//ul//li")
                
                for item in category_items:
                    category_text = item.text.strip()
                    if category_text:  # Only add non-empty categories
                        preferred_categories.append(category_text)
                        print(f"Found category: {category_text}", flush=True)
                
                print(f"Total categories found: {len(preferred_categories)}", flush=True)
                
            except (TimeoutException, NoSuchElementException) as e:
                print(f"Error extracting categories: {str(e)}", flush=True)
                # Don't fail the whole process if categories can't be extracted
                preferred_categories = []
            
            message_templates = []
            if company_name and mobile_numbers:
                
                # Template 2: Formatted template
                mobile_contact = mobile_numbers[0]
                if len(mobile_numbers) > 1:
                    mobile_contact += f" and {mobile_numbers[1]}"
                
                message1 = f"Thanks for showing interest in {{Requested_product_name}}."
                message2=f"Kindly contact on {mobile_contact} for more details, pricing and availability."
                message3=f"Please rate us and leave your review on IndiaMart."
                message4="Thank you."
                message5=f"Regards, {company_name}."
                message_templates.append(message1)
                message_templates.append(message2)
                message_templates.append(message3)
                message_templates.append(message4)
                message_templates.append(message5)
            
            # Navigate to account settings page for password change
            print("Navigating to account settings page", flush=True)
            driver.get("https://seller.indiamart.com/misc/privacysettings/")
            
            # Wait for the page to load
            time.sleep(5)
            
            # Click on Account Settings tab
            try:
                account_settings_tab = wait.until(
                    EC.element_to_be_clickable((By.XPATH, "//a[@href='/misc/privacysettings/#tab=accountsettings']"))
                )
                account_settings_tab.click()
                print("Clicked on Account Settings tab", flush=True)
                time.sleep(3)  # Wait for tab content to load
            except Exception as e:
                print(f"Failed to click Account Settings tab: {e}", flush=True)
            
            # driver.save_screenshot("account_settings_page.png")

            # Check if password change form is present
            try:
                password_form = wait.until(
                    EC.presence_of_element_located((By.CLASS_NAME, "ch-pwd"))
                )
                print("Password change form found", flush=True)
                
                # Use the password provided from Node.js backend
                print(f"Using provided password: {new_password}", flush=True)
                
                # Find and fill the new password field
                new_pass_input = wait.until(
                    EC.presence_of_element_located((By.ID, "new_pass"))
                )
                new_pass_input.clear()
                new_pass_input.send_keys(new_password)
                print("Entered new password", flush=True)
                
                # Find and fill the confirm password field
                conf_pass_input = wait.until(
                    EC.presence_of_element_located((By.ID, "conf_pass"))
                )
                conf_pass_input.clear()
                conf_pass_input.send_keys(new_password)
                print("Entered confirm password", flush=True)
                
                # Click on "Request OTP on Mobile" button
                request_otp_button = wait.until(
                    EC.element_to_be_clickable((By.ID, "CPRequestOTPmobile"))
                )
                request_otp_button.click()
                print("Clicked 'Request OTP on Mobile' button", flush=True)
                # driver.save_screenshot("otp_request_button.png")
                # Signal to backend that password change OTP request has been initiated
                print("PASSWORD_OTP_REQUEST_INITIATED", flush=True)
                print("Password change OTP request initiated", flush=True)
                # driver.save_screenshot("otp_request_button_after.png")
                # sys.stdout.flush()
                
                # Wait for OTP input fields to appear
                time.sleep(3)
                
                # Check if OTP input section is visible
                try:
                    otp_section = wait.until(
                        EC.presence_of_element_located((By.ID, "otpDtl_new"))
                    )
                    
                    if otp_section.is_displayed():
                        print("OTP input section is visible", flush=True)
                        
                        # Reset OTP variables for password change
                        received_otp = None
                        otp_event.clear()
                        
                        # Start OTP listener thread for password change
                        otp_thread = threading.Thread(target=listen_for_otp, daemon=True)
                        otp_thread.start()
                        start_time = time.time()
                        print("Waiting for OTP input for password change...", flush=True)
                        
                        while time.time() - start_time < 60:
                            if otp_event.wait(timeout=5):
                                otp_event.clear()
                                
                                if received_otp and len(received_otp) == 4 and received_otp.isdigit():
                                    # Enter OTP in the password change form
                                    otp_fields = ["firstt", "secondd", "thirdd", "fourth_numm"]
                                    for i, field_id in enumerate(otp_fields):
                                        try:
                                            otp_input = wait.until(EC.presence_of_element_located((By.ID, field_id)))
                                            otp_input.clear()
                                            otp_input.send_keys(received_otp[i])
                                        except (TimeoutException, NoSuchElementException):
                                            print(f"Could not find OTP field: {field_id}", flush=True)
                                            break
                                    
                                    print("Entered OTP for password change", flush=True)
                                    
                                    # Click submit button
                                    try:
                                        submit_button = wait.until(EC.element_to_be_clickable((By.ID, "start")))
                                        submit_button.click()
                                        print("Clicked submit button for password change", flush=True)
                                        time.sleep(3)
                                        password_changed_successfully = True
                                        driver.save_screenshot("otp_request_button_after.png")
                                        # Check for success message
                                        try:
                                            success_div = wait.until(EC.visibility_of_element_located((By.ID, "div_succ")))
                                            print("Password changed successfully in popup!", flush=True)
                                            # Add password to result
                                            # result["newPassword"] = new_password
                                            password_changed_successfully = True
                                        except TimeoutException:
                                            print("Password change may have failed - success message not found", flush=True)
                                        
                                        break
                                    except Exception as e:
                                        print(f"Failed to submit password change: {e}", flush=True)
                                        continue
                                else:
                                    print("Invalid OTP format received for password change", flush=True)
                            else:
                                print("Still waiting for OTP for password change...", flush=True)
                        
                        if time.time() - start_time >= 60:
                            print("Timeout waiting for OTP for password change", flush=True)
                    else:
                        print("OTP input section is not visible", flush=True)
                        
                except (TimeoutException, NoSuchElementException) as e:
                    print(f"OTP section not found for password change: {e}", flush=True)
                    
            except (TimeoutException, NoSuchElementException) as e:
                # print(f"Password change form not found: {e}", flush=True)
                print("Trying alternative approach with toggle button", flush=True)
                
                # Try the alternative approach with toggle button
                try: 
                    try:
                        wait.until(EC.presence_of_element_located(
                            (By.XPATH, "//h3[contains(., 'Allow login through Password')]")
                        ))
                        print("Toggle section found", flush=True)

                        # Try to click on label instead of input
                        toggle_label = wait.until(EC.element_to_be_clickable(
                            (By.XPATH, "//h3[contains(., 'Allow login through Password')]/span/label[@for='153']")
                        ))
                        driver.execute_script("arguments[0].scrollIntoView(true);", toggle_label)
                        toggle_label.click()
                        print("Clicked on toggle label using JS", flush=True)
                        time.sleep(2)

                    except Exception as e:
                        # driver.save_screenshot("toggle_fail_debug.png")
                        print(f"Alternative password change approach also failed: {type(e).__name__}: {e}", flush=True)

                    time.sleep(2)  # Wait for popup to open
                    
                    # Now look for the password input fields in the popup
                    new_pass_input = wait.until(
                        EC.presence_of_element_located((By.ID, "new_pass"))
                    )
                    new_pass_input.clear()
                    new_pass_input.send_keys(new_password)
                    print("Entered new password in popup", flush=True)
                    
                    conf_pass_input = wait.until(
                        EC.presence_of_element_located((By.ID, "conf_pass"))
                    )
                    conf_pass_input.clear()
                    conf_pass_input.send_keys(new_password)
                    print("Entered confirm password in popup", flush=True)
                    
                    # Click on "Request OTP On Mobile" button in the popup
                    request_otp_button = wait.until(
                        EC.element_to_be_clickable((By.ID, "CPRequestOTPmobile"))
                    )
                    request_otp_button.click()
                    print("Clicked 'Request OTP On Mobile' button in popup", flush=True)
                    
                    # Signal to backend that password change OTP request has been initiated
                    print("PASSWORD_OTP_REQUEST_INITIATED", flush=True)
                    print("Password change OTP request initiated (popup)", flush=True)
                    # sys.stdout.flush()
                    
                    # Wait for OTP input fields to appear
                    time.sleep(3)
                    
                    # Check if OTP input section is visible
                    try:
                        otp_section = wait.until(
                            EC.presence_of_element_located((By.ID, "otpDtl_new"))
                        )
                        
                        if otp_section.is_displayed():
                            print("OTP input section is visible in popup", flush=True)
                            
                            # Reset OTP variables for password change
                            received_otp = None
                            otp_event.clear()
                            
                            # Start OTP listener thread for password change
                            otp_thread = threading.Thread(target=listen_for_otp, daemon=True)
                            otp_thread.start()
                            start_time = time.time()
                            print("Waiting for OTP input for password change in popup...", flush=True)
                            
                            while time.time() - start_time < 60:
                                if otp_event.wait(timeout=5):
                                    otp_event.clear()
                                    
                                    if received_otp and len(received_otp) == 4 and received_otp.isdigit():
                                        # Enter OTP in the password change form
                                        otp_fields = ["firstt", "secondd", "thirdd", "fourth_numm"]
                                        for i, field_id in enumerate(otp_fields):
                                            try:
                                                otp_input = wait.until(EC.presence_of_element_located((By.ID, field_id)))
                                                otp_input.clear()
                                                otp_input.send_keys(received_otp[i])
                                            except (TimeoutException, NoSuchElementException):
                                                print(f"Could not find OTP field: {field_id}", flush=True)
                                                break
                                        
                                        print("Entered OTP for password change in popup", flush=True)
                                        
                                        # Click submit button
                                        try:
                                            submit_button = wait.until(EC.element_to_be_clickable((By.ID, "start")))
                                            submit_button.click()
                                            print("Clicked submit button for password change in popup", flush=True)
                                            time.sleep(3)
                                            password_changed_successfully = True
                                            driver.save_screenshot("otp_request_button_after.png")
                                            break
                                        except Exception as e:
                                            print(f"Failed to submit password change in popup: {e}", flush=True)
                                            continue
                                    else:
                                        print("Invalid OTP format received for password change in popup", flush=True)
                                else:
                                    print("Still waiting for OTP for password change in popup...", flush=True)
                            
                            if time.time() - start_time >= 60:
                                print("Timeout waiting for OTP for password change in popup", flush=True)
                        else:
                            print("OTP input section is not visible in popup", flush=True)
                            
                    except (TimeoutException, NoSuchElementException) as e:
                        print(f"OTP section not found for password change in popup: {e}", flush=True)
                        
                except (TimeoutException, NoSuchElementException) as e:
                    print(f"Alternative password change approach also failed: {e}", flush=True)
            
            # Create result dictionary
            result = {
                "companyName": company_name,
                "mobileNumbers": mobile_numbers,
                "preferredCategories": preferred_categories,
                "messageTemplates": message_templates
            }
            
            # Check if password change was successful and add newPassword to result
            if password_changed_successfully:
                result["newPassword"] = new_password
                print(f"Adding newPassword to result: {new_password}", flush=True)
            
            # Print a separator and then the result as JSON for Node.js to parse
            print("===RESULT_START===", flush=True)
            print(json.dumps(result), flush=True)
            print("===RESULT_END===", flush=True)
            return 0  # Success exit code

        except TimeoutException:
            print("Error: Login failed - Dashboard element not found (timeout)", flush=True)
            # driver.save_screenshot("login_fail_debug.png")
            return 1
        except NoSuchElementException:
            print("Error: Login failed - Dashboard element not found", flush=True)
            # driver.save_screenshot("login_fail_debug.png")
            return 1

    except Exception as e:
        print(f"Unexpected error occurred: {str(e)}", flush=True)
        return 2

    finally:
        print("Closing browser", flush=True)
        driver.quit()

# Main block to handle command-line arguments
if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python selenium_script.py <mobileNumber> <newPassword> <uniqueId>", flush=True)
        sys.exit(3)

    mobile_number = sys.argv[1]
    new_password = sys.argv[2]
    unique_id = sys.argv[3]
    print(f"Arguments received - Mobile: {mobile_number}, Password: {new_password}, Unique ID: {unique_id}", flush=True)

    exit_code = execute_task_one(mobile_number, new_password, unique_id)
    print(f"Script completed with exit code: {exit_code}", flush=True)
    sys.exit(exit_code)