import requests
import json
import time
from datetime import datetime
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading


class LeadFetcherApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Lead Fetcher - LeadsCruise API Client")
        self.root.geometry("800x600")
        self.root.resizable(True, True)
        
        # API Configuration
        self.base_url = "https://api.leadscruise.com/api/get-user-leads/"
        self.callback_url = "https://api.leadscruise.com/api/data-received-confirmation"
        self.default_mobile = "9579797269"
        
        # Setup GUI
        self.setup_gui()
        
    def setup_gui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # Title
        title_label = ttk.Label(main_frame, text="LeadsCruise API Data Fetcher", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # Mobile number input
        ttk.Label(main_frame, text="Mobile Number:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.mobile_var = tk.StringVar(value=self.default_mobile)
        mobile_entry = ttk.Entry(main_frame, textvariable=self.mobile_var, width=20)
        mobile_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # Callback URL input
        ttk.Label(main_frame, text="Callback URL:").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.callback_var = tk.StringVar(value=self.callback_url)
        callback_entry = ttk.Entry(main_frame, textvariable=self.callback_var, width=50)
        callback_entry.grid(row=2, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=5, padx=(10, 0))
        
        # Fetch button
        self.fetch_button = ttk.Button(main_frame, text="Fetch Leads Data", 
                                      command=self.fetch_data_threaded)
        self.fetch_button.grid(row=3, column=0, pady=5)
        
        # Send confirmation checkbox
        self.send_confirmation_var = tk.BooleanVar(value=True)
        confirm_cb = ttk.Checkbutton(main_frame, text="Send confirmation when data received", 
                                    variable=self.send_confirmation_var)
        confirm_cb.grid(row=3, column=1, columnspan=2, pady=5, sticky=tk.W, padx=(10, 0))
        
        # Status label
        self.status_var = tk.StringVar(value="Ready to fetch data...")
        status_label = ttk.Label(main_frame, textvariable=self.status_var)
        status_label.grid(row=4, column=0, columnspan=3, pady=10)
        
        # Progress bar
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # Response display
        ttk.Label(main_frame, text="API Response:").grid(row=6, column=0, sticky=(tk.W, tk.N), pady=(20, 5))
        
        # Text area for response
        self.response_text = scrolledtext.ScrolledText(main_frame, height=20, width=80)
        self.response_text.grid(row=7, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Configure grid weights for resizing
        main_frame.rowconfigure(7, weight=1)
        
        # Clear button
        clear_button = ttk.Button(main_frame, text="Clear Response", command=self.clear_response)
        clear_button.grid(row=8, column=0, pady=10, sticky=tk.W)
        
        # Auto-fetch checkbox
        self.auto_fetch_var = tk.BooleanVar()
        auto_fetch_cb = ttk.Checkbutton(main_frame, text="Auto-fetch every 30 seconds", 
                                       variable=self.auto_fetch_var, 
                                       command=self.toggle_auto_fetch)
        auto_fetch_cb.grid(row=8, column=1, pady=10, sticky=tk.W)
        
        # Exit button
        exit_button = ttk.Button(main_frame, text="Exit", command=self.root.quit)
        exit_button.grid(row=8, column=2, pady=10, sticky=tk.E)
        
        # Auto-fetch timer
        self.auto_fetch_timer = None
        
    def fetch_data_threaded(self):
        """Run fetch_data in a separate thread to prevent GUI freezing"""
        if not hasattr(self, '_fetch_thread') or not self._fetch_thread.is_alive():
            self._fetch_thread = threading.Thread(target=self.fetch_data)
            self._fetch_thread.daemon = True
            self._fetch_thread.start()
    
    def fetch_data(self):
        """Fetch data from the LeadsCruise API"""
        mobile = self.mobile_var.get().strip()
        
        if not mobile:
            self.update_status("Error: Mobile number is required!")
            messagebox.showerror("Error", "Please enter a mobile number!")
            return
            
        # Update GUI
        self.root.after(0, lambda: self.fetch_button.config(state='disabled'))
        self.root.after(0, lambda: self.progress.start())
        self.root.after(0, lambda: self.update_status(f"Fetching data for mobile: {mobile}..."))
        
        try:
            # Make API request
            url = f"{self.base_url}{mobile}"
            
            self.log_to_response(f"\n{'='*60}")
            self.log_to_response(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] FETCHING DATA")
            self.log_to_response(f"{'='*60}")
            self.log_to_response(f"URL: {url}")
            self.log_to_response(f"Mobile Number: {mobile}")
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadFetcher-Client/1.0'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            
            # Log response details
            self.log_to_response(f"\nResponse Status Code: {response.status_code}")
            self.log_to_response(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Pretty print the JSON response
                    formatted_response = json.dumps(data, indent=2, ensure_ascii=False)
                    self.log_to_response(f"\nAPI Response Data:\n{formatted_response}")
                    
                    # Extract key information
                    if 'success' in data and data['success']:
                        total_leads = data.get('totalLeads', 0)
                        leads_count = len(data.get('leads', []))
                        
                        self.log_to_response(f"\n{'='*40}")
                        self.log_to_response(f"✅ DATA RECEIVED SUCCESSFULLY!")
                        self.log_to_response(f"Total Leads in Database: {total_leads}")
                        self.log_to_response(f"Leads Retrieved: {leads_count}")
                        self.log_to_response(f"{'='*40}")
                        
                        # Send confirmation back to server if enabled
                        if self.send_confirmation_var.get():
                            self.send_confirmation_response(mobile, data)
                        
                        # Update status
                        self.root.after(0, lambda: self.update_status(
                            f"✅ SUCCESS: Received {leads_count} leads for {mobile}"))
                        
                        # Show success message
                        self.root.after(0, lambda: messagebox.showinfo(
                            "Success", 
                            f"Data received successfully!\n"
                            f"Mobile: {mobile}\n"
                            f"Total leads: {total_leads}\n"
                            f"Retrieved: {leads_count} leads"
                        ))
                        
                    else:
                        error_msg = data.get('error', 'Unknown error')
                        self.log_to_response(f"\n❌ API Error: {error_msg}")
                        self.root.after(0, lambda: self.update_status(f"❌ API Error: {error_msg}"))
                        
                except json.JSONDecodeError as e:
                    error_msg = f"Failed to parse JSON response: {str(e)}"
                    self.log_to_response(f"\n❌ {error_msg}")
                    self.log_to_response(f"Raw response: {response.text[:500]}...")
                    self.root.after(0, lambda: self.update_status(f"❌ JSON Error: {str(e)}"))
                    
            else:
                error_msg = f"HTTP {response.status_code}: {response.reason}"
                self.log_to_response(f"\n❌ HTTP Error: {error_msg}")
                self.log_to_response(f"Response content: {response.text[:500]}...")
                self.root.after(0, lambda: self.update_status(f"❌ HTTP Error: {error_msg}"))
                
        except requests.exceptions.Timeout:
            error_msg = "Request timeout (30 seconds)"
            self.log_to_response(f"\n❌ Timeout Error: {error_msg}")
            self.root.after(0, lambda: self.update_status(f"❌ Timeout: {error_msg}"))
            
        except requests.exceptions.ConnectionError:
            error_msg = "Connection error - check internet connection"
            self.log_to_response(f"\n❌ Connection Error: {error_msg}")
            self.root.after(0, lambda: self.update_status(f"❌ Connection Error"))
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.log_to_response(f"\n❌ {error_msg}")
            self.root.after(0, lambda: self.update_status(f"❌ Error: {str(e)}"))
            
        finally:
            # Re-enable GUI
            self.root.after(0, lambda: self.progress.stop())
            self.root.after(0, lambda: self.fetch_button.config(state='normal'))
    
    def send_confirmation_response(self, mobile, received_data):
        """Send confirmation back to the server that data was received"""
        try:
            callback_url = self.callback_var.get().strip()
            if not callback_url:
                self.log_to_response("\n⚠️ No callback URL specified - skipping confirmation")
                return
            
            self.log_to_response(f"\n📤 SENDING CONFIRMATION RESPONSE...")
            self.log_to_response(f"Callback URL: {callback_url}")
            
            # Prepare confirmation payload
            confirmation_data = {
                "status": "received",
                "message": "Data has been successfully received by client application",
                "mobile_number": mobile,
                "timestamp": datetime.now().isoformat(),
                "client_info": {
                    "application": "LeadFetcher-Client",
                    "version": "1.0"
                },
                "received_data_summary": {
                    "total_leads": received_data.get('totalLeads', 0),
                    "leads_count": len(received_data.get('leads', [])),
                    "success": received_data.get('success', False)
                }
            }
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadFetcher-Client/1.0'
            }
            
            # Send POST request with confirmation
            confirmation_response = requests.post(
                callback_url, 
                json=confirmation_data, 
                headers=headers, 
                timeout=15
            )
            
            self.log_to_response(f"Confirmation Response Status: {confirmation_response.status_code}")
            
            if confirmation_response.status_code in [200, 201, 202]:
                self.log_to_response("✅ CONFIRMATION SENT SUCCESSFULLY!")
                try:
                    response_json = confirmation_response.json()
                    self.log_to_response(f"Server Response: {json.dumps(response_json, indent=2)}")
                except:
                    self.log_to_response(f"Server Response: {confirmation_response.text}")
            else:
                self.log_to_response(f"❌ Confirmation failed: HTTP {confirmation_response.status_code}")
                self.log_to_response(f"Response: {confirmation_response.text}")
                
        except requests.exceptions.Timeout:
            self.log_to_response("❌ Confirmation timeout (15 seconds)")
        except requests.exceptions.ConnectionError:
            self.log_to_response("❌ Confirmation failed: Connection error")
        except Exception as e:
            self.log_to_response(f"❌ Confirmation error: {str(e)}")
            
    def log_to_response(self, message):
        """Add message to response text area (thread-safe)"""
        self.root.after(0, lambda: self._append_to_text(message))
        
    def _append_to_text(self, message):
        """Append text to response area and scroll to bottom"""
        self.response_text.insert(tk.END, message + "\n")
        self.response_text.see(tk.END)
        self.root.update_idletasks()
        
    def update_status(self, message):
        """Update status label"""
        self.status_var.set(message)
        
    def clear_response(self):
        """Clear the response text area"""
        self.response_text.delete(1.0, tk.END)
        self.update_status("Response cleared. Ready to fetch data...")
        
    def toggle_auto_fetch(self):
        """Toggle auto-fetch functionality"""
        if self.auto_fetch_var.get():
            self.start_auto_fetch()
        else:
            self.stop_auto_fetch()
            
    def start_auto_fetch(self):
        """Start auto-fetch timer"""
        self.update_status("Auto-fetch enabled (30 second intervals)")
        self.schedule_auto_fetch()
        
    def stop_auto_fetch(self):
        """Stop auto-fetch timer"""
        if self.auto_fetch_timer:
            self.root.after_cancel(self.auto_fetch_timer)
            self.auto_fetch_timer = None
        self.update_status("Auto-fetch disabled")
        
    def schedule_auto_fetch(self):
        """Schedule next auto-fetch"""
        if self.auto_fetch_var.get():
            self.fetch_data_threaded()
            self.auto_fetch_timer = self.root.after(30000, self.schedule_auto_fetch)  # 30 seconds


def main():
    """Main application entry point"""
    try:
        # Create and run the application
        root = tk.Tk()
        app = LeadFetcherApp(root)
        
        # Handle window closing
        def on_closing():
            if app.auto_fetch_timer:
                root.after_cancel(app.auto_fetch_timer)
            root.quit()
            root.destroy()
            
        root.protocol("WM_DELETE_WINDOW", on_closing)
        
        # Start the GUI event loop
        root.mainloop()
        
    except Exception as e:
        print(f"Application error: {e}")
        input("Press Enter to exit...")


if __name__ == "__main__":
    main()