import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { FaWhatsapp } from "react-icons/fa";
import { SiGooglesheets } from "react-icons/si";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { AiOutlineHome } from "react-icons/ai";
import { MdOutlineRecommend } from "react-icons/md"; // Import referral icon
import axios from "axios";

const Sidebar = ({ status }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Effect to check status and redirect from settings if running
  useEffect(() => {
    if (status === "Running" && location.pathname === "/settings") {
      alert("You cannot access settings while the AI is running!");
      // Redirect back to dashboard
      if (location.pathname.includes("/master")) {
        navigate("/master");
      } else {
        navigate("/dashboard");
      }
    }
  }, [status, location.pathname, navigate]);

  const handleLogout = async () => {
    const isConfirmed = window.confirm("Are you sure you want to logout?");
    
    if (!isConfirmed) return; // Stop if user cancels
  
    const userEmail = localStorage.getItem("userEmail");
  
    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });
  
      localStorage.clear();
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://leadscruise.com"
          : "http://localhost:3000";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };  

  const handleNavigation = () => {
    if (location.pathname.includes("/master")) {
      navigate("/master");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.group}>
        <div className={`${styles.sidebarIcon} ${styles.tooltip}`} onClick={handleNavigation}>
          <AiOutlineHome className={styles.icon}/>
          <span className={styles.tooltipText}>Home</span>
        </div>

        {location.pathname.includes("/master") && (
          <div
            className={`${styles.sidebarIcon} ${styles.tooltip}`}
            onClick={() => navigate("/master/referrals")}
          >
            <MdOutlineRecommend className={styles.icon} />
            <span className={styles.tooltipText}>Referrals</span>
          </div>
        )}

        {!location.pathname.includes("/master") && (
          <>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip} ${
                status === "Running" ? styles.disabled : ""
              }`}
              onClick={() => {
                console.log("Status in Sidebar:", status);
                if (status === "Running") {
                  alert(
                    "You cannot go to settings while the AI is running!"
                  );
                } else {
                  navigate("/settings");
                }
              }}
            >
              <FiSettings className={styles.icon} />
              <span className={styles.tooltipText}>Settings</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/whatsapp")}
            >
              <FaWhatsapp className={styles.icon} />
              <span className={styles.tooltipText}>WhatsApp</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/sheets")}
            >
              <SiGooglesheets className={styles.icon} />
              <span className={styles.tooltipText}>Sheets</span>
            </div>
          </>
        )}
      </div>
      <div className={`${styles.sidebarIcon} ${styles.tooltip}`} onClick={handleLogout}>
        <FiLogOut className={styles.icon} />
        <span className={styles.tooltipText}>Logout</span>
      </div>
    </div>
  );
};

export default Sidebar;
