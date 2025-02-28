import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Profile.module.css"; // Importing module CSS
import Sidebar from "./Sidebar";
import ProfileCredentials from "./ProfileCredentials";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";

const Profile = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const [isHovering, setIsHovering] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    email: userEmail,
    phone: "",
    gst: "",
    pan: "",
    name: "",
    address: "",
  });
  const status = localStorage.getItem("status");
  const [billingHistory, setBillingHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false); // Toggle edit mode
  const [daysLeft, setDaysLeft] = useState(null);
  
  useEffect(() => {
    // Combined data loading effect
    const loadData = async () => {
      setIsLoading(true); // Start loading
      
      try {
        // Load subscription details
        const storedSubscription = localStorage.getItem("subscriptionDetails");
        if (storedSubscription) {
          const parsedSubscription = JSON.parse(storedSubscription);
          setSubscriptionDetails(parsedSubscription);

          // Calculate days left
          const renewalDate = new Date(parsedSubscription.renewal_date);
          const currentDate = new Date();
          const timeDifference = renewalDate - currentDate;
          const remainingDays = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
          setDaysLeft(remainingDays);
        }

        // Fetch billing history
        const historyResponse = await fetch(`http://localhost:5000/api/payments?email=${userEmail}`);
        const historyData = await historyResponse.json();
        setBillingHistory(historyData);

        // Fetch billing details
        const detailsResponse = await fetch(`http://localhost:5000/api/billing/${userEmail}`);
        const detailsResult = await detailsResponse.json();
        if (detailsResult.success) {
          setBillingDetails(detailsResult.data);
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      } finally {
        // Add a small delay to prevent flickering for fast loads
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    loadData();
  }, [userEmail]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setBillingDetails({ ...billingDetails, [name]: value });
  };

  // Save Updated Billing Details
  const handleSave = async () => {
    try {
      setIsLoading(true); // Show loading while saving
      
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
    } finally {
      setIsLoading(false); // Hide loading when done
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      setIsLoading(true); // Show loading while downloading
      
      const response = await axios.get(`http://localhost:5000/api/get-invoice/${orderId}`, {
        responseType: "blob", // Get binary data
      });

      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = fileURL;
      link.setAttribute("download", `invoice-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error("Error downloading invoice:", error);
      alert("Invoice not found.");
    } finally {
      setIsLoading(false); // Hide loading when done
    }
  };

  const calculateEndDate = (startDate, subscriptionType) => {
    const start = new Date(startDate);

    switch (subscriptionType.toLowerCase()) {
      case "one month":
        start.setDate(start.getDate() + 30); // Approximate month duration
        break;
      case "6 months":
        start.setDate(start.getDate() + 180);
        break;
      case "yearly":
        start.setDate(start.getDate() + 365);
        break;
      default:
        // Fallback (assumed monthly if unknown)
        start.setDate(start.getDate() + 30);
    }

    return start.toLocaleDateString();
  };

  // Loading Screen Component
  const LoadingScreen = () => (
    <div className={styles["loading-overlay"]}>
      <div className={styles["loading-container"]}>
        <div className={styles["loading-spinner"]}></div>
        <p className={styles["loading-text"]}>Loading your profile data...</p>
        <div className={styles["loading-progress-dots"]}>
          <div className={styles["loading-dot"]}></div>
          <div className={styles["loading-dot"]}></div>
          <div className={styles["loading-dot"]}></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles["profile-page-wrapper"]}>
      {/* Show loading overlay when data is being fetched */}
      {isLoading && <LoadingScreen />}
      
      {/* Sidebar */}
      <Sidebar status={status}/>

      {/* Fixed Dashboard Header */}
      <DashboardHeader />

      {/* Scrollable Profile Container */}
      <div className={styles["profile-scroll-container"]}>
        <div className={styles["profile-content-layout"]}>
          {/* Left Section: Tables */}
          <div className={styles["left-section"]}>
            {/* Billing History Table */}
            <div className={styles["table-container"]}>
              <table className={styles["billing-table"]}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>My Billing History</th>
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
                        <td>{item.subscription_type}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          {calculateEndDate(item.created_at, item.subscription_type)}
                        </td>
                        <td>{`INR ${item.order_amount / 100}`}</td>
                        <td>{item.unique_id}</td>
                        <td>
                          <button
                            className={styles["download-button"]}
                            onClick={() => handleDownloadInvoice(item.unique_id)}
                          >
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

            {/* Billing Details and Subscription Status Wrapper */}
            <div className={styles["billing-and-subscription-container"]}>
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
                        <p className={styles["billing-address-text"]}><strong>Email:</strong> {billingDetails.email}</p>
                      </div>
                      <div className={styles["edit-button-container"]}>
                      <button className={styles["edit-button"]} onClick={() => setIsEditing(true)}>Edit my Details</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Profile Credentials */}
          <ProfileCredentials isProfilePage={true} />
        </div>
      </div>
    </div>
  );
};

export default Profile;