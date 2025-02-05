import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Profile.module.css"; // Importing module CSS
import Sidebar from "./Sidebar";
import ProfileCredentials from "./ProfileCredentials";

const Profile = () => {
  const navigate = useNavigate();
  const [billingHistory, setBillingHistory] = useState([]);
  const userEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    // Fetch billing history based on userEmail
    const fetchBillingHistory = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/payments?email=${userEmail}`);
        const data = await response.json();
        setBillingHistory(data); // Update billingHistory with the fetched data
      } catch (error) {
        console.error("Error fetching billing history:", error);
      }
    };

    fetchBillingHistory();
  }, [userEmail]);

  return (
    <div className={styles["profile-page-wrapper"]}>
      {/* Sidebar */}
      <Sidebar />

      {/* Fixed Dashboard Header */}
      <header className={styles["dashboard-header"]}>
        <div className={styles["header-content"]}>
          <div className={styles["status-section"]}>
            <div
              className={styles["status-label"]}
              onClick={() => navigate("/dashboard")}
            >
              Return to Dashboard
            </div>
          </div>
          <div className={styles["profile-section"]}>
            <button className={styles["profile-button"]}>Profile</button>
            <div>
              <p className={styles["renewal-text"]}>
                Subscription Status: ACTIVE
              </p>
              <p className={styles["renewal-text"]}>
                Subscription next renewal date: 11/01/2025
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Profile Container */}
      <div className={styles["profile-scroll-container"]}>
        <div className={styles["profile-content-layout"]}>
          {/* Left Section: Tables */}
          <div className={styles["left-section"]}>
            {/* Billing History Table */}
            <div className={styles["table-container"]}>
              <h2>My Billing History</h2>
              <table className={styles["billing-table"]}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subscription Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Amount Paid</th>
                    <th>Order ID</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.length > 0 ? (
                    billingHistory.map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>Monthly Subscription</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          {new Date(new Date(item.created_at).setDate(new Date(item.created_at).getDate() + 28)).toLocaleDateString()}
                        </td>

                        <td>{`INR ${item.order_amount}`}</td>
                        <td>{item.unique_id}</td>
                        <td>
                          <button className={styles["download-button"]}>
                            Download GST receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7">No billing history available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Billing Details Section */}
            <div className={styles["table-container"]}>
              <h2>My Billing Details</h2>
              <div>
                <p>
                  <strong>Billing Phone Number:</strong> 9579797269
                </p>
                <p>
                  <strong>Billing GST Number:</strong> 27AAAPA1234A1Z5
                </p>
                <p>
                  <strong>PAN details:</strong> EWCPM2480L
                </p>
                <p>
                  <strong>Name:</strong> Focus Engineering Products Pvt Ltd
                </p>
                <p>
                  <strong>Address:</strong> Sr no. 67, behind Hotel Vishwavilas,
                  Landewadi, Bhosari, Pune, Pimpri-Chinchwad, Maharashtra 411039
                </p>
              </div>
              <button className={styles["edit-button"]}>Edit my Details</button>
            </div>
          </div>

          {/* Right Section: Profile Credentials */}
          <ProfileCredentials />
        </div>
      </div>
    </div>
  );
};

export default Profile;
