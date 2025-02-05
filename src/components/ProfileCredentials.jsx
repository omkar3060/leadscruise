import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ProfileCredentials.css";

const ProfileCredentials = () => {
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
    <div className="credentials-container">
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
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              ) : (
                <span>************</span>
              )}
              {isEditingSavedPassword ? (
                <button
                  type="button"
                  className="save-button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSavedPasswordUpdate();
                  }}
                >
                  Save
                </button>
              ) : (
                <button
                  type="button"
                  className="edit-button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsEditingSavedPassword(true);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            {messageSavedPassword && <p className="message">{messageSavedPassword}</p>}
          </div>
        </div>
      </div>

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
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              ) : (
                <span>************</span>
              )}
              {isEditing ? (
                <button
                className="save-button"
                onClick={(e) => {
                  e.preventDefault(); // Prevent default behavior
                  handlePasswordUpdate(); // Call the password update function
                }}
              >
                Save
              </button>              
              ) : (
                <button
                  className="edit-button"
                  onClick={(e) => {
                    e.preventDefault(); // Prevent default behavior
                    setIsEditing(true); // Enable editing mode
                  }}
                >
                  Edit
                </button>

              )}
            </div>
            {message && <p className="message">{message}</p>}
          </div>
        </div>
      </div>

      <div className="terms-section">
        <h3 className="credentials-header">Terms of use</h3>
        <div className="terms-content">
          <a href="#" className="download-link">
            <span className="download-icon">⬇️</span>
            Download Terms and Conditions (PDF)
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProfileCredentials;
