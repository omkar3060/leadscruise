#!/usr/bin/env python3
"""
Manual Worker Restart Script
Run this to restart the worker without restarting login
"""

import sys
import json

def restart_worker(unique_id):
    """Send restart command to login script"""
    
    print(f"Sending restart command for session: {unique_id}")
    
    # In a real implementation, this would communicate with the login script
    # For the sample, we'll create a signal file
    
    import os
    signal_file = f"restart_signal_{unique_id}.tmp"
    
    with open(signal_file, 'w') as f:
        f.write(json.dumps({
            "command": "RESTART_WORKER",
            "timestamp": __import__('time').time()
        }))
    
    print(f"✅ Restart signal created: {signal_file}")
    print("The login script will detect this and restart the worker.")
    print("")
    print("Watch the login script terminal for:")
    print("  • 'Restart signal detected'")
    print("  • 'Terminating current worker...'")
    print("  • 'Worker restarted successfully!'")
    print("  • Look for 🔥 emoji in output (proves new code)")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        unique_id = sys.argv[1]
    else:
        unique_id = "demo_123"  # Default for sample
    
    restart_worker(unique_id)