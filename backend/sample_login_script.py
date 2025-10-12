#!/usr/bin/env python3
"""
Sample Login Script - Demonstrates session management and worker spawning
This script handles authentication and maintains the session
"""

import sys
import json
import time
import pickle
import subprocess
import threading
import os
import signal

# Global variables
worker_process = None
session_active = True

def stop_execution(signum, frame):
    """Handle stop signal"""
    global worker_process
    print("LOGIN: Received stop signal. Exiting gracefully...", flush=True)
    if worker_process:
        worker_process.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, stop_execution)

def simulate_login(username, password):
    """Simulate login process (replace with real Selenium login)"""
    print(f"LOGIN: Authenticating user: {username}", flush=True)
    time.sleep(2)  # Simulate login delay
    
    # Simulate OTP request
    print("OTP_REQUEST_INITIATED", flush=True)
    
    # In real script, wait for OTP from stdin
    # For demo, we'll simulate successful login
    time.sleep(1)
    print("LOGIN: OTP verified successfully", flush=True)
    
    # Return simulated session data
    session_data = {
        'username': username,
        'session_token': f'token_{username}_{int(time.time())}',
        'cookies': [
            {'name': 'session_id', 'value': 'abc123xyz'},
            {'name': 'user_pref', 'value': 'dark_mode'}
        ],
        'logged_in_at': time.time()
    }
    
    return session_data

def save_session(session_data, unique_id):
    """Save session to a pickle file"""
    try:
        session_file = f"session_{unique_id}.pkl"
        with open(session_file, 'wb') as f:
            pickle.dump(session_data, f)
        print(f"LOGIN: Session saved to {session_file}", flush=True)
        return session_file
    except Exception as e:
        print(f"LOGIN: Error saving session: {e}", flush=True)
        return None

def start_worker(unique_id, input_data):
    """Start the worker script as a subprocess"""
    global worker_process
    
    try:
        session_file = f"session_{unique_id}.pkl"
        
        if not os.path.exists(session_file):
            print("LOGIN: Session file not found, cannot start worker", flush=True)
            return False
        
        # Prepare data for worker
        worker_input = {
            "session_file": session_file,
            "input_data": input_data
        }
        
        print("LOGIN: Starting worker process...", flush=True)
        worker_process = subprocess.Popen(
            ["python3", "-u", "sample_worker_script.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Send input data to worker
        worker_process.stdin.write(json.dumps(worker_input) + "\n")
        worker_process.stdin.flush()
        
        print(f"LOGIN: Worker process started (PID: {worker_process.pid})", flush=True)
        
        # Forward worker output
        def forward_output(pipe, prefix):
            for line in iter(pipe.readline, ''):
                if line:
                    print(f"{prefix}: {line.strip()}", flush=True)
        
        threading.Thread(target=forward_output, args=(worker_process.stdout, "WORKER"), daemon=True).start()
        threading.Thread(target=forward_output, args=(worker_process.stderr, "WORKER_ERR"), daemon=True).start()
        
        return True
        
    except Exception as e:
        print(f"LOGIN: Error starting worker: {e}", flush=True)
        return False

def monitor_worker():
    """Monitor worker and restart if it crashes"""
    global worker_process
    
    while session_active:
        if worker_process and worker_process.poll() is not None:
            exit_code = worker_process.returncode
            print(f"LOGIN: Worker process ended with code {exit_code}", flush=True)
            
            if exit_code != 0:
                print("LOGIN: Worker crashed, restarting in 3 seconds...", flush=True)
                time.sleep(3)
                # In real implementation, restart with saved session
                # start_worker(unique_id, input_data)
            else:
                print("LOGIN: Worker ended normally", flush=True)
        
        time.sleep(5)

def listen_for_commands(unique_id, input_data):
    """Listen for restart commands from backend or signal files"""
    global worker_process, session_active
    
    print("LOGIN: Command listener started", flush=True)
    
    signal_file = f"restart_signal_{unique_id}.tmp"
    check_count = 0
    
    while session_active:
        try:
            check_count += 1
            
            # Check for signal file every 2 seconds
            if os.path.exists(signal_file):
                print("\n" + "="*60, flush=True)
                print("LOGIN: 🔥 Restart signal detected!", flush=True)
                print("="*60, flush=True)
                
                # Delete the signal file
                try:
                    os.remove(signal_file)
                    print("LOGIN: Signal file removed", flush=True)
                except:
                    pass
                
                # Restart worker
                if worker_process:
                    print("LOGIN: Terminating current worker...", flush=True)
                    worker_process.terminate()
                    try:
                        worker_process.wait(timeout=5)
                    except:
                        worker_process.kill()
                        worker_process.wait()
                    
                    print("LOGIN: Worker terminated, starting new one...", flush=True)
                    time.sleep(1)
                    start_worker(unique_id, input_data)
                    print("LOGIN: ✅ Worker restarted successfully!", flush=True)
                    print("LOGIN: Watch for 🔥 emoji in output - proves new code is running!", flush=True)
                    print("="*60 + "\n", flush=True)
                else:
                    print("LOGIN: No worker process found to restart", flush=True)
            
            # Every 10 checks (20 seconds), show a reminder
            if check_count % 10 == 0:
                print(f"\nLOGIN: Still monitoring... (checked {check_count} times)", flush=True)
                print(f"LOGIN: To restart worker, run: python3 restart_worker.py {unique_id}", flush=True)
            
            time.sleep(2)
            
        except Exception as e:
            print(f"LOGIN: Error in command listener: {e}", flush=True)
            time.sleep(1)

def maintain_session():
    """Keep session alive by periodic checks"""
    global session_active
    
    print("LOGIN: Session maintenance started", flush=True)
    
    while session_active:
        time.sleep(30)  # Check every 30 seconds
        print("LOGIN: Session check - still active", flush=True)
        
        # In real implementation, verify session with browser
        # If session expired, re-authenticate

def main():
    global session_active
    
    print("=" * 60, flush=True)
    print("LOGIN SCRIPT STARTED", flush=True)
    print("=" * 60, flush=True)
    
    # Read input data from stdin
    try:
        input_line = sys.stdin.readline()
        input_data = json.loads(input_line.strip())
        
        username = input_data.get("username", "test_user")
        password = input_data.get("password", "test_pass")
        unique_id = input_data.get("uniqueId", "demo_123")
        
        print(f"LOGIN: Received request for user: {username}", flush=True)
        
    except Exception as e:
        print(f"LOGIN: Error reading input: {e}", flush=True)
        return
    
    # Step 1: Authenticate user
    print("\n--- STEP 1: AUTHENTICATION ---", flush=True)
    session_data = simulate_login(username, password)
    
    if not session_data:
        print("LOGIN: Authentication failed", flush=True)
        return
    
    print("LOGIN: ✅ Authentication successful!", flush=True)
    
    # Step 2: Save session
    print("\n--- STEP 2: SAVE SESSION ---", flush=True)
    session_file = save_session(session_data, unique_id)
    
    if not session_file:
        print("LOGIN: Failed to save session", flush=True)
        return
    
    print("LOGIN: ✅ Session saved!", flush=True)
    
    # Step 3: Start worker
    print("\n--- STEP 3: START WORKER ---", flush=True)
    if not start_worker(unique_id, input_data):
        print("LOGIN: Failed to start worker", flush=True)
        return
    
    print("LOGIN: ✅ Worker started!", flush=True)
    
    # Step 4: Start monitoring threads
    print("\n--- STEP 4: MONITORING ---", flush=True)
    
    # Start session maintenance
    session_thread = threading.Thread(target=maintain_session, daemon=True)
    session_thread.start()
    
    # Start worker monitor
    monitor_thread = threading.Thread(target=monitor_worker, daemon=True)
    monitor_thread.start()
    
    # Start command listener
    command_thread = threading.Thread(target=listen_for_commands, args=(unique_id, input_data), daemon=True)
    command_thread.start()
    
    print("LOGIN: ✅ All monitoring threads started!", flush=True)
    print("\n" + "=" * 60, flush=True)
    print("LOGIN SCRIPT RUNNING - Keeping session alive...", flush=True)
    print("Worker can be restarted without losing this session!", flush=True)
    print("=" * 60, flush=True)
    
    # Keep login script running
    try:
        while session_active:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nLOGIN: Keyboard interrupt received", flush=True)
    finally:
        session_active = False
        if worker_process:
            worker_process.terminate()
        print("LOGIN: Cleanup complete, exiting", flush=True)

if __name__ == "__main__":
    main()