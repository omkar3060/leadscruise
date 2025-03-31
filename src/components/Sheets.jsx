import React, { useState, useEffect } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";

const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="spinner">
        <div className="double-bounce1"></div>
        <div className="double-bounce2"></div>
      </div>
      <div className="loading-text">
        <h3>Loading...</h3>
        <div className="loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
      <p className="loading-message">Please wait</p>
    </div>
  </div>
);

const Sheets = () => {
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const status = localStorage.getItem("status");
  console.log("Status in Sidebar:", status);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sheetsId, setSheetsId] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const userEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`https://api.leadscruise.com/api/get-api-key/${userEmail}`);
        if (response.data.success) {
          setApiKey(response.data.user.apiKey || "Not Available");
          setNewApiKey(response.data.user.apiKey || "Not Available");
          setSheetsId(response.data.user.sheetsId || "");
        } else {
          setApiKey("Not Available");
        }
      } catch (error) {
        console.error("Error fetching API Key or Sheet Info:", error);
      }
      setIsLoading(false);
    };
    fetchUserData();
  }, []);

  const updateApiKey = async () => {
    if (apiKey === newApiKey) {
      alert("New API Key cannot be the same as the current one!");
      return;
    }
    if (!newApiKey) {
      alert("API Key cannot be empty!");
      return;
    }

    const confirmUpdate = window.confirm("Are you sure you want to update your API Key?");
    if (!confirmUpdate) return;

    try {
      const response = await axios.put("https://api.leadscruise.com/api/update-api-key", {
        email: userEmail,
        newApiKey,
      });

      if (response.data.success) {
        alert("API Key updated successfully!");
        setApiKey(newApiKey);
        setNewApiKey(newApiKey);
      } else {
        alert("Failed to update API Key.");
      }
    } catch (error) {
      console.error("Error updating API Key:", error);
      alert("An error occurred while updating API Key.");
    }
  };

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
      {isLoading && <LoadingScreen />}
      {(windowWidth > 768 || sidebarOpen) && <Sidebar status={status} />}
      <DashboardHeader
        style={windowWidth <= 768 ? {
          left: 0,
          width: "100%",
          marginLeft: 0,
          padding: "15px"
        } : {}}
      />
      <div className="settings-scroll-container">
        <div className="sheets-container">
          <div className="table-container">
            <h2>Google Sheets Status</h2>
            {sheetsId && apiKey ? (
              <>
                <div>
                  <p style={{ color: "green", fontWeight: "bold", fontSize: "2rem" }}>Active ✅</p>
                  <p style={{ fontSize: "1.1rem" }}>
                    Your Google Sheet is ready:{" "}
                    <a href={`https://docs.google.com/spreadsheets/d/${sheetsId}`} target="_blank" rel="noopener noreferrer">View Sheet</a>
                  </p>

                  {/* New content inside table-container */}

                  {/* Styled API Key Field */}
                  <div className="api-key-container">
                    <label className="api-key-label">Your API Key:</label>
                    <input
                      type="text"
                      className="api-key-input"
                      value={newApiKey}
                      placeholder="Enter new API Key..."
                      onChange={(e) => setNewApiKey(e.target.value)}
                      disabled={!isEditing} // Disable editing initially
                    />

                    {!isEditing ? (
                      // Show "Edit" button initially
                      <button className="update-api-btn" onClick={() => setIsEditing(true)}>
                        Edit
                      </button>
                    ) : (
                      // Show "Update API Key" button only after clicking "Edit"
                      <button className="update-api-btn" onClick={updateApiKey}>
                        Update API Key
                      </button>
                    )}
                  </div>
                </div>

                <div className="support-info">
                  <h3 className="support-info__title">
                    <svg xmlns="http://www.w3.org/2000/svg" className="support-info__title-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    Need Help?
                  </h3>
                  <div className="support-info__content">
                    <p className="support-info__paragraph">
                      <svg xmlns="http://www.w3.org/2000/svg" className="support-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      If you encounter any issues, contact our support team at &nbsp;{' '}
                      <a href="mailto:support@leadscruise.com" className="support-info__link">
                        support@leadscruise.com
                      </a>
                    </p>
                    <p className="support-info__paragraph">
                      <svg xmlns="http://www.w3.org/2000/svg" className="support-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      For FAQs, visit our&nbsp;{' '}
                      <a href="https://leadscruise.com" className="support-info__link support-info__link--with-icon">
                        Landing Page
                        <svg xmlns="http://www.w3.org/2000/svg" className="support-info__external-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </a>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: "red", fontWeight: "bold", fontSize: "2rem" }}>Inactive ❌</p>
                <p style={{ fontSize: "1.1rem" }}>Please wait until our support team updates it.</p>
              </>
            )}
          </div>
          <ProfileCredentials isProfilePage={true} />
        </div>
      </div>
    </div>
  );
};

export default Sheets;
