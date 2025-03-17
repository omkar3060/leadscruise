import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { FaWhatsapp } from "react-icons/fa";
import { SiGooglesheets } from "react-icons/si";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { AiOutlineHome } from "react-icons/ai";

const Sidebar = ({ status }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
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

        {!location.pathname.includes("/master") && (
          <>
            <div
              className={`${styles.sidebarIcon} ${status === "Running" ? styles.disabled : ""}`}
              onClick={() => {
                console.log("Status in Sidebar:", status);
                if (status === "Running") {
                  alert("You cannot go to settings while the script is running!");
                } else {
                  navigate("/settings");
                }
              }}
            >
              <FiSettings className={styles.icon} />
            </div>

            <div className={styles.sidebarIcon} onClick={() => navigate("/whatsapp")}>
              <FaWhatsapp className={styles.icon} />
            </div>

            <div className={styles.sidebarIcon} onClick={() => navigate("/sheets")}>
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
