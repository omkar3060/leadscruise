import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";

const Sidebar = ({ isDisabled }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Get current route

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
      </div>

      <div className={styles.sidebarIcon} onClick={() => navigate("/")}>
        ↩️
      </div>
    </div>
  );
};

export default Sidebar;
