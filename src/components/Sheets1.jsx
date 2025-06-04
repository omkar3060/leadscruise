import React, { useState, useEffect } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import { useNavigate } from "react-router-dom";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 10;
  
  const status = localStorage.getItem("status");
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");

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

  const fetchLeads = async (page = 1) => {
    try {
      setIsLoadingLeads(true);
      const userMobile = localStorage.getItem("mobileNumber");
      
      if (!userMobile) {
        alert("User mobile number not found!");
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-user-leads/${userMobile}?page=${page}&limit=${leadsPerPage}`
      );

      if (response.status === 200) {
        setLeads(response.data.leads);
        setTotalPages(response.data.totalPages);
        setTotalLeads(response.data.totalLeads);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      alert("Error fetching leads: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchLeads(newPage);
    }
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
          <div className="table-container whatsapp-settings-table">
            <button onClick={handleStart} style={{ marginBottom: '20px' }}>
            Start
          </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Leads ({totalLeads})</h2>
              <button 
                onClick={() => fetchLeads(currentPage)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </div>
            
            {isLoadingLeads ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                No leads found
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Email</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Mobile</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Lead Source</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead, index) => (
                        <tr key={lead._id || index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa' }}>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{lead.name}</td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{lead.email || 'N/A'}</td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{lead.mobile}</td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{lead.lead_bought}</td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{formatDate(lead.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Previous
                    </button>
                    
                    <span style={{ margin: '0 10px' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
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
