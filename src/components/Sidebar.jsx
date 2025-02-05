import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css"; // Import CSS module

const Sidebar = ({ isDisabled }) => {
  const navigate = useNavigate();

  return (
    <div className={styles.sidebar}>
        <div className={styles.group}>
      <div className={styles.sidebarIcon} onClick={()=>{navigate("/dashboard")}}>🏠</div>
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
      </div>
      <div className={styles.sidebarIcon} onClick={() => navigate("/")}>
        ↩️
      </div>
    </div>
  );
};

export default Sidebar;
