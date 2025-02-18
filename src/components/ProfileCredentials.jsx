import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom"; // Import useLocation to get the current path
import axios from "axios";
import "./ProfileCredentials.css";

const ProfileCredentials = ({isProfilePage}) => {
  const location = useLocation(); // Get current route
  const isSettingsPage = location.pathname === "/settings"; // Check if user is on Settings

  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSavedPassword, setIsEditingSavedPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageSavedPassword, setMessageSavedPassword] = useState("");

  useEffect(() => {
    // Fetch credentials from localStorage
    const storedMobile = localStorage.getItem("mobileNumber") || "9579797269";
    const storedEmail = localStorage.getItem("userEmail") || "omkargouda306@gmail.com";

    setMobileNumber(storedMobile);
    setEmail(maskEmail(storedEmail));
  }, []);

  // Function to mask email
  const maskEmail = (email) => {
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;
    const visiblePart = localPart.slice(-3);
    return `*****${visiblePart}@${domain}`;
  };

  const [maxCaptures, setMaxCaptures] = useState(7); // Default value
  const [isEditingMaxCaptures, setIsEditingMaxCaptures] = useState(false);
  const [tempCaptures, setTempCaptures] = useState(maxCaptures);

  const handleSaveMaxCaptures = async () => {
    try {
      const userMobileNumber = localStorage.getItem("mobileNumber");
  
      const response = await axios.post("http://localhost:5000/api/update-max-captures", {
        user_mobile_number: userMobileNumber,
        maxCaptures: tempCaptures,
      });
  
      setMaxCaptures(tempCaptures);
      setIsEditingMaxCaptures(false);
      alert(response.data.message);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        alert(error.response.data.message); // Display "24-hour restriction" message
      } else {
        console.error("Failed to update max captures:", error);
        alert("Error updating max captures. Try again.");
      }
    }
  };

  useEffect(() => {
    const fetchMaxCaptures = async () => {
      try {
        const userMobileNumber = localStorage.getItem("mobileNumber");
        const response = await axios.get(`http://localhost:5000/api/get-max-captures?user_mobile_number=${userMobileNumber}`);
  
        if (response.data) {
          setMaxCaptures(response.data.maxCaptures);
  
          // Check if 24 hours have passed
          const lastUpdated = new Date(response.data.lastUpdatedMaxCaptures);
          const now = new Date();
          const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);
  
          if (hoursPassed < 24) {
            setIsEditingMaxCaptures(false); // Disable edit
          }
        }
      } catch (error) {
        console.error("Error fetching max captures:", error);
      }
    };
  
    fetchMaxCaptures();
  }, []);

  // Function to handle password update
  const handlePasswordUpdate = async () => {
    try {
      if (newPassword.trim().length < 6) {
        setMessage("Password must be at least 6 characters long.");
        return;
      }

      const response = await axios.post("http://localhost:5000/api/update-password", {
        email: localStorage.getItem("userEmail"),
        newPassword,
      });

      setMessage(response.data.message);
      setIsEditing(false);
    } catch (error) {
      setMessage("Failed to update password. Try again.");
    }
  };

  const handleSavedPasswordUpdate = async () => {
    try {
      if (newPassword.trim().length < 6) {
        setMessageSavedPassword("Password must be at least 6 characters long.");
        return;
      }

      const response = await axios.post("http://localhost:5000/api/update-saved-password", {
        email: localStorage.getItem("userEmail"),
        newPassword,
      });

      setMessageSavedPassword(response.data.message);
      setIsEditingSavedPassword(false);
    } catch (error) {
      setMessageSavedPassword("Failed to update password. Try again.");
    }
  };

  return (
    <div className={`credentials-container ${isProfilePage ? 'profile-page' : ''}`}>
      {/* Show Max Captures per Day only on Settings page */}
      {isSettingsPage && (
        <div className="credentials-section">
          <div className="credentials-header">Max Captures per day</div>
          <div className="max-captures-content">
            <span className="credential-value">
              QTY : {maxCaptures < 10 ? `0${maxCaptures}` : maxCaptures}
            </span>
            {isEditingMaxCaptures ? (
              <>
                <input
                  type="number"
                  className="max-captures-input"
                  value={tempCaptures}
                  onChange={(e) => setTempCaptures(Number(e.target.value))}
                  min="1"
                />
                <button className="edit-max-captures" onClick={handleSaveMaxCaptures}>Save</button>
              </>
            ) : (
              <button className="edit-max-captures" onClick={() => setIsEditingMaxCaptures(true)}>Edit</button>
            )}
          </div>
        </div>
      )}

      {/* IndiaMart Account Credentials */}
      <div className="credentials-section">
        <h3 className="credentials-header">IndiaMart account credentials</h3>
        <div className="credentials-content">
          <div className="credential-group">
            <label>Registered mobile number</label>
            <div className="mobile">
              <span>{mobileNumber}</span>
              <div className="icon-group">
                <span className="lock-icon">🔒</span>
                <span className="info-icon">ⓘ</span>
              </div>
            </div>
          </div>
          <div className="credential-group">
            <label>Password</label>
            <div className="password-field">
              {isEditingSavedPassword ? (
                <input
                  type="password" className="password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              ) : (
                <span>************</span>
              )}
              {isEditingSavedPassword ? (
                <button type="button" className="save-button" onClick={handleSavedPasswordUpdate}>
                  Save
                </button>
              ) : (
                <button type="button" className="edit-button" onClick={() => setIsEditingSavedPassword(true)}>
                  Edit
                </button>
              )}
            </div>
            {messageSavedPassword && <p className="message">{messageSavedPassword}</p>}
          </div>
        </div>
      </div>

      {/* LeadsCruise Credentials */}
      <div className="credentials-section">
        <h3 className="credentials-header">LeadsCruise Credentials</h3>
        <div className="credentials-content">
          <div className="credential-group">
            <label>Registered Email ID</label>
            <div className="credential-value">
              <span>{email}</span>
              <div className="icon-group">
                <span className="lock-icon">🔒</span>
                <span className="info-icon">ⓘ</span>
              </div>
            </div>
          </div>
          <div className="credential-group">
            <label>Password</label>
            <div className="password-field">
              {isEditing ? (
                <input
                  type="password" className="password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              ) : (
                <span>************</span>
              )}
              {isEditing ? (
                <button className="save-button" onClick={handlePasswordUpdate}>
                  Save
                </button>
              ) : (
                <button className="edit-button" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            {message && <p className="message">{message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCredentials;
