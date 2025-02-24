import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { FaWhatsapp } from "react-icons/fa"; // Import icons
import { SiGooglesheets } from "react-icons/si";

const Sidebar = ({ isDisabled }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Get current route
  const handleLogout = () => {
    // Clear localStorage items related to authentication and session
    localStorage.clear();
    navigate("/");
  };
  return (
    <div className={styles.sidebar}>
      <div className={styles.group}>
        {/* Home Button: Navigate to Master if on Master, otherwise go to Dashboard */}
        <div
          className={styles.sidebarIcon}
          onClick={() => navigate(location.pathname === "/master" ? "/master" : "/dashboard")}
        >
          🏠
        </div>

        {/* Hide Settings Button when in Master Component */}
        {location.pathname !== "/master" && (
          <div
            className={`${styles.sidebarIcon} ${isDisabled ? styles.disabled : ""}`}
            onClick={() => {
              if (isDisabled) {
                alert("You cannot go to settings while the script is running!");
              } else {
                navigate("/settings");
              }
            }}
          >
            ⚙️
          </div>
        )}

        <div className={styles.sidebarIcon} onClick={() => navigate("/whatsapp")}>
          <FaWhatsapp className={styles.icon} />
        </div>
        <div className={styles.sidebarIcon} onClick={() => navigate("/sheets")}>
          <SiGooglesheets className={styles.icon} />
        </div>
      </div>

      <div className={styles.sidebarIcon} onClick={handleLogout}>
        ↩️
      </div>
    </div>
  );
};

export default Sidebar;