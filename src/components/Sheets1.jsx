import React, { useState, useEffect } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import { useNavigate } from "react-router-dom";
import styles from "./Dashboard.module.css";

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
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 10;

  const status = localStorage.getItem("status");
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleStart = async () => {
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");
      const password = localStorage.getItem("savedPassword");
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      try {
        const credCheckRes = await axios.get(
          `https://api.leadscruise.com/api/check-user-credentials/${userEmail}`
        );
        if (credCheckRes.status !== 200) {
          alert("Please login to your leads provider account first.");
          navigate("/execute-task");
          return;
        }
      } catch (err) {
        alert(
          err.response?.data?.message || "Error checking stored credentials"
        );
        navigate("/execute-task");
        return;
      }

      if (!mobileNumber || !password) {
        alert("Please login to you leads provider account first.");
        navigate("/execute-task");
        return;
      }

      if (!userEmail) {
        alert("User email not found!");
        return;
      }

      const cycleResponse = await axios.post(
        "https://api.leadscruise.com/api/start-fetching-leads",
        {
          mobileNumber,
          password,
          uniqueId,
          userEmail,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Error:", error.response?.data?.message || error.message);
      //alert(error.response?.data?.message || error.message);
    } finally {
      setIsLoading(false); // Hide loading after process completes or fails
    }
  };

  const fetchLeads = async () => {
    try {
      setIsLoadingLeads(true);
      const userMobile = localStorage.getItem("mobileNumber");

      if (!userMobile) {
        alert("User mobile number not found!");
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-user-leads/${userMobile}`
      );

      if (response.status === 200) {
        setLeads(response.data.leads);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      alert("Error fetching leads: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

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

  const getSettingsFromStorage = () => {
    try {
      const settings = localStorage.getItem('settings');
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error parsing settings from localStorage:', error);
      return null;
    }
  };

  // Function to update settings in localStorage
  const updateSettingsInStorage = (updatedSettings) => {
    try {
      localStorage.setItem('settings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error updating settings in localStorage:', error);
    }
  };

  // Function to handle toggle action
  const handleToggleRejected = async (leadProduct, isCurrentlyRejected) => {
  const action = isCurrentlyRejected ? 'remove from' : 'add to';
  const confirmMessage = `Are you sure you want to ${action} the rejected list?\n\nProduct: ${leadProduct}`;
  
  if (!window.confirm(confirmMessage)) {
    return; // User cancelled the action
  }
    try {
      const settings = getSettingsFromStorage();
      if (!settings) {
        console.error('No settings found in localStorage');
        return;
      }

      let updatedH2WordArray = [...(settings.h2WordArray || [])];

      if (isCurrentlyRejected) {
        // Remove from rejected list
        updatedH2WordArray = updatedH2WordArray.filter(item => item !== leadProduct);
      } else {
        // Add to rejected list
        if (!updatedH2WordArray.includes(leadProduct)) {
          updatedH2WordArray.push(leadProduct);
        }
      }

      // Update settings object
      const updatedSettings = {
        ...settings,
        h2WordArray: updatedH2WordArray
      };

      // Update localStorage
      updateSettingsInStorage(updatedSettings);

      // Make API call to update database
      const response = await fetch('https://api.leadscruise.com/api/settings/toggle-rejected-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadProduct: leadProduct,
          action: isCurrentlyRejected ? 'remove' : 'add',
          userEmail: settings.userEmail
        })
      });

      if (response.ok) {
        console.log('Lead status updated successfully');
        alert(`Lead ${isCurrentlyRejected ? 'removed from' : 'added to'} rejected list successfully!`);
        setRefreshTrigger(prev => prev + 1);
        // Force re-render by updating a state variable if needed
        // You might want to call a function to refresh the component
      } else {
        console.error('Failed to update lead status in database');
        // Revert localStorage changes if API call fails
        updateSettingsInStorage(settings);
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  // Check if a lead is in the rejected list by comparing product text
  const isLeadRejected = (leadProduct) => {
    const settings = getSettingsFromStorage();
    if (!settings || !settings.h2WordArray) {
      return false;
    }
    return settings.h2WordArray.includes(leadProduct);
  };

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
      {/* {isLoading && <LoadingScreen />} */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Leads purchased in the past 30 days</h2>
            </div>

            {isLoadingLeads ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  backgroundColor: '#fefefe',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px',
                  margin: '40px auto',
                }}
              >
                <div style={{ fontSize: '40px', color: '#999', marginBottom: '16px' }}>
                  <span role="img" aria-label="no leads">📭</span>
                </div>
                <h3 style={{ color: '#555', marginBottom: '8px' }}>No leads found</h3>
                <p style={{ color: '#777', fontSize: '14px' }}>
                  We couldn't find any leads in the last 30 days. Try to fetch them by clicking on the start button.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: '20px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '0px',
                  }}
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.leadsTable} >
                  <thead>
                    <tr>
                      <th>Product Requested</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, index) => {
                      const isRejected = isLeadRejected(lead.lead_bought);
                      return (
                        <tr key={lead._id || index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa' }}>
                          <td>{lead.lead_bought}</td>
                          <td>{lead.name}</td>
                          <td>{lead.email || 'N/A'}</td>
                          <td>{lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : lead.mobile}</td>
                          <td>{formatDate(lead.createdAt)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleRejected(lead.lead_bought, isRejected)}
                              style={{
                                padding: '8px 0px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '22px',
                                backgroundColor: 'transparent',
                                transition: 'transform 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                                height: '40px',
                              }}
                              onMouseOver={(e) => {
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.transform = 'scale(1)';
                              }}
                              title={isRejected ? 'Remove from Rejected' : 'Add to Rejected'}
                            >
                              {isRejected ? '🚩' : '🏳️'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sheets;
