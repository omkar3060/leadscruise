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
      alert("You cannot access settings while the script is running!");
      // Redirect back to dashboard
      if (location.pathname.includes("/master")) {
        navigate("/master");
      } else {
        navigate("/dashboard");
      }
    }
  }, [status, location.pathname, navigate]);

  const handleLogout = async () => {
    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      if (window.location.hostname === "app.leadscruise.com") {
        window.location.href = "https://leadscruise.com"; // Replace with actual landing page URL
      } else {
        window.location.href = "http://localhost:3000"; // Local development
      }
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
        <div className={styles.sidebarIcon} onClick={handleNavigation}>
          <AiOutlineHome className={styles.icon} />
        </div>

        {location.pathname.includes("/master") && (
          <div
            className={styles.sidebarIcon}
            onClick={() => navigate("/master/referrals")}
          >
            <MdOutlineRecommend className={styles.icon} />
          </div>
        )}

        {!location.pathname.includes("/master") && (
          <>
            <div
              className={`${styles.sidebarIcon} ${
                status === "Running" ? styles.disabled : ""
              }`}
              onClick={() => {
                console.log("Status in Sidebar:", status);
                if (status === "Running") {
                  alert(
                    "You cannot go to settings while the script is running!"
                  );
                } else {
                  navigate("/settings");
                }
              }}
            >
              <FiSettings className={styles.icon} />
            </div>
            <div
              className={styles.sidebarIcon}
              onClick={() => navigate("/whatsapp")}
            >
              <FaWhatsapp className={styles.icon} />
            </div>
            <div
              className={styles.sidebarIcon}
              onClick={() => navigate("/sheets")}
            >
              <SiGooglesheets className={styles.icon} />
            </div>
          </>
        )}
      </div>
      <div className={styles.sidebarIcon} onClick={handleLogout}>
        <FiLogOut className={styles.icon} />
      </div>
    </div>
  );
};

export default Sidebar;
