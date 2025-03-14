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

  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const [sheetsId, setSheetsId] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const userEmail = localStorage.getItem("userEmail");
  useEffect(() => {
    const fetchUserData = async () => {
      axios.get(`http://localhost:5000/api/get-api-key/${userEmail}`)
        .then((response) => {
          if (response.data.success) {
            setApiKey(response.data.user.apiKey || "Not Available");
            setSheetsId(response.data.user.sheetsId || ""); // Fetch existing Sheets ID
          } else {
            setApiKey("Not Available");
          }
        })
        .catch((error) => console.error("Error fetching API Key:", error));
      setIsLoading(false);
    };
    fetchUserData();
  }, []);

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
      {/* Loading Screen */}
      {isLoading && <LoadingScreen />}

      {/* Conditional Sidebar Component */}
      {(windowWidth > 768 || sidebarOpen) && (
        <Sidebar isDisabled={isDisabled} />
      )}

      {/* Fixed Dashboard Header */}
      <DashboardHeader
        style={windowWidth <= 768 ? {
          left: 0,
          width: '100%',
          marginLeft: 0,
          padding: '15px'
        } : {}}
      />

      {/* Scrollable Settings Container */}
      <div className="settings-scroll-container">
        <div className="sheets-container">
          <div className="table-container">
            <h2>Google Sheets Status</h2>
            {sheetsId && apiKey ? (
              <>
                <p style={{ color: "green", fontWeight: "bold", fontSize: "2rem" }}>Active ✅</p>
                <p style={{ fontSize: "1.1rem" }}>
                  Your Google Sheet is ready: <a href={`https://docs.google.com/spreadsheets/d/${sheetsId}`} target="_blank" rel="noopener noreferrer">View Sheet</a>
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "red", fontWeight: "bold", fontSize: "2rem" }}>Inactive ❌</p>
                <p style={{ fontSize: "1.1rem" }}>Please wait until our support team updates it.</p>
              </>
            )}
          </div>
          {/* Profile Section */}
          <ProfileCredentials isProfilePage={true} />
        </div>
      </div>

    </div>
  );
};

export default Sheets;