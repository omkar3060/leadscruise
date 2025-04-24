import React, { useState, useEffect } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import './Whatsapp.css';

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

const Whatsapp = () => {
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const status = localStorage.getItem("status");
  //   console.log("Status in Sidebar:", status);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewFiles(filesArray);

      // Create preview URLs for the selected files
      const filePreviewUrls = filesArray.map(file => {
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        } else if (file.type === 'application/pdf') {
          return '/pdf-icon.png'; // Replace with path to your PDF icon
        }
        return '/file-icon.png'; // Replace with path to your generic file icon
      });

      setPreviewUrls(filePreviewUrls);
    }
  };

  // Remove a file from the selection
  const removeFile = (index) => {
    setNewFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    setPreviewUrls(prevUrls => prevUrls.filter((_, i) => i !== index));
  };

  // Remove a previously uploaded file
  const removeUploadedFile = async (fileId) => {
    const mobileNumber = localStorage.getItem("mobileNumber");

    try {
      const res = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/remove-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobileNumber,
          fileId
        }),
      });

      if (res.ok) {
        // Remove file from state
        setUploadedFiles(prevFiles => prevFiles.filter(file => file._id !== fileId));
        alert('File removed successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Error removing file');
      }
    } catch (err) {
      console.error('Error removing file:', err);
      alert('Server error while removing file');
    }
  };

  const fetchSettings = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) return;

    try {
      const res = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/get?mobileNumber=${mobileNumber}`);
      const data = await res.json();

      if (res.ok) {
        setWhatsappNumber(data.data.whatsappNumber);
        setCustomMessage(data.data.customMessage);

        // Set the uploaded files from the database
        if (data.data.catalogueFiles && data.data.catalogueFiles.length > 0) {
          setUploadedFiles(data.data.catalogueFiles);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewUrls]);

  const handleSubmit = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");

    if (!mobileNumber || !whatsappNumber || !customMessage) {
      return alert("All fields are required!");
    }

    const formData = new FormData();
    formData.append("mobileNumber", mobileNumber);
    formData.append("whatsappNumber", whatsappNumber);
    formData.append("customMessage", customMessage);

    // Add new files to the form data
    newFiles.forEach(file => {
      formData.append("catalogueFiles", file);
    });

    try {
      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/save", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert("Settings saved successfully!");
        // Clear new files after successful upload
        setNewFiles([]);
        setPreviewUrls([]);
        // Refresh settings to get updated file list
        fetchSettings();
      } else {
        alert(data.error || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while saving settings.");
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
            <h2>WhatsApp Settings</h2>

            <div>
              <div className="api-key-container">
                <label className="api-key-label">Your WhatsApp Number:</label>
                <input
                  type="text"
                  className="api-key-input"
                  placeholder="Enter WhatsApp number..."
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>

              <div className="api-key-container">
                <label className="api-key-label">Custom Message:</label>
                <textarea
                  className="api-key-input"
                  placeholder="Enter your message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="file-upload-container">
                <label htmlFor="catalogueFiles" className="file-upload-label">
                  <div className="upload-icon">
                    <i className="fas fa-cloud-upload-alt"></i>
                  </div>
                  <div className="upload-text">
                    <h3>Attach Catalogue Files</h3>
                    <p>Drag & drop files here or click to browse</p>
                    <span className="file-types">Supports: PDF, JPG, PNG, GIF (Max 5 files)</span>
                  </div>
                </label>
                <input
                  type="file"
                  id="catalogueFiles"
                  multiple
                  accept=".pdf,image/*"
                  className="file-input"
                  onChange={handleFileChange}
                />
              </div>

              {/* Preview of newly selected files */}
              {previewUrls.length > 0 && (
                <div className="file-preview-container">
                  <h4>Selected Files</h4>
                  <div className="file-preview-grid">
                    {newFiles.map((file, index) => (
                      <div key={`new-${index}`} className="file-preview-item">
                        {file.type.startsWith('image/') ? (
                          <img src={previewUrls[index]} alt={file.name} className="file-thumbnail" />
                        ) : (
                          <div className="pdf-thumbnail">
                            <i className="fas fa-file-pdf"></i>
                          </div>
                        )}
                        <div className="file-info">
                          <p className="file-name" title={file.name}>
                            {file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}
                          </p>
                          <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          className="remove-file-btn"
                          onClick={() => removeFile(index)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Display previously uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="file-preview-container uploaded-files">
                  <h4>Uploaded Files</h4>
                  <div className="file-preview-grid">
                    {uploadedFiles.map((file) => (
                      <div key={file._id} className="file-preview-item">
                        {file.mimetype.startsWith('image/') ? (
                          <img
                            src={`https://api.leadscruise.com/${file.path}`}
                            alt={file.originalName}
                            className="file-thumbnail"
                          />
                        ) : (
                          <div className="pdf-thumbnail">
                            <i className="fas fa-file-pdf"></i>
                          </div>
                        )}
                        <div className="file-info">
                          <p className="file-name" title={file.originalName}>
                            {file.originalName.length > 20 ? file.originalName.substring(0, 17) + '...' : file.originalName}
                          </p>
                          <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          className="remove-file-btn"
                          onClick={() => removeUploadedFile(file._id)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="update-api-btn" onClick={handleSubmit}>
                Save WhatsApp Details
              </button>
            </div>
          </div>

          <ProfileCredentials isProfilePage={true} />
        </div>
      </div>

    </div>
  );
};

export default Whatsapp;
