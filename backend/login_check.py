from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import sys

def execute_task_one(mobile_number, password):
    """
    Automates the sign-in process on the IndiaMART seller platform using the provided mobile number and password.
    After login, it navigates to the CRM API page and extracts the API key.
    """
    # Set up the browser in headless mode
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--headless")  # Enable headless mode
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")  # Navigate to IndiaMART seller platform
    
    try:
        # Refresh the page first
        driver.refresh()
        time.sleep(3)  # Wait for the page to fully reload
        driver.refresh()
        time.sleep(3)
        # Wait for the input field to be present
        wait = WebDriverWait(driver, 10)
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))

        # Enter the mobile number provided as an argument
        input_field.clear()  # Clear any pre-filled value
        input_field.send_keys(mobile_number)

        # Wait for the "Start Selling" button to be clickable and click it
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()

        # Check if "Enter Password" button appears after clicking the "Start Selling" button
        enter_password_button = wait.until(
            EC.element_to_be_clickable((By.ID, "passwordbtn1"))
        )

        # Click the "Enter Password" button
        enter_password_button.click()

        # Wait for the password input field to appear and enter the password
        password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))

        password_input.clear()  # Clear any pre-filled value
        password_input.send_keys(password)

        # Wait for the "Sign In" button to be clickable and click it
        sign_in_button = wait.until(
            EC.element_to_be_clickable((By.ID, "signWP"))
        )
        sign_in_button.click()

        # Wait for 5 seconds and check if the 'Dashboard' element is present
        time.sleep(5)
        try:
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            # print("Login successful")
            # Navigate to the CRM API page
            driver.get("https://seller.indiamart.com/leadmanager/crmapi?")
            
            # Wait for the page to load completely
            time.sleep(5)  # Wait for the API page to load
            
            # Now, extract the API key
            try:
                api_key_element = wait.until(
                    EC.presence_of_element_located((By.ID, "api_key2_v2"))
                )
                # Extract the API key text
                api_key = api_key_element.text.strip()
                print(api_key)
                return 0  # Success exit code
            except TimeoutException:
                return 0  # Failure exit code
            except NoSuchElementException:
                return 0  # Failure exit code

        except TimeoutException:
            return 1  # Failure exit code
        except NoSuchElementException:
            return 1  # Failure exit code

    except Exception as e:
        return 2  # Error exit code

    finally:
        driver.quit()
    
# Main block to handle command-line arguments
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python selenium_script.py <mobileNumber> <password>")
        sys.exit(3)  # Invalid arguments exit code

    mobile_number = sys.argv[1]
    password = sys.argv[2]
    exit_code = execute_task_one(mobile_number, password)
    sys.exit(exit_code)