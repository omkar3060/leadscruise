import os
import sys
import winreg
import json
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

class AutoResumeApp:
    def __init__(self):
        self.app_name = "AutoResumeApp"
        self.state_file = Path.home() / f".{self.app_name}_state.json"
        self.registry_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        
        # Initialize GUI
        self.root = tk.Tk()
        self.root.title("Auto-Resume Application")
        self.root.geometry("400x300")
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        self.setup_ui()
        self.setup_registry()  # Always keep in startup
        self.mark_as_running()
    
    def setup_ui(self):
        """Create the GUI interface"""
        # Title
        title = tk.Label(
            self.root, 
            text="Auto-Resume Application",
            font=("Arial", 16, "bold"),
            pady=20
        )
        title.pack()
        
        # Info text
        info = tk.Label(
            self.root,
            text="This application will automatically restart\nwhen your system boots, but ONLY if it was\nrunning when you shut down.",
            justify=tk.CENTER,
            pady=10
        )
        info.pack()
        
        # Status indicator
        self.status_label = tk.Label(
            self.root,
            text="Status: Running ✓",
            font=("Arial", 12),
            fg="green",
            pady=20
        )
        self.status_label.pack()
        
        # Button frame
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=20)
        
        # Close button
        close_btn = tk.Button(
            btn_frame,
            text="Close Application",
            command=self.on_closing,
            width=15,
            bg="#ff6b6b",
            fg="white",
            font=("Arial", 10, "bold")
        )
        close_btn.pack()
        
        # Info label
        info2 = tk.Label(
            self.root,
            text="Close this app normally to prevent auto-restart.\nSystem shutdown while running will trigger auto-restart.",
            font=("Arial", 8),
            fg="gray",
            wraplength=350,
            justify=tk.CENTER
        )
        info2.pack(side=tk.BOTTOM, pady=10)
    
    def setup_registry(self):
        """Add application to Windows startup registry"""
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                self.registry_path,
                0,
                winreg.KEY_SET_VALUE
            )
            
            # Get the path to the current executable with --startup argument
            if getattr(sys, 'frozen', False):
                # Running as compiled exe
                exe_path = f'"{sys.executable}" --startup'
            else:
                # Running as script
                exe_path = f'"{sys.executable}" "{os.path.abspath(__file__)}" --startup'
            
            winreg.SetValueEx(
                key,
                self.app_name,
                0,
                winreg.REG_SZ,
                exe_path
            )
            winreg.CloseKey(key)
        except Exception as e:
            print(f"Error setting up registry: {e}")
    
    def mark_as_running(self):
        """Mark the application as currently running"""
        state = {"running": True}
        try:
            with open(self.state_file, 'w') as f:
                json.dump(state, f)
        except Exception as e:
            print(f"Error writing state file: {e}")
    
    def mark_as_stopped(self):
        """Mark the application as stopped (normal close)"""
        state = {"running": False}
        try:
            with open(self.state_file, 'w') as f:
                json.dump(state, f)
        except Exception as e:
            print(f"Error writing state file: {e}")
    
    def was_running_before(self):
        """Check if the application was running before shutdown"""
        if not self.state_file.exists():
            return False
        
        try:
            with open(self.state_file, 'r') as f:
                state = json.load(f)
                return state.get("running", False)
        except Exception as e:
            print(f"Error reading state file: {e}")
            return False
    
    def on_closing(self):
        """Handle window close event (normal close)"""
        if messagebox.askokcancel("Quit", "Do you want to close the application?"):
            # Normal close - mark as stopped
            self.mark_as_stopped()
            self.root.destroy()
    
    def run(self):
        """Start the application"""
        self.root.mainloop()


def main():
    """Main entry point"""
    started_from_startup = "--startup" in sys.argv
    
    if started_from_startup:
        # Application started from Windows startup
        # Check state file BEFORE creating the app
        state_file = Path.home() / ".AutoResumeApp_state.json"
        
        should_run = False
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
                    should_run = state.get("running", False)
            except Exception as e:
                print(f"Error reading state file: {e}")
        
        if not should_run:
            # Don't run if it wasn't running before
            print("Application was not running during last session. Exiting.")
            sys.exit(0)
    
    # Create and run the application
    app = AutoResumeApp()
    app.run()


if __name__ == "__main__":
    main()