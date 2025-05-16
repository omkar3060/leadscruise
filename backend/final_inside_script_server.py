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

# Define the signal handler
def stop_execution(signum, frame):
    print("Received stop signal. Exiting gracefully...", flush=True)
    sys.exit(0)  # Exit script immediately

# Bind signal handler
signal.signal(signal.SIGINT, stop_execution)

input_data = json.loads(sys.stdin.read())
import requests
lead_bought=""
def send_data_to_dashboard(name, mobile, email=None, user_mobile_number=None):
    global lead_bought  # Access the global variable
    
    url = "http://localhost:5000/api/store-lead"
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

        message_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//div[@class='lh150 pdb10 mxhgt125 m240130 edt_div edit_div_new fs15 overfw_yauto prewrap ' and @contenteditable='true']"))
        )

        sentences = input_data.get("sentences", [])

        for sentence in sentences:
            message_input.click()
            message_input.clear()
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
        min_input.send_keys("1000")
        time.sleep(1)

        # Press enter to trigger filtering (assuming that's the intended trigger)
        min_input.send_keys(Keys.ENTER)
        print("Entered custom minimum value and submitted.")
        time.sleep(5)

    except Exception as e:
        print(f"Error while entering custom order value: {e}")
        driver.save_screenshot("order_value_error.png")
        print("Screenshot saved as order_value_error.png")
    
    
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
                
                india_label = driver.find_element(By.XPATH, "//label[contains(text(), 'India')]")
                india_label.click()
                print("Clicked the 'India' label.",flush=True)
                
                time.sleep(5)
                
            except Exception as e:
                print(f"Failed to click the 'India' label: {e}",flush=True)
                driver.save_screenshot("screenshot_after_login.png")
                print("Screenshot saved as screenshot_after_login.png",flush=True)

            enter_custom_order_value(driver)

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

            # Get the first <strong> tag with the text 'mins ago', 'secs ago', or 'hrs ago'
            time_result = False
            try:
                time.sleep(3)  # Static wait
                time_element = driver.find_element(By.XPATH, "//strong[contains(text(), 'mins ago') or contains(text(), 'secs ago') or contains(text(), 'hrs ago')]")
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
    Executes the login process:
    1. Prompts the user for mobile number and password.
    2. Enters credentials, clicks the buttons to log in.
    3. Checks if the 'Dashboard' element is present after login.
    """
    try:
        # Refresh the page first
        print("Refreshing page...",flush=True)
        driver.refresh()
        time.sleep(3)

        # Prompt the user for the mobile number
        user_mobile_number = input_data.get("mobileNumber", "")

        # Wait for the input field to be present
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))

        # Enter the mobile number
        input_field.clear()
        input_field.send_keys(user_mobile_number)
        print(f"Entered mobile number {user_mobile_number}.",flush=True)

        # Wait for the "Start Selling" button to be clickable and click it
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()
        print("Clicked 'Start Selling' button.",flush=True)

        # Wait for the "Enter Password" button to be clickable and click it
        enter_password_button = wait.until(
            EC.element_to_be_clickable((By.ID, "passwordbtn1"))
        )
        enter_password_button.click()
        print("Clicked 'Enter Password' button.",flush=True)

        # Prompt the user for the password
        user_password = input_data.get("password", "")

        # Wait for the password input field and enter the password
        password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
        password_input.clear()
        password_input.send_keys(user_password)
        print("Entered the password.",flush=True)

        # Wait for the "Sign In" button to be clickable and click it
        sign_in_button = wait.until(
            EC.element_to_be_clickable((By.ID, "signWP"))
        )
        sign_in_button.click()
        print("Clicked 'Sign In' button.",flush=True)

        # Wait for 5 seconds and check if the 'Dashboard' element is present
        time.sleep(5)
        try:
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Sign in successful. 'Dashboard' element found.",flush=True)
            return "Success"
        except:
            print("Dashboard element not found after login. Sign in failed.",flush=True)
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
    unique_id=input_data.get("uniqueId", [])
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
            redirect_and_refresh(driver, wait)
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
                redirect_and_refresh(driver, wait)
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
    