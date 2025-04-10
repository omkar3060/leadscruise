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
        const response = await axios.get(`http://localhost:5000/api/get-api-key/${userEmail}`);
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
      const response = await axios.put("http://localhost:5000/api/update-api-key", {
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
      <div className="pdf-upload-container">
      <div className="upload-section">
        <h2>Document Management</h2>
        
        <div className="status-card">
          <div className={`status-indicator ${uploadStatus?.success ? 'success' : uploadStatus?.success === false ? 'error' : ''}`}>
            {uploadStatus ? (
              <>
                <p className="status-text">
                  {uploadStatus.success ? 
                    <span className="success-icon">✅ Saved</span> : 
                    <span className="error-icon">❌ Error</span>
                  }
                </p>
                <p className="status-message">{uploadStatus.message}</p>
              </>
            ) : (
              <p className="status-text neutral">Ready to upload</p>
            )}
          </div>
        </div>

        <div className="upload-area">
          <div className="file-drop-area" onClick={triggerFileInput}>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".pdf" 
              multiple 
              onChange={handleFileChange} 
              className="file-input" 
            />
            <div className="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p className="upload-text">Click to upload PDFs</p>
            <p className="upload-subtext">or drag and drop files here</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <h3>Selected Files ({files.length})</h3>
            <ul>
              {files.map((file, index) => (
                <li key={index} className="file-item">
                  <div className="file-item-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <div className="file-item-name">{file.name}</div>
                  <div className="file-item-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  <button 
                    className="file-item-remove" 
                    onClick={() => removeFile(index)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="message-area">
          <h3>Add a Message</h3>
          <textarea
            className="message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter any additional notes or context..."
            rows={4}
          ></textarea>
        </div>

        <button 
          className={`save-button ${isUploading ? 'loading' : ''}`} 
          onClick={handleSubmit}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <svg className="spinner" viewBox="0 0 50 50">
                <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
              </svg>
              Saving...
            </>
          ) : 'Save to Database'}
        </button>

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
      </div>
    </div>
    </div>
  );
};

export default Sheets;