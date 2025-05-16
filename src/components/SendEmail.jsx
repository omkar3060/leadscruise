import React, { useState, useEffect, useRef } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import "./SendEmail.css";

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

const SendEmail = () => {
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const status = localStorage.getItem("status");
  console.log("Status in Sidebar:", status);
  const [isLoading, setIsLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [apiKey, setApiKey] = useState(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const modalRef = useRef(null);

  const userEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    // Filter for PDF files only
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== selectedFiles.length) {
      alert('Only PDF files are allowed.');
    }

    setFiles(prevFiles => [...prevFiles, ...pdfFiles]);
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const userEmail=localStorage.getItem("userEmail");
    if (files.length === 0 && !message.trim()) {
      setUploadStatus({
        success: false,
        message: 'Please upload at least one PDF or enter a message.'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData object to send files and message
      const formData = new FormData();
      files.forEach(file => {
        formData.append('pdfs', file);
      });
      formData.append('message', message);
      formData.append('userEmail', userEmail); 

      // Example API call to save to database
      // In a real application, replace with your actual API endpoint
      const response = await fetch('http://localhost:5000/api/upload-email', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus({
          success: true,
          message: 'Files and message saved successfully!'
        });

        // Clear form after successful upload
        setFiles([]);
        setMessage('');
      } else {
        throw new Error(result.message || 'Failed to save files and message');
      }
    } catch (error) {
      setUploadStatus({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handlePreview = (file) => {
    const fileURL = URL.createObjectURL(file);
    window.open(fileURL, "_blank");
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewFile(null);
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        closePreview();
      }
    };

    if (showPreview) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPreview]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    if (showPreview) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showPreview]);

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
          <h2>Email Forwarding Settings</h2>

          <div className="message-area">
            <h3>Messages</h3>
            <textarea
              className="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter any additional notes or context..."
              rows={4}
            ></textarea>
          </div>

          <h3>Catalogues</h3>

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
                    <div className="file-item-actions">
                      <button
                        className="file-item-preview"
                        onClick={() => handlePreview(file)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>Preview</span>
                      </button>
                      <button
                        className="file-item-remove"
                        onClick={() => removeFile(index)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
};

export default SendEmail;