"""
Modern Responsive Login UI for LeadsCruise Application
File: responsive_login_ui.py
"""

import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageDraw, ImageTk
import customtkinter as ctk
import threading
from ctypes import windll, byref, c_int, sizeof


class LoginUI:
    """Modern Responsive Login UI with gradient background"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("LeadsCruise - Login")
        
        # Get screen dimensions
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        # Set initial window size (80% of screen)
        window_width = int(screen_width * 0.8)
        window_height = int(screen_height * 0.8)
        self.root.geometry(f"{window_width}x{window_height}")
        
        # Variables
        self.email_var = tk.StringVar()
        self.password_var = tk.StringVar()
        self.remember_me_var = tk.BooleanVar(value=True)
        self.show_password_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="Enter your credentials to login")
        
        # UI Components
        self.canvas = None
        self.bg_image = None
        self.login_button = None
        self.password_entry = None
        self.show_password_btn = None
        self.progress = None
        self.main_frame = None
        self.card_window = None
        self.promo_window = None
        
        # Center window
        self.center_window()
        
        # Build UI
        self.create_gradient_background()
        self.create_modern_login_form()
        
        # Bind resize event
        self.root.bind('<Configure>', self.on_window_resize)
        
    def center_window(self):
        """Center the window on screen"""
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
    
    def create_gradient_background(self):
        """Create a gradient background from purple to teal"""
        width = self.root.winfo_width() or 1200
        height = self.root.winfo_height() or 700
        
        try:
            # Create gradient image
            gradient = Image.new('RGB', (width, height))
            draw = ImageDraw.Draw(gradient)
            
            # Define colors - Purple to Blue to Teal gradient
            colors = [
                (147, 112, 219),  # Purple (top)
                (100, 149, 237),  # Cornflower Blue (middle)
                (72, 209, 204)    # Teal (bottom)
            ]
            
            # Create smooth gradient
            for y in range(height):
                if y < height // 2:
                    ratio = y / (height // 2)
                    r = int(colors[0][0] + (colors[1][0] - colors[0][0]) * ratio)
                    g = int(colors[0][1] + (colors[1][1] - colors[0][1]) * ratio)
                    b = int(colors[0][2] + (colors[1][2] - colors[0][2]) * ratio)
                else:
                    ratio = (y - height // 2) / (height // 2)
                    r = int(colors[1][0] + (colors[2][0] - colors[1][0]) * ratio)
                    g = int(colors[1][1] + (colors[2][1] - colors[1][1]) * ratio)
                    b = int(colors[1][2] + (colors[2][2] - colors[1][2]) * ratio)
                
                draw.rectangle([(0, y), (width, y+1)], fill=(r, g, b))
            
            # Convert to PhotoImage
            self.bg_image = ImageTk.PhotoImage(gradient)
            
            # Create canvas
            self.canvas = tk.Canvas(self.root, width=width, height=height, 
                                   highlightthickness=0, bg='#6B5B95')
            self.canvas.pack(fill=tk.BOTH, expand=True)
            self.canvas.create_image(0, 0, image=self.bg_image, anchor=tk.NW)
            
        except Exception as e:
            print(f"Error creating gradient: {e}")
            self.root.configure(bg='#6B5B95')
    
    def create_modern_login_form(self):
        """Create the login form with modern styling"""
        # Create white card for login form
        card_frame = tk.Frame(self.canvas, bg='white', bd=0)
        
        # Calculate responsive positions and sizes
        canvas_width = self.canvas.winfo_reqwidth() or 1200
        canvas_height = self.canvas.winfo_reqheight() or 700
        
        card_width = min(500, int(canvas_width * 0.35))
        card_height = int(canvas_height * 0.85)
        card_x = int(canvas_width * 0.08)
        card_y = int(canvas_height * 0.075)
        
        self.card_window = self.canvas.create_window(
            card_x, card_y, anchor=tk.NW, 
            window=card_frame, width=card_width, height=card_height
        )
        
        # Add padding inside card
        content_frame = tk.Frame(card_frame, bg='white', padx=40, pady=30)
        content_frame.pack(fill=tk.BOTH, expand=True)
        self.main_frame = content_frame
        
        # Logo/Title
        title_label = tk.Label(content_frame, text="Login", 
                              font=("Segoe UI", 28, "bold"),
                              bg='white', fg='#1a1a1a')
        title_label.pack(pady=(0, 25))
        
        # Social login buttons
        self.create_social_button(content_frame, "Continue with Google")
        self.create_social_button(content_frame, "Continue with Facebook")
        
        # OR divider
        self.create_divider(content_frame)
        
        # Email field
        self.create_email_field(content_frame)
        
        # Password field
        self.create_password_field(content_frame)
        
        # Remember me checkbox
        remember_cb = tk.Checkbutton(content_frame, text="Remember me",
                                    variable=self.remember_me_var,
                                    font=("Segoe UI", 9),
                                    bg='white', fg='#666666',
                                    selectcolor='white',
                                    activebackground='white')
        remember_cb.pack(anchor=tk.W, pady=(0, 15))
        
        # Login button
        self.create_login_button(content_frame)
        
        # Sign up link
        self.create_signup_link(content_frame)
        
        # Progress bar (hidden initially)
        self.progress = ttk.Progressbar(content_frame, mode='indeterminate', length=300)
        
        # Right side - Promotional message
        self.create_promo_card()
    
    def create_social_button(self, parent, text):
        """Create a rounded social login button (CustomTkinter)"""
        btn = ctk.CTkButton(
        parent,
        text=text,
        font=ctk.CTkFont(family="Segoe UI", size=14),
        corner_radius=10,           # 👈 rounded corners
        fg_color="#1a1a1a",         # normal background
        hover_color="#333333",      # hover background
        text_color="#f5f5f5",       # text color
        height=40,
        cursor="hand2",
        command=lambda: messagebox.showinfo(
            "Coming Soon",
            f"{text} integration coming soon!")
        )
        btn.pack(fill="x", pady=4)
        
        return btn

    
    def create_divider(self, parent):
        """Create OR divider"""
        or_frame = tk.Frame(parent, bg='white')
        or_frame.pack(fill=tk.X, pady=15)
        
        tk.Frame(or_frame, bg='#d0d0d0', height=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        tk.Label(or_frame, text="OR", font=("Segoe UI", 9), bg='white', fg='#999999').pack(side=tk.LEFT)
        tk.Frame(or_frame, bg='#d0d0d0', height=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 0))
    
    def create_email_field(self, parent):
        """Create email input field"""
        ctk.CTkLabel(
            parent,
            text="Email",
            font=ctk.CTkFont(family="Helvetica", size=14),
            text_color='#333333',
            anchor='w'
        ).pack(anchor=tk.W, pady=(0, 5))

        # Use CTkEntry instead of tk.Entry
        email_entry = ctk.CTkEntry(
            parent,
            textvariable=self.email_var,
            height=40,
            corner_radius=10,   # Rounded corners
            fg_color="#f5f5f5", # background color
            border_color="#e0e0e0",
            border_width=1,
            text_color="#333333",
            font=ctk.CTkFont(family="Segoe UI", size=14),
            placeholder_text="srinivas.m@focusengg.com"
        )
        email_entry.pack(fill="x", pady=(0, 15))
        # Bind focus color changes
        email_entry.bind('<FocusIn>', lambda e: email_entry.configure(fg_color="#e8f4f8"))
        email_entry.bind('<FocusOut>', lambda e: email_entry.configure(fg_color="#f5f5f5"))
    
    def create_password_field(self, parent):
        """Create password input field with show/hide toggle"""
        # Header: Password label + Forgot Password link
        password_header = tk.Frame(parent, bg='white')
        password_header.pack(fill=tk.X, pady=(0, 5))

        tk.Label(
            password_header,
            text="Password",
            font=("Helvetica", 10),
            bg='white',
            fg='#333333'
        ).pack(side=tk.LEFT)

        forgot_btn = tk.Label(
            password_header,
            text="Forgot Password?",
            font=("Segoe UI", 8),
            bg='white',
            fg='#999999',
            cursor='hand2'
        )
        forgot_btn.pack(side=tk.RIGHT)
        forgot_btn.bind('<Button-1>', lambda e: self.forgot_password())
        forgot_btn.bind('<Enter>', lambda e: forgot_btn.configure(fg='#666666'))
        forgot_btn.bind('<Leave>', lambda e: forgot_btn.configure(fg='#999999'))

        # Container frame for password entry + eye icon
        password_container = tk.Frame(parent, bg='white')
        password_container.pack(fill=tk.X, pady=(0, 15))

        # Create a rounded CTkEntry (like email)
        self.password_entry = ctk.CTkEntry(
            password_container,
            textvariable=self.password_var,
            height=40,
            corner_radius=10,             # 👈 Rounded corners
            fg_color="#f5f5f5",
            border_color="#e0e0e0",
            border_width=1,
            text_color="#333333",
            font=ctk.CTkFont(family="Segoe UI", size=14),
            placeholder_text="Enter your password",
            show="•"                     # Hidden by default
        )
        self.password_entry.pack(fill="x", expand=True)

        # Add the eye toggle button (same color & alignment)
        self.show_password_btn = tk.Label(
            self.password_entry,          # Place inside entry widget
            text="👁",
            font=("Segoe UI", 12),
            bg="#f5f5f5",
            cursor="hand2"
        )
        self.show_password_btn.place(relx=0.93, rely=0.5, anchor="center")
        self.show_password_btn.bind('<Button-1>', lambda e: self.toggle_password())

        # Focus color change effect (same as email)
        self.password_entry.bind('<FocusIn>', lambda e: self.password_entry.configure(fg_color="#e8f4f8"))
        self.password_entry.bind('<FocusOut>', lambda e: self.password_entry.configure(fg_color="#f5f5f5"))
    def create_login_button(self, parent):
        """Create rounded login button"""
        self.login_button = ctk.CTkButton(parent,
                                      text="Login",
                                      height=45,
                                      corner_radius=25,  # 👈 Rounded corners
                                      font=ctk.CTkFont(size=15, weight="bold"),
                                      fg_color="#1a1a1a",
                                      hover_color="#333333",
                                      text_color="white",
                                      command=self.on_login_click)
        self.login_button.pack(pady=(0, 15), ipadx=20, ipady=8)
        self.login_button.bind('<Enter>', lambda e: self.login_button.configure(bg='#333333'))
        self.login_button.bind('<Leave>', lambda e: self.login_button.configure(bg='#1a1a1a'))
    
    def create_signup_link(self, parent):
        """Create sign up link"""
        signup_frame = tk.Frame(parent, bg='white')
        signup_frame.pack()
        
        tk.Label(signup_frame, text="Don't have an account?",
                font=("Segoe UI", 9), bg='white', fg='#666666').pack(side=tk.LEFT)
        
        signup_btn = tk.Label(signup_frame, text="Sign up",
                             font=("Segoe UI", 9, "bold"), bg='white', fg='#1a1a1a',
                             cursor='hand2')
        signup_btn.pack(side=tk.LEFT, padx=(5, 0))
        signup_btn.bind('<Button-1>', lambda e: self.sign_up())
        signup_btn.bind('<Enter>', lambda e: signup_btn.configure(fg='#6B5B95'))
        signup_btn.bind('<Leave>', lambda e: signup_btn.configure(fg='#1a1a1a'))
        
        tk.Label(signup_frame, text="Now!",
                font=("Segoe UI", 9), bg='white', fg='#666666').pack(side=tk.LEFT, padx=(5, 0))
    
    def create_promo_card(self):
        canvas_width = self.canvas.winfo_reqwidth() or 1200
        canvas_height = self.canvas.winfo_reqheight() or 500

        promo_x = int(canvas_width * 0.70)   # shifted right
        promo_y = int(canvas_height * 0.45)

        # Rounded frame (acts as promo card)
        promo_card = ctk.CTkFrame(
            self.canvas,
            width=500,         # Change this to control width
            height=150,        # Change this to control height
            fg_color="white",
            border_width=1,
            border_color="#e0e0e0"
        )

        # Place promo card on canvas so it can be repositioned on resize
        self.promo_window = self.canvas.create_window(promo_x, promo_y, anchor=tk.CENTER, window=promo_card)

        # Inner content area
        promo_content = ctk.CTkFrame(promo_card, fg_color="white")
        promo_content.pack(padx=20, pady=12, fill="both", expand=True)

        text_frame = tk.Frame(promo_content, bg='white')
        text_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        line1 = tk.Label(
            text_frame,
            text="Your LeadsCruise AI is capturing leads automatically !!",
            font=("Segoe UI", 12),
            bg='white',
            fg='#333333'
        )
        line1.pack(anchor=tk.W)

        arrow_btn = ctk.CTkButton(
            promo_content,
            text="↑",
            width=20,       # adjust for desired size
            height=30,
            corner_radius=15,
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
            fg_color="#1a1a1a",
            hover_color="#333333",
            text_color="white",
            cursor="hand2",
        )
        arrow_btn.pack(side="left", padx=(25, 5))

        # Apply rounded corners effect (best-effort)
        self._apply_rounded_corners(promo_card)

    def _apply_rounded_corners(self, widget):
        """Apply a rounded corner effect to the widget"""
        try:
            # For Windows 11
            widget.update_idletasks()
            hwnd = windll.user32.GetParent(widget.winfo_id())
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
            DWMWCP_ROUND = 2
            windll.dwmapi.DwmSetWindowAttribute(
                hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, 
                byref(c_int(DWMWCP_ROUND)), sizeof(c_int)
                )
        except:
            pass  # If Windows API not available, gracefully skip

    
    def on_window_resize(self, event):
        """Handle window resize to reposition elements"""
        if event.widget == self.root and self.canvas:
            # Get new dimensions
            new_width = event.width
            new_height = event.height
            
            # Recreate gradient background
            try:
                gradient = Image.new('RGB', (new_width, new_height))
                draw = ImageDraw.Draw(gradient)
                
                colors = [
                    (147, 112, 219),
                    (100, 149, 237),
                    (72, 209, 204)
                ]
                
                for y in range(new_height):
                    if y < new_height // 2:
                        ratio = y / (new_height // 2)
                        r = int(colors[0][0] + (colors[1][0] - colors[0][0]) * ratio)
                        g = int(colors[0][1] + (colors[1][1] - colors[0][1]) * ratio)
                        b = int(colors[0][2] + (colors[1][2] - colors[0][2]) * ratio)
                    else:
                        ratio = (y - new_height // 2) / (new_height // 2)
                        r = int(colors[1][0] + (colors[2][0] - colors[1][0]) * ratio)
                        g = int(colors[1][1] + (colors[2][1] - colors[1][1]) * ratio)
                        b = int(colors[1][2] + (colors[2][2] - colors[1][2]) * ratio)
                    
                    draw.rectangle([(0, y), (new_width, y+1)], fill=(r, g, b))
                
                self.bg_image = ImageTk.PhotoImage(gradient)
                self.canvas.delete("bg")
                self.canvas.create_image(0, 0, image=self.bg_image, anchor=tk.NW, tags="bg")
                self.canvas.tag_lower("bg")
            except:
                pass
            
            # Reposition login card
            if self.card_window:
                card_width = min(500, int(new_width * 0.35))
                card_height = int(new_height * 0.85)
                card_x = int(new_width * 0.08)
                card_y = int(new_height * 0.075)
                
                self.canvas.coords(self.card_window, card_x, card_y)
                self.canvas.itemconfig(self.card_window, width=card_width, height=card_height)
            
            # Reposition promo card
            if self.promo_window:
                promo_x = int(new_width * 0.70)   # keep aligned
                promo_y = int(new_height * 0.45)
                self.canvas.coords(self.promo_window, promo_x, promo_y)
    
    # Event Handlers
    
    def toggle_password(self):
        """Toggle password visibility"""
        if self.show_password_var.get():
            self.password_entry.configure(show='•')
            self.show_password_btn.configure(text='👁')
            self.show_password_var.set(False)
        else:
            self.password_entry.configure(show='')
            self.show_password_btn.configure(text='👁‍🗨')
            self.show_password_var.set(True)
    
    def forgot_password(self):
        """Handle forgot password click"""
        messagebox.showinfo("Forgot Password", 
                          "Password reset functionality coming soon!\n\n"
                          "Please contact support for assistance.")
    
    def sign_up(self):
        """Handle sign up click"""
        messagebox.showinfo("Sign Up", 
                          "Please visit https://leadscruise.com to create an account.")
    
    def on_login_click(self):
        """Handle login button click - to be overridden by parent"""
        email = self.email_var.get().strip()
        password = self.password_var.get()
        
        if not email or not password:
            messagebox.showerror("Error", "Please enter both email and password!")
            return
        
        print(f"Login attempted with: {email}")
    
    # UI State Management
    
    def show_progress(self, message="Authenticating..."):
        """Show progress indicator"""
        self.status_var.set(message)
        self.progress.pack(pady=10)
        self.progress.start()
        self.login_button.configure(state='disabled')
    
    def hide_progress(self):
        """Hide progress indicator"""
        self.progress.stop()
        self.progress.pack_forget()
        self.login_button.configure(state='normal')
    
    def show_error(self, message):
        """Show error message"""
        self.hide_progress()
        self.status_var.set(f"Error: {message}")
        messagebox.showerror("Login Error", message)
    
    def show_success(self, message="Login successful!"):
        """Show success message"""
        self.hide_progress()
        self.status_var.set(message)
    
    def get_credentials(self):
        """Get email and password"""
        return self.email_var.get().strip(), self.password_var.get()
    
    def set_email(self, email):
        """Set email field value"""
        self.email_var.set(email)
    
    def clear_fields(self):
        """Clear all input fields"""
        self.email_var.set('')
        self.password_var.set('')


# Example usage / Testing
if __name__ == "__main__":
    def test_login():
        email, password = ui.get_credentials()
        if email and password:
            ui.show_progress("Logging in...")
            root.after(2000, lambda: ui.show_success())
            root.after(3000, lambda: messagebox.showinfo("Success", "Login successful!"))
        else:
            ui.show_error("Please enter credentials")
    
    root = tk.Tk()
    ui = LoginUI(root)
    ui.on_login_click = test_login
    
    root.mainloop()



    