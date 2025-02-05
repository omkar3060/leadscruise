import React from "react";
import styles from "./Header.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";

const DashboardHeader = ({ status, handleStart, handleStop, isDisabled, timer }) => {
  const navigate = useNavigate();
  return (
    <div className={styles.dashboardHeader}>
      <div className={styles.statusSection}>
        <div className={styles.statusLabel}>Status: {status}</div>
        <div className={styles.startStopButtons}>
          <button className={styles.startButton} onClick={handleStart}>
            Start
          </button>
          <button
            className={styles.stopButton}
            onClick={handleStop}
            disabled={!isDisabled} // Disable the button when the script is not running
          >
            Stop
          </button>
        </div>
      </div>
      <div className={styles.profileSection}>
        <button className={styles.profileButton} onClick={()=>{navigate("/profile")}}>Profile</button>
        <p className={styles.renewalText}>
          Subscription next renewal date: 11/01/2025
        </p>
        <p className={styles.renewalText}>
          Subscription Status: ACTIVE
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
