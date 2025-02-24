import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./Header.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";

const DashboardHeader = ({ status, handleStart, handleStop, isDisabled }) => {
  const navigate = useNavigate();
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
    unique_id: "Loading...",
  });
  const [showPopup, setShowPopup] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false); // New state to track subscription status

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
          console.warn("No user email found in localStorage.");
          return;
        }

        const response = await axios.get(`https://api.leadscruise.com/api/get-subscription/${userEmail}`);
        const { renewal_date, status, unique_id } = response.data;

        if (!unique_id) {
          console.warn("Unique ID is missing from the response.");
        } else {
          localStorage.setItem("unique_id", unique_id);
        }

        setSubscriptionDetails({ renewal_date, status, unique_id });
        localStorage.setItem("subscriptionDetails", JSON.stringify(response.data));

        // Check days left for renewal
        const renewalDate = new Date(renewal_date);
        const today = new Date();
        const diffTime = renewalDate - today;
        const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert ms to days

        setDaysLeft(remainingDays);

        // Update subscription status (active if renewal date is in the future)
        setIsSubscriptionActive(remainingDays > 0);

        // Fix: Correct the key name and type check
        const popupDismissed = localStorage.getItem("popupDismissed");
        if (remainingDays > 0 && remainingDays < 3 && popupDismissed !== "true") {
          setShowPopup(true);
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error.response?.data || error.message);
        setSubscriptionDetails({ renewal_date: "Unavailable", status: "Unavailable", unique_id: "Unavailable" });
      }
    };

    fetchSubscriptionDetails();
  }, []);

  // Prevent starting the script if the subscription is expired
  const handleStartScript = () => {
    if (!isSubscriptionActive) {
      alert("Your subscription has expired. Please renew to start the script.");
      navigate("/plans"); // Redirect to subscription page
      return;
    }
    handleStart(); // Call the actual handleStart function if subscription is active
  };

  // When popup is closed, store the dismissal in localStorage
  const handleClosePopup = () => {
    setShowPopup(false);
    localStorage.setItem("popupDismissed", "true"); // Store as string "true"
  };

  return (
    <div className={styles.dashboardHeader}>
      {/* Subscription Expiry Popup */}
      {showPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            <h2>⚠️ Subscription Expiring Soon!</h2>
            <p>Your subscription will expire in {daysLeft} day(s). Please renew it to continue using the service.</p>
            <button onClick={() => navigate("/plans")} className={styles.renewButton}>
              Renew Now
            </button>
            <button onClick={handleClosePopup} className={styles.closeButton}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className={styles.statusSection}>
        <div className={styles.statusLabel}>Status: {status}</div>
        <div className={styles.startStopButtons}>
          <button className={styles.startButton} onClick={handleStartScript}>Start</button>
          <button className={styles.stopButton} onClick={handleStop} disabled={!isDisabled}>
            Stop
          </button>
        </div>
      </div>

      <div className={styles.profileSection}>
        <button className={styles.profileButton} onClick={() => navigate("/profile")}>Profile</button>
        <p className={styles.renewalText}>Subscription Next Renewal Date: {subscriptionDetails.renewal_date}</p>
        <p className={styles.renewalText}>Subscription Status: {subscriptionDetails.status}</p>
      </div>
    </div>
  );
};

export default DashboardHeader;