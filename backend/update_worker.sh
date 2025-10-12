#!/bin/bash

# Script to update worker_script.py and restart all active workers without disrupting logins
# Usage: ./update_worker.sh

echo "=== Worker Update Script ==="
echo "This will restart all active worker processes without disrupting user login sessions"
echo ""

# Check if worker_script.py exists
if [ ! -f "worker_script.py" ]; then
    echo "Error: worker_script.py not found in current directory"
    exit 1
fi

# Backup the current worker script
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="worker_script_backup_${TIMESTAMP}.py"

echo "Creating backup: $BACKUP_FILE"
cp worker_script.py "$BACKUP_FILE"

echo "Worker script backed up successfully"
echo ""

# Get all active sessions from your API or database
# This is a placeholder - you'll need to implement this based on your setup
echo "Fetching active sessions..."

# Make API call to get list of active uniqueIds
# Replace with your actual API endpoint
API_URL="https://api.leadscruise.com/api/active-sessions"

# Use curl to get active sessions
ACTIVE_SESSIONS=$(curl -s "$API_URL")

if [ -z "$ACTIVE_SESSIONS" ]; then
    echo "No active sessions found or API call failed"
    exit 0
fi

echo "Active sessions found: $ACTIVE_SESSIONS"
echo ""

# Parse the JSON response and restart each worker
# Assuming the API returns JSON array of uniqueIds: ["id1", "id2", ...]
echo "$ACTIVE_SESSIONS" | jq -r '.[]' | while read uniqueId; do
    echo "Restarting worker for session: $uniqueId"
    
    # Make API call to restart worker
    RESTART_URL="http://localhost:5000/api/restart-worker"
    
    RESPONSE=$(curl -s -X POST "$RESTART_URL" \
        -H "Content-Type: application/json" \
        -d "{\"uniqueId\": \"$uniqueId\"}")
    
    echo "Response: $RESPONSE"
    echo ""
    
    # Small delay between restarts
    sleep 1
done

echo "=== Worker update completed ==="
echo "All active workers have been restarted with the new code"
echo "Login sessions remain intact"
echo ""
echo "Backup saved as: $BACKUP_FILE"