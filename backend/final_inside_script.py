from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys
import json
input_data = json.loads(sys.stdin.read()) 

import requests

def send_data_to_dashboard(name, mobile, email=None, user_mobile_number=None):
    url = "https://api.leadscruise.com/api/store-lead"  # Backend API endpoint
    data = {
        "name": name,
        "mobile": mobile,
        "user_mobile_number": user_mobile_number  # Store the user's own mobile number
    }
    
    if email:
        data["email"] = email  # Add email only if it's available

    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print("Lead data sent successfully!", flush=True)
        else:
            print(f"Failed to send data: {response.text}", flush=True)
    except Exception as e:
        print(f"Error sending data to backend: {e}", flush=True)


def extend_word_array(word_array):
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
        "width": 1080,
        "height": 1080,
        "deviceScaleFactor": zoom_level,  # 0.75 = 75% zoom
        "mobile": False
    })
    print(f"Browser zoom set to {zoom_level * 100}% using Chrome DevTools Protocol.",flush=True)
def go_to_message_center_and_click(driver):
    print("Waiting for 10 seconds before going to the message center...", flush=True)
    time.sleep(10)  
    third_url = "https://seller.indiamart.com/messagecentre/"
    print(f"Redirecting to {third_url} to interact with the message center...", flush=True)
    driver.get(third_url)
    time.sleep(3)  
    try:
        message_element = driver.find_element(By.XPATH, "//div[@class='fl lh150 w100 hgt20']//div[@class='wrd_elip fl fs14 fwb maxwidth100m200']")
        message_element.click()
        print("Clicked the first element with the specified class parameters.", flush=True)
        time.sleep(2)  
        message_input = driver.find_element(By.XPATH, "//div[@class='lh150 pdb10 mxhgt125 m240130 edt_div edit_div_new fs15 overfw_yauto prewrap ' and @contenteditable='true']")
        sentences = input_data.get("sentences", [])
        for sentence in sentences:
            message_input.click()  
            message_input.clear()  
            message_input.send_keys(sentence)  
            print(f"Entered message: '{sentence}'", flush=True)
            send_div = driver.find_element(By.XPATH, "//div[@id='send-reply-span']")
            send_div.click()
            print("Clicked the send button inside the div.", flush=True)
            time.sleep(2)  

        view_more_button = driver.find_element(By.XPATH, "//div[@class='vd_text_vert por cp' and contains(text(), 'View More')]")
        view_more_button.click()
        print("Clicked the 'View More' button.")
        time.sleep(2)  

        left_name = driver.find_element(By.XPATH, "//div[@id='left-name']").text
        mobile_number = driver.find_element(By.XPATH, "//span[@class='fl mxwdt85 ml5 mt2 wbba']").text
        print(f"Name: {left_name}, Mobile: {mobile_number}", flush=True)
        
        try:
            email_id = driver.find_element(By.XPATH, "//span[@class='fl mxwdt85 ml5 wbba']").text
            print(f"Email ID: {email_id}", flush=True)
        except:
            email_id = None
            print("Email ID not found.", flush=True)
        user_mobile_number = input_data.get("mobileNumber", "")  # Get the logged-in user's mobile number
        send_data_to_dashboard(left_name, mobile_number, email_id, user_mobile_number)
    except Exception as e:
        print(f"An error occurred while interacting with the message center: {e}", flush=True)

def redirect_and_refresh(driver, wait):
    set_browser_zoom(driver, 75)
    first_url = "https://seller.indiamart.com/bltxn/?pref=recent"
    second_url = "https://seller.indiamart.com/bltxn/knowyourbuyer"
    word_array = input_data.get("wordArray", []) 
    word_array = extend_word_array(word_array)
    h2_word_array = input_data.get("h2WordArray", []) 
    print(f"Redirecting to {second_url} to check buyer balance...",flush=True)
    driver.get(second_url)
    time.sleep(3)  
    try:
        time.sleep(3)  
        buyer_balance_element = driver.find_element(By.ID, "cstm_bl_bal1")
        buyer_balance = int(buyer_balance_element.text)
        print(f"Buyer balance found: {buyer_balance}",flush=True)
        if buyer_balance > 0:
            print("Buyer balance is greater than 0. Redirecting back to the first link...",flush=True)
            driver.get(first_url)
            time.sleep(3)   
            try:
                time.sleep(3)  
                india_label = driver.find_element(By.XPATH, "//label[contains(text(), 'India')]")
                india_label.click()
                print("Clicked the 'India' label.",flush=True)  
            except Exception as e:
                print(f"Failed to click the 'India' label: {e}",flush=True)
            span_result = False
            try:
                time.sleep(3)  
                couplings_span = driver.find_element(By.XPATH, "//span[contains(@style, 'color: rgb(42, 166, 153);')]")
                couplings_text = couplings_span.text
                print(f"Read data from span: {couplings_text}",flush=True)
                span_result = couplings_text in word_array
                print(span_result)
            except Exception as e:
                print(f"Failed to read data from span with specified color: {e}",flush=True)
            h2_result = False
            try:
                time.sleep(3)  
                first_h2 = driver.find_element(By.XPATH, "//h2")
                first_h2_text = first_h2.text
                print(f"Read data from the first <h2>: {first_h2_text}",flush=True)
                h2_result = first_h2_text not in h2_word_array
                print(h2_result)
            except Exception as e:
                print(f"Failed to read data from the first <h2>: {e}",flush=True)
            time_result = False
            try:
                time.sleep(3)  
                time_element = driver.find_element(By.XPATH, "//strong[contains(text(), 'mins ago') or contains(text(), 'secs ago') or contains(text(), 'hrs ago')]")
                time_text = time_element.text
                print(f"Time text: {time_text}",flush=True)
                if 'mins ago' in time_text:
                    time_value = int(time_text.split()[0])
                elif 'secs ago' in time_text:
                    time_value = int(time_text.split()[0]) / 60  
                elif 'hrs ago' in time_text:
                    time_value = int(time_text.split()[0]) * 60  
                else:
                    time_value = 11  
                time_result = time_value < 10000000
                print(time_result)
            except Exception as e:
                print(f"Failed to read the time text: {e}",flush=True)
            try:
                close_button = driver.find_element(By.XPATH, "//span[@class='glob_sa_close' and contains(text(), '—')]")
                close_button.click()
                print("Clicked the close button.",flush=True)
            except Exception as e:
                if 'element not interactable' in str(e):
                    print("Close button is not interactable, skipping.",flush=True)
                else:
                    print(f"Close button not found or failed to click: {e}",flush=True)
            if span_result and h2_result and time_result:
                try:
                    contact_buyer_button = driver.find_element(By.XPATH, "//span[text()='Contact Buyer Now']")
                    contact_buyer_button.click()
                    print("Clicked the 'Contact Buyer Now' button.",flush=True)
                    go_to_message_center_and_click(driver)
                except Exception as e:
                    print(f"Failed to click the 'Contact Buyer Now' button: {e}",flush=True)
                print("Waiting for 10 seconds...",flush=True)
                time.sleep(10)  
        else:
            print("Buyer balance is 0. Exiting the function.",flush=True)
            return
    except Exception as e:
        print(f"Error while checking buyer balance: {e}",flush=True)
        return
def execute_task_one(driver, wait):
    try:
        print("Refreshing page...",flush=True)
        driver.refresh()
        time.sleep(3)
        user_mobile_number = input_data.get("mobileNumber", "")
        input_field = wait.until(EC.presence_of_element_located((By.ID, "mobNo")))
        input_field.clear()
        input_field.send_keys(user_mobile_number)
        print(f"Entered mobile number {user_mobile_number}.",flush=True)
        start_selling_button = wait.until(
            EC.element_to_be_clickable((By.CLASS_NAME, "login_btn"))
        )
        start_selling_button.click()
        print("Clicked 'Start Selling' button.",flush=True)
        enter_password_button = wait.until(
            EC.element_to_be_clickable((By.ID, "passwordbtn1"))
        )
        enter_password_button.click()
        print("Clicked 'Enter Password' button.",flush=True)
        user_password = input_data.get("password", "")
        password_input = wait.until(EC.presence_of_element_located((By.ID, "usr_password")))
        password_input.clear()
        password_input.send_keys(user_password)
        print("Entered the password.",flush=True)
        sign_in_button = wait.until(
            EC.element_to_be_clickable((By.ID, "signWP"))
        )
        sign_in_button.click()
        print("Clicked 'Sign In' button.",flush=True)
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
    chrome_options = Options()
    chrome_options.add_argument("--incognito")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-extensions")
    # chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://seller.indiamart.com/")  
    wait = WebDriverWait(driver, 10)
    try:   
        print("\nChecking for the 'Dashboard' element...",flush=True)
        try:  
            dashboard_element = wait.until(
                EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
            )
            print("Dashboard found.",flush=True)
            redirect_and_refresh(driver, wait)
        except:
            print("Dashboard not found. Executing login process...",flush=True)
            result = execute_task_one(driver, wait)
            print(f"Task Result: {result}")
            if result == "Unsuccessful":
                print("Login failed. Exiting program...",flush=True)
                return
        while True:
            print("\nChecking for the 'Dashboard' element in loop...",flush=True)
            try: 
                dashboard_element = wait.until(
                    EC.presence_of_element_located((By.ID, "leftnav_dash_link"))
                )
                print("Dashboard found.",flush=True)
                redirect_and_refresh(driver, wait)
            except:
                print("Dashboard not found. Executing login process...",flush=True)
                result = execute_task_one(driver, wait)
                print(f"Task Result: {result}")
                if result == "Unsuccessful":
                    print("Login failed during loop. Exiting program...",flush=True)
                    break
            print("\nRestarting the loop...",flush=True)
            time.sleep(5)  
    except KeyboardInterrupt:
        print("\nProgram manually exited.",flush=True)
    finally:
        driver.quit()
        print("Browser closed.",flush=True)
if __name__ == "__main__":
    main()