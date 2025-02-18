import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Profile.module.css"; // Importing module CSS
import Sidebar from "./Sidebar";
import ProfileCredentials from "./ProfileCredentials";
import axios from "axios";
const Profile = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });

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
  const [daysLeft, setDaysLeft] = useState(null);
  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  useEffect(() => {
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
  }, []);

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

  const handleDownloadInvoice = async (orderId) => {
    try {
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
            <div className={styles["status-box-header"]}>
              <div className={styles["left-content"]}>
                <div className={styles["days-info"]}>
                  <p className={styles["days-left"]}>Days till end:</p>
                  <h2 className={styles["days-left-count"]}>
                    {daysLeft !== null ? `${daysLeft} days left` : "Loading..."}
                  </h2>
                </div>
              </div>
              <button className={styles["renew-button"]} onClick={() => navigate("/plans")}>
                Renew now
              </button>
            </div>

            <div>
              <p className={styles["renewal-text"]}>
                Subscription Status: {subscriptionDetails.status}
              </p>
              <p className={styles["renewal-text"]}>
                Subscription next renewal date: {subscriptionDetails.renewal_date}
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
                      </div>

                      <button className={styles["edit-button"]} onClick={() => setIsEditing(true)}>Edit my Details</button>
                    </>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Right Section: Profile Credentials */}
          <ProfileCredentials isProfilePage={true}/>
        </div>
      </div>
    </div>
  );
};

export default Profile;
