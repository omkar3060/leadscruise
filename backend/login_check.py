import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def execute_task_one(mobile_number, password):
    """
    Automates the sign-in process on the IndiaMART seller platform using the provided mobile number and password.
    After login, it navigates to the CRM API page and extracts the API key.
    Then navigates to privacy settings to extract preferred categories.
    """
    print(f"Starting automation for mobile number: {mobile_number}", flush=True)
    
    # Set up the browser in headless mode
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--headless")  # Enable headless mode
    
    driver = webdriver.Chrome(options=chrome_options)
    print("Chrome browser initialized", flush=True)
    
    try:
        print("Navigating to IndiaMART seller platform", flush=True)
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

        # Check if "Enter Password" button appears after clicking the "Start Selling" button
        print("Waiting for Enter Password button", flush=True)
        enter_password_button = wait.until(
            EC.element_to_be_clickable((By.ID, "passwordbtn1"))
        )

        # Click the "Enter Password" button
        print("Clicking Enter Password button", flush=True)
        enter_password_button.click()

        # Wait for the password input field to appear and enter the password
        print("Entering password", flush=True)
        password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
        password_input.clear()
        password_input.send_keys(password)

        # Wait for the "Sign In" button to be clickable and click it
        print("Clicking Sign In button", flush=True)
        sign_in_button = wait.until(
            EC.element_to_be_clickable((By.ID, "signWP"))
        )
        sign_in_button.click()

        # Wait for 5 seconds and check if the 'Dashboard' element is present
        print("Checking for successful login", flush=True)
        time.sleep(5)
        try:
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Login successful! Dashboard element found", flush=True)
            
            # Navigate to the CRM API page
            # print("Navigating to CRM API page", flush=True)
            # driver.get("https://seller.indiamart.com/leadmanager/crmapi?")
            
            # # Wait for the page to load completely
            # time.sleep(5)
            
            # # Extract the API key
            # api_key = None
            # print("Extracting API key", flush=True)
            # try:
            #     api_key_element = wait.until(
            #         EC.presence_of_element_located((By.ID, "api_key2_v2"))
            #     )
            #     api_key = api_key_element.text.strip()
            #     print(f"API key extracted successfully: {api_key}", flush=True)
            # except (TimeoutException, NoSuchElementException):
            #     print("Error: API key element not found", flush=True)
            #     return 1
            
            # Navigate to privacy settings page to extract preferred categories

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
            # Create result object with all extracted data
            result = {
                "companyName": company_name,
                "mobileNumbers": mobile_numbers,
                "preferredCategories": preferred_categories,
                "messageTemplates": message_templates
            }
            
            # Print a separator and then the result as JSON for Node.js to parse
            print("===RESULT_START===", flush=True)
            print(json.dumps(result), flush=True)
            print("===RESULT_END===", flush=True)
            return 0  # Success exit code

        except TimeoutException:
            print("Error: Login failed - Dashboard element not found (timeout)", flush=True)
            return 1
        except NoSuchElementException:
            print("Error: Login failed - Dashboard element not found", flush=True)
            return 1

    except Exception as e:
        print(f"Unexpected error occurred: {str(e)}", flush=True)
        return 2

    finally:
        print("Closing browser", flush=True)
        driver.quit()

# Main block to handle command-line arguments
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python selenium_script.py <mobileNumber> <password>", flush=True)
        sys.exit(3)

    mobile_number = sys.argv[1]
    password = sys.argv[2]
    print(f"Arguments received - Mobile: {mobile_number}, Password: [HIDDEN]", flush=True)
    
    exit_code = execute_task_one(mobile_number, password)
    print(f"Script completed with exit code: {exit_code}", flush=True)
    sys.exit(exit_code)