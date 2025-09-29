import tkinter as tk
import threading
import pystray
from PIL import Image, ImageDraw

class TrayApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Minimize to Tray Example")
        self.root.geometry("400x200")
        self.tray_icon = None

        tk.Label(root, text="Close this window (X) to minimize to tray").pack(pady=50)

        # ✅ Override close button
        self.root.protocol("WM_DELETE_WINDOW", self.minimize_to_tray)

    def create_icon_image(self):
        """Creates a simple icon for tray"""
        image = Image.new("RGB", (64, 64), color=(0, 122, 204))
        draw = ImageDraw.Draw(image)
        draw.rectangle([16, 16, 48, 48], fill=(255, 255, 255))
        return image

    def minimize_to_tray(self):
        """Hide window and show tray icon"""
        self.root.withdraw()  # Hide the window
        if self.tray_icon is None:
            self.tray_icon = pystray.Icon(
                "TrayApp",
                self.create_icon_image(),
                "App is running",
                menu=pystray.Menu(
                    pystray.MenuItem("Show App", self.show_window),
                    pystray.MenuItem("Exit", self.quit_app)
                )
            )

        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def show_window(self, icon=None, item=None):
        """Restore the window"""
        if self.tray_icon:
            self.tray_icon.stop()
            self.tray_icon = None
        self.root.deiconify()  # Show the window again
        self.root.lift()

    def quit_app(self, icon=None, item=None):
        """Quit completely"""
        if self.tray_icon:
            self.tray_icon.stop()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = TrayApp(root)
    root.mainloop()
