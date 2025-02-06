import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Profile.module.css"; // Importing module CSS
import Sidebar from "./Sidebar";
import ProfileCredentials from "./ProfileCredentials";

const Profile = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");

  const [billingDetails, setBillingDetails] = useState({
    email: userEmail,
    phone: "",
    gst: "",
    pan: "",
    name: "",
    address: "",
  });

  const [billingHistory, setBillingHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false); // Toggle edit mode

  useEffect(() => {
    // Fetch billing history
    const fetchBillingHistory = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/payments?email=${userEmail}`);
        const data = await response.json();
        setBillingHistory(data);
      } catch (error) {
        console.error("Error fetching billing history:", error);
      }
    };

    // Fetch billing details
    const fetchBillingDetails = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/billing/${userEmail}`);
        const result = await response.json();
        if (result.success) {
          setBillingDetails(result.data); // Set existing billing details
        }
      } catch (error) {
        console.error("Error fetching billing details:", error);
      }
    };

    fetchBillingHistory();
    fetchBillingDetails();
  }, [userEmail]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setBillingDetails({ ...billingDetails, [name]: value });
  };

  // Save Updated Billing Details
  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/billing/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billingDetails),
      });

      const result = await response.json();
      if (result.success) {
        alert("Billing details updated successfully!");
        setIsEditing(false); // Exit edit mode
      } else {
        alert("Failed to update billing details.");
      }
    } catch (error) {
      console.error("Error updating billing details:", error);
    }
  };

  return (
    <div className={styles["profile-page-wrapper"]}>
      {/* Sidebar */}
      <Sidebar />

      {/* Fixed Dashboard Header */}
      <header className={styles["dashboard-header"]}>
        <div className={styles["header-content"]}>
          <div className={styles["status-section"]}>
            <div className={styles["status-label"]} onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </div>
          </div>
          <div className={styles["profile-section"]}>
            <button className={styles["profile-button"]}>Profile</button>
            <div>
              <p className={styles["renewal-text"]}>Subscription Status: ACTIVE</p>
              <p className={styles["renewal-text"]}>Subscription next renewal date: 11/01/2025</p>
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
                          <button className={styles["download-button"]}>Download GST receipt</button>
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
            <div className={styles["billing-details"]}>
              <div className={styles["billing-header"]}>My Billing Details</div>
              <div className={styles["billing-info"]}>
                {isEditing ? (
                  <>
                    <div className={styles["billing-row"]}>
                      <div className={styles["billing-item"]}>
                        <strong>Phone:</strong>
                        <input type="text" name="phone" value={billingDetails.phone} onChange={handleChange} />
                      </div>
                      <div className={styles["billing-item"]}>
                        <strong>GST:</strong>
                        <input type="text" name="gst" value={billingDetails.gst} onChange={handleChange} />
                      </div>
                      <div className={styles["billing-item"]}>
                        <strong>PAN:</strong>
                        <input type="text" name="pan" value={billingDetails.pan} onChange={handleChange} />
                      </div>
                    </div>

                    <div className={styles["billing-address"]}>
                      <p className={styles["billing-address-text"]}>
                        <strong>Name:</strong>
                        <input type="text" name="name" value={billingDetails.name} onChange={handleChange} />
                      </p>
                      <p className={styles["billing-address-text"]}>
                        <strong>Address:</strong>
                        <textarea name="address" value={billingDetails.address} onChange={handleChange}></textarea>
                      </p>
                    </div>

                    <button className={styles["save-button"]} onClick={handleSave}>Save</button>
                    <button className={styles["cancel-button"]} onClick={() => setIsEditing(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className={styles["billing-row"]}>
                      <div className={styles["billing-item"]}>
                        <strong>Phone:</strong> <span>{billingDetails.phone}</span>
                      </div>
                      <div className={styles["billing-item"]}>
                        <strong>GST:</strong> <span>{billingDetails.gst}</span>
                      </div>
                      <div className={styles["billing-item"]}>
                        <strong>PAN:</strong> <span>{billingDetails.pan}</span>
                      </div>
                    </div>

                    <div className={styles["billing-address"]}>
                      <p className={styles["billing-address-text"]}><strong>Name:</strong> {billingDetails.name}</p>
                      <p className={styles["billing-address-text"]}><strong>Address:</strong> {billingDetails.address}</p>
                    </div>

                    <button className={styles["edit-button"]} onClick={() => setIsEditing(true)}>Edit my Details</button>
                  </>
                )}
              </div>
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
