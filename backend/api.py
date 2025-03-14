import requests
import time
import sys
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google.oauth2 import service_account
import signal

def handle_sigint(signal_received, frame):
    print("Received SIGINT. Exiting gracefully...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_sigint)

# Force unbuffered output to ensure print statements are immediately visible
class Unbuffered:
    def __init__(self, stream):
        self.stream = stream
    def write(self, data):
        self.stream.write(data)
        self.stream.flush()
    def writelines(self, datas):
        self.stream.writelines(datas)
        self.stream.flush()
    def __getattr__(self, attr):
        return getattr(self.stream, attr)

sys.stdout = Unbuffered(sys.stdout)
sys.stderr = Unbuffered(sys.stderr)

# IndiaMART API Configuration (User must enter the API key manually)
EXTERNAL_API_URL = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/"

# Google Sheets API Configuration
SERVICE_ACCOUNT_FILE = r"leadscruise-571c547f0797.json"
SPREADSHEET_ID = sys.argv[2]
RANGE_NAME = "Sheet1!A2"  
# Start from row 2 to skip headers

# Prompt user for API Key at runtime
EXTERNAL_API_KEY = sys.argv[1]

def clear_google_sheet():
    """Clears all data in the Google Sheet at the start of the script."""
    
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    try:
        # Clear the entire sheet
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range="Sheet1"  # Clear entire sheet
        ).execute()
        
        print(" Google Sheet has been cleared at startup!")

    except Exception as e:
        print(f"Error clearing Google Sheet: {e}")
        sys.exit(1)  
# Stop execution if clearing fails

def get_external_data(start_date, end_date):
    """Fetches leads from IndiaMART API for a given date range."""
    
    # Format dates as required by IndiaMART API (DD-MMM-YYYY)
    start_time = start_date.strftime("%d-%b-%Y")
    end_time = end_date.strftime("%d-%b-%Y")

    # Construct API URL for the date range
    api_url = f"{EXTERNAL_API_URL}?glusr_crm_key={EXTERNAL_API_KEY}&start_time={start_time}&end_time={end_time}"

    print(f"Fetching leads from {start_time} to {end_time}")

    try:
        response = requests.get(api_url)
        response.raise_for_status()  # Raise error for bad status codes
        data = response.json()
        
        if data.get("CODE") != 200:
            print(f"API Error: {data.get('MESSAGE', 'Unknown error')}")
            sys.exit(1)  # Stop execution immediately

        leads = data.get("RESPONSE", [])
        return list(reversed(leads))  # **Reverse the batch before returning**
    
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        sys.exit(1)  # Stop execution immediately

def write_to_sheets(data):
    """Writes IndiaMART leads to Google Sheets, keeping newest leads at the top within each batch."""
    
    if not data:
        print("No leads found to write.")
        return
    
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    values = [list(lead.values()) for lead in data]  # Convert JSON to list of lists
    body = {"values": values}

    try:
        result = service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME,
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",  # **Inserts data at the top**
            body=body
        ).execute()
        print(f" {result.get('updates').get('updatedCells')} cells updated in Google Sheets.")
    
    except Exception as e:
        print(f" Error writing to Google Sheets: {e}")
        sys.exit(1)  # Stop execution immediately

# Main function to fetch data starting from the newest and moving backward
if __name__ == "__main__":
    print("Starting IndiaMART Lead Scraper...")
    clear_google_sheet()  # **Clear the sheet at the start**
    
    today = datetime.now()
    days_back = 0  # Start from the current week

    while days_back < 360:
        end_date = today - timedelta(days=days_back)  # X (latest date)
        start_date = today - timedelta(days=days_back + 7)  # X-7 (previous week)

        leads_data = get_external_data(start_date, end_date)
        write_to_sheets(leads_data)  # Inserts **at the top** to maintain order

        days_back += 7  # Move 7 days back
        print(f"Processed {days_back} days back, waiting 6 minutes before next request...")

        time.sleep(360)  # Wait for 6 minutes (360 seconds)

    print("Completed fetching data for the last 360 days.")