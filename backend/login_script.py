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