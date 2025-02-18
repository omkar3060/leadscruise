import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./Header.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";

const DashboardHeader = ({ status, handleStart, handleStop, isDisabled }) => {
  const navigate = useNavigate();
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail"); // Assuming email is stored in localStorage
        if (!userEmail) return;

        const response = await axios.get(`http://localhost:5000/api/get-subscription/${userEmail}`);
        setSubscriptionDetails(response.data);
        localStorage.setItem("subscriptionDetails", JSON.stringify(response.data));
      } catch (error) {
        console.error("Error fetching subscription details:", error);
        setSubscriptionDetails({ renewal_date: "Unavailable", status: "Unavailable" });
      }
    };

    fetchSubscriptionDetails();
  }, []);

  return (
    <div className={styles.dashboardHeader}>
      <div className={styles.statusSection}>
        <div className={styles.statusLabel}>Status: {status}</div>
        <div className={styles.startStopButtons}>
          <button className={styles.startButton} onClick={handleStart}>Start</button>
          <button
            className={styles.stopButton}
            onClick={handleStop}
            disabled={!isDisabled}
          >
            Stop
          </button>
        </div>
      </div>
      <div className={styles.profileSection}>
        <button className={styles.profileButton} onClick={() => navigate("/profile")}>Profile</button>
        <p className={styles.renewalText}>
          Subscription Next Renewal Date: {subscriptionDetails.renewal_date}
        </p>
        <p className={styles.renewalText}>
          Subscription Status: {subscriptionDetails.status}
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
