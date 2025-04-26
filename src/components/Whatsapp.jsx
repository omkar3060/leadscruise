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
  const [newWhatsappNumber, setNewWhatsappNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [messages, setMessages] = useState([{ id: Date.now(), text: '' }]);

  const addMessage = () => {
    setMessages([...messages, { id: Date.now(), text: '' }]);
  };

  const removeMessage = (id) => {
    if (messages.length >= 1) {
      setMessages(messages.filter(msg => msg.id !== id));
    }
  };

  const handleMessageChange = (id, text) => {
    setMessages(messages.map(msg => msg.id === id ? { ...msg, text } : msg));
  };

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
        setNewWhatsappNumber(data.data.whatsappNumber);

        // Updated to access messages correctly from data.data
        if (data.data.messages && data.data.messages.length > 0) {
          setMessages(data.data.messages.map((text, index) => ({
            id: Date.now() + index,
            text
          })));
        } else {
          // Default empty message
          setMessages([{ id: Date.now(), text: '' }]);
        }

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

    if (!mobileNumber || !whatsappNumber || messages.length === 0 || messages.some(msg => !msg.text)) {
      return alert("All fields are required and you need at least one message!");
    }

    const formData = new FormData();
    formData.append("mobileNumber", mobileNumber);
    formData.append("whatsappNumber", whatsappNumber);
    formData.append("messages", JSON.stringify(messages.map(msg => msg.text)));

    try {
      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/save", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert("Settings saved successfully!");
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

  const updateWhatsappNumber = async () => {
    if (whatsappNumber === newWhatsappNumber) {
      alert("New WhatsApp number cannot be the same as the current one!");
      return;
    }
    if (!newWhatsappNumber) {
      alert("WhatsApp number cannot be empty!");
      return;
    }

    try {
      const mobileNumber = localStorage.getItem("mobileNumber");

      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/update-whatsapp-number", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, newWhatsappNumber }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("WhatsApp number updated successfully!");
        setWhatsappNumber(newWhatsappNumber);
        setIsEditing(false);
      } else {
        alert(data.error || "Failed to update WhatsApp number.");
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Server error during update.");
    }
  };

  useEffect(() => {
    // Find all auto-expanding textareas and set their height
    const textareas = document.querySelectorAll('.auto-expanding-input');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  }, [messages]);

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
                {!isEditing ? (
                  // Show API key as plain text when not in edit mode
                  <span className="api-key-text">{newWhatsappNumber || "No Whatsapp Number Set"}</span>
                ) : (
                  // Show input field when in edit mode
                  <input
                    type="text"
                    className="api-key-input"
                    value={newWhatsappNumber}
                    placeholder="Enter new API Key..."
                    onChange={(e) => setNewWhatsappNumber(e.target.value)}
                  />
                )}

                {!isEditing ? (
                  // Show "Edit" button initially
                  <button className="update-api-btn" style={{ background: "#28a745" }} onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                ) : (
                  // Show "Update API Key" button only after clicking "Edit"
                  <button className="update-api-btn" onClick={updateWhatsappNumber}>
                    Update WhatsappNumber
                  </button>
                )}
              </div>

              <div className="message-table-container">
                <label className="message-table-label">Messages to send as replies:</label>
                <table className="message-table">
                  <thead>
                    <tr>
                      <th className="message-column">Message</th>
                      <th className="action-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr key={message.id}>
                        <td>
                          <div className="auto-expanding-input-container">
                            <textarea
                              className="auto-expanding-input"
                              placeholder="Enter your message..."
                              value={message.text}
                              onChange={(e) => {
                                handleMessageChange(message.id, e.target.value);
                                // Auto-expand logic
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              onFocus={(e) => {
                                // Ensure height is correct on focus
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              rows={1}
                            />
                          </div>
                        </td>
                        <td className="action-cell">
                          <button
                            className="remove-message-btn"
                            onClick={() => removeMessage(message.id)}
                            disabled={messages.length === 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="button-container">
                  <button className="add-message-btn" onClick={addMessage}>
                    Add Message
                  </button>
                  <button className="save-btn" onClick={handleSubmit}>
                    Save WhatsApp Details
                  </button>
                </div>
              </div>

            </div>
          </div>

          <ProfileCredentials isProfilePage={true} />
        </div>
      </div>

    </div>
  );
};

export default Whatsapp;
