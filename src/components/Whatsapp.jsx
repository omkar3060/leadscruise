import React, { useState, useEffect, useRef } from "react";
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
  const [isLoading, setIsLoading] = useState(() => {
    const savedLoadingState = localStorage.getItem("whatsappVerificationLoading");
    // Parse the string "true" to boolean true, or default to false
    return savedLoadingState === "true";
  });
  const [error, setError] = useState(null);
  const [newWhatsappNumber, setNewWhatsappNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [messages, setMessages] = useState([{ id: Date.now(), text: '' }]);
  const [verificationCode, setVerificationCode] = useState('');
  const addMessage = () => {
    setMessages([...messages, { id: Date.now(), text: '' }]);
  };

  const updateLoadingState = (newLoadingState) => {
    setIsLoading(newLoadingState);
    localStorage.setItem("whatsappVerificationLoading", newLoadingState.toString());
  };

  const removeMessage = (id) => {
    if (messages.length >= 1) {
      setMessages(messages.filter(msg => msg.id !== id));
    }
  };

  const handleMessageChange = (id, text) => {
    setMessages(messages.map(msg => msg.id === id ? { ...msg, text } : msg));
  };

  useEffect(() => {
    // Add a timestamp when loading starts to detect stale loading states
    if (isLoading) {
      localStorage.setItem("whatsappLoadingStartTime", Date.now().toString());
    }

    return () => {
      // This cleanup function won't run on page reload, only on component unmount
      // We leave the logic here in case the user navigates away from the page
      if (isLoading) {
        // Don't clear loading state on normal unmount - we want it to persist
      }
    };
  }, [isLoading]);

  // 7. Add a timeout check to prevent indefinite loading states
  useEffect(() => {
    if (isLoading) {
      const loadingStartTime = localStorage.getItem("whatsappLoadingStartTime");
      if (loadingStartTime) {
        const startTime = parseInt(loadingStartTime, 10);
        const currentTime = Date.now();
        const loadingDuration = currentTime - startTime;

        // If it's been loading for more than 15 minutes (900000ms), reset it
        // Adjust this timeout as needed based on your verification process
        if (loadingDuration > 600000) {
          console.log("Loading state timed out after 10 minutes");
          updateLoadingState(false);
        }
      }
    }
  }, [isLoading]);

  const fetchSettings = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) return;

    try {
      const res = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/get?mobileNumber=${mobileNumber}`);
      const data = await res.json();

      if (res.ok) {
        setWhatsappNumber(data.data.whatsappNumber);
        setNewWhatsappNumber(data.data.whatsappNumber);
        setVerificationCode(data.data.verificationCode || '');

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
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchVerificationCode = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) {
      console.log("No mobile number found in localStorage");
      return;
    }
  
    try {
      console.log("Fetching verification code for:", mobileNumber);
      
      // Using native fetch API
      const response = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/verification-code/${mobileNumber}`);
      
      if (!response.ok) {
        console.error(`Error response: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log("API Response:", data);
      
      // Check if the response contains a verification code
      if (data && data.verificationCode) {
        const code = data.verificationCode;
        console.log("Received verification code:", code);
        
        // Update state with the verification code
        setVerificationCode(code);
        
        // Update loading state if we got a code
        if (code) {
          setIsLoading(false);
          localStorage.setItem("whatsappVerificationLoading", "false");
        }
      } else {
        console.log("No verification code in response data:", data);
      }
    } catch (error) {
      console.error("Error fetching verification code:", error);
    }
  };  

  useEffect(() => {
    console.log("Component updated with isLoading:", isLoading, "verificationCode:", verificationCode);
  }, [isLoading, verificationCode]);
  
  // Use a ref to store the interval ID so we can clear it from within fetchVerificationCode
  const intervalRef = useRef(null);
  
// Simplified polling with fewer dependencies
useEffect(() => {
  
  // Initial fetch
  fetchVerificationCode();
  
  // Set up polling interval
  const interval = setInterval(() => {
    fetchVerificationCode();
  }, 3000);
  
  // Clean up on unmount or when isLoading changes
  return () => clearInterval(interval);
}, []); // Only depend on isLoading // Add dependencies to re-establish interval if these change

  useEffect(() => {
    fetchSettings();
  }, []);

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
    updateLoadingState(true);
    setIsLoading(true);
    setVerificationCode("");
    setError(null);
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");

      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/update-whatsapp-number", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, newWhatsappNumber }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("WhatsApp number updated successfully! Please wait a few minutes for a verification code. Enter it in WhatsApp to enable messaging buyers.");
        setWhatsappNumber(newWhatsappNumber);
        setIsEditing(false);
      } else {
        alert(data.error || "Failed to update WhatsApp number.");
        setError("Failed to update WhatsApp number");
        setIsLoading(false);
        updateLoadingState(false);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Server error during update.");
      setError("Failed to update WhatsApp number");
      setIsLoading(false);
      updateLoadingState(false);
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

              {/* Verification Code Display */}
              {error && <div className="error-message">{error}</div>}

              
<div className="verification-code-container">
  <label className="verification-code-label">Verification Code:</label>
  {isLoading ? (
    <div className="loading-spinner">
      <div className="spinner1"></div>
      <span>Waiting for verification code...</span>
    </div>
  ) : verificationCode ? (
    <>
      {verificationCode === "111" ? (
        <div className="already-logged-in-message">
          <p>Already logged in to WhatsApp! No verification needed.</p>
        </div>
      ) : (
        <span className="verification-code">{verificationCode}</span>
      )}
    </>
  ) : (
    <span className="no-code">No verification code available</span>
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
