#!/usr/bin/env python3
"""
Sample Worker Script - Demonstrates hot-reloadable business logic
This script can be restarted without losing the login session
"""

import sys
import json
import time
import pickle
import signal
import random

# Global variables
processing = True
lead_count = 0

def stop_execution(signum, frame):
    """Handle stop signal"""
    global processing
    print("WORKER: Received stop signal. Exiting gracefully...", flush=True)
    processing = False
    sys.exit(0)

signal.signal(signal.SIGINT, stop_execution)

def load_session(session_file):
    """Load the saved session from file"""
    try:
        with open(session_file, 'rb') as f:
            session_data = pickle.load(f)
        
        print(f"WORKER: ✅ Session loaded from {session_file}", flush=True)
        print(f"WORKER: Session token: {session_data.get('session_token', 'N/A')}", flush=True)
        print(f"WORKER: Username: {session_data.get('username', 'N/A')}", flush=True)
        print(f"WORKER: Logged in at: {time.ctime(session_data.get('logged_in_at', 0))}", flush=True)
        
        return session_data
    except Exception as e:
        print(f"WORKER: ❌ Error loading session: {e}", flush=True)
        return None

def process_lead(lead_data, session_data):
    """
    Simulate lead processingh
    THIS IS YOUR BUSINESS LOGIC - Can be changed and hot-reloaded!
    """
    global lead_count
    lead_count += 1
    
    print(f"\n---HOT- RELOADED Processing Lead #{lead_count} ---", flush=True)
    print(f"Lead Name: {lead_data['name']}", flush=True)
    print(f"Lead Phone: {lead_data['phone']}", flush=True)
    print(f"Lead Type: {lead_data['type']}", flush=True)
    
    # Simulate some processing time
    time.sleep(1)
    
    # Use session data
    print(f"Processing with session: {session_data['username']}", flush=True)
    
    # Simulate API call to save lead
    success = random.choice([True, True, True, False])  # 75% success rate
    
    if success:
        print(f"✅ Lead #{lead_count} processed successfully!", flush=True)
    else:
        print(f"❌ Lead #{lead_count} failed to process", flush=True)
    
    return success

def fetch_leads():
    """
    Simulate fetching leads from IndiaMART
    THIS IS YOUR BUSINESS LOGIC - Can be changed and hot-reloaded!
    """
    # Simulated lead data
    leads = [
        {"name": "Acme Corp", "phone": "9876543210", "type": "bulk"},
        {"name": "Tech Solutions", "phone": "9876543211", "type": "retail"},
        {"name": "Global Traders", "phone": "9876543212", "type": "wholesale"},
        {"name": "Smart Industries", "phone": "9876543213", "type": "bulk"},
        {"name": "Prime Exports", "phone": "9876543214", "type": "export"},
    ]
    
    return leads

def send_to_dashboard(lead_data, user_mobile):
    """
    Simulate sending data to dashboard
    THIS IS YOUR BUSINESS LOGIC - Can be changed and hot-reloaded!
    """
    print(f"WORKER: Sending lead to dashboard for user {user_mobile}", flush=True)
    time.sleep(0.5)  # Simulate API call
    print("WORKER: ✅ Data sent to dashboard", flush=True)

def main_processing_loop(session_data, input_data):
    """
    Main worker processing loop
    THIS IS YOUR BUSINESS LOGIC - Can be changed and hot-reloaded!
    """
    global processing
    
    user_mobile = input_data.get("mobileNumber", "N/A")
    max_leads = input_data.get("maxLeads", 5)
    
    print(f"\nWORKER: Starting processing loop", flush=True)
    print(f"WORKER: User: {user_mobile}", flush=True)
    print(f"WORKER: Max leads to process: {max_leads}", flush=True)
    print("=" * 60, flush=True)
    
    iteration = 0
    
    while processing and lead_count < max_leads:
        iteration += 1
        print(f"\n{'='*60}", flush=True)
        print(f"WORKER: Iteration #{iteration}", flush=True)
        print(f"{'='*60}", flush=True)
        
        # Fetch leads
        print("WORKER: Fetching leads...", flush=True)
        leads = fetch_leads()
        print(f"WORKER: Found {len(leads)} leads", flush=True)
        
        # Process each lead
        for lead in leads:
            if not processing or lead_count >= max_leads:
                break
            
            # Process the lead
            success = process_lead(lead, session_data)
            
            if success:
                # Send to dashboard
                send_to_dashboard(lead, user_mobile)
            
            # Small delay between leads
            time.sleep(2)
        
        # Check if we should continue
        if lead_count >= max_leads:
            print(f"\nWORKER: Reached max leads ({max_leads}), stopping", flush=True)
            break
        
        # Wait before next iteration
        print(f"\nWORKER: Waiting 5 seconds before next iteration...", flush=True)
        time.sleep(5)
    
    print("\n" + "=" * 60, flush=True)
    print(f"WORKER: Processing complete! Processed {lead_count} leads", flush=True)
    print("=" * 60, flush=True)

def main_processing_loop(session_data, input_data):
    """
    Main worker processing loop
    THIS IS YOUR BUSINESS LOGIC - Can be changed and hot-reloaded!
    """
    global processing, lead_count
    
    user_mobile = input_data.get("mobileNumber", "N/A")
    max_leads = input_data.get("maxLeads", 5)
    
    print(f"\nWORKER: Starting processing loop", flush=True)
    print(f"WORKER: User: {user_mobile}", flush=True)
    print(f"WORKER: Max leads to process: {max_leads}", flush=True)
    print("=" * 60, flush=True)
    
    iteration = 0
    
    while processing and lead_count < max_leads:
        iteration += 1
        print(f"\n{'='*60}", flush=True)
        print(f"WORKER: Iteration #{iteration}", flush=True)
        print(f"{'='*60}", flush=True)
        
        # Fetch leads
        print("WORKER: Fetching leads...", flush=True)
        leads = fetch_leads()
        print(f"WORKER: Found {len(leads)} leads", flush=True)
        
        # Process each lead
        for lead in leads:
            if not processing or lead_count >= max_leads:
                break
            
            # Process the lead
            success = process_lead(lead, session_data)
            
            if success:
                # Send to dashboard
                send_to_dashboard(lead, user_mobile)
            
            # Small delay between leads
            time.sleep(2)
        
        # Check if we should continue
        if lead_count >= max_leads:
            print(f"\nWORKER: Reached max leads ({max_leads}), stopping", flush=True)
            break
        
        # Wait before next iteration
        print(f"\nWORKER: Waiting 5 seconds before next iteration...", flush=True)
        time.sleep(5)
    
    print("\n" + "=" * 60, flush=True)
    print(f"WORKER: Processing complete! Processed {lead_count} leads", flush=True)
    print("=" * 60, flush=True)

def main():
    """Main worker function"""
    print("=" * 60, flush=True)
    print("WORKER SCRIPT STARTED", flush=True)
    print("=" * 60, flush=True)
    
    # Read input from login script
    try:
        input_line = sys.stdin.readline()
        worker_input = json.loads(input_line.strip())
        
        session_file = worker_input['session_file']
        input_data = worker_input['input_data']
        
        print(f"WORKER: Received session file: {session_file}", flush=True)
        
    except Exception as e:
        print(f"WORKER: Error reading input: {e}", flush=True)
        return
    
    # Step 1: Load session
    print("\n--- STEP 1: LOAD SESSION ---", flush=True)
    session_data = load_session(session_file)
    
    if not session_data:
        print("WORKER: Failed to load session, exiting", flush=True)
        return
    
    # Step 2: Verify session is valid
    print("\n--- STEP 2: VERIFY SESSION ---", flush=True)
    session_age = time.time() - session_data.get('logged_in_at', 0)
    print(f"WORKER: Session age: {session_age:.0f} seconds", flush=True)
    
    if session_age < 3600:  # Less than 1 hour
        print("WORKER: ✅ Session is valid!", flush=True)
    else:
        print("WORKER: ⚠️  Session is old but will try to use it", flush=True)
    
    # Step 3: Start processing
    print("\n--- STEP 3: START PROCESSING ---", flush=True)
    
    try:
        main_processing_loop(session_data, input_data)
    except KeyboardInterrupt:
        print("\nWORKER: Keyboard interrupt received", flush=True)
    except Exception as e:
        print(f"WORKER: Error in processing loop: {e}", flush=True)
    finally:
        print("WORKER: Cleanup complete, exiting", flush=True)

if __name__ == "__main__":
    main()
