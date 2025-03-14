import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "./ProfileCredentials.css";

const ProfileCredentials = ({ isProfilePage }) => {
  const location = useLocation();
  const isSettingsPage = location.pathname === "/settings" || location.pathname === "/sheets";
  const [shakeError, setShakeError] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSavedPassword, setIsEditingSavedPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savedNewPassword, setSavedNewPassword] = useState("");

  // Separate validation states for each password field
  const [showLeadsCruiseValidation, setShowLeadsCruiseValidation] = useState(false);
  const [showIndiaMartValidation, setShowIndiaMartValidation] = useState(false);

  // Input focus states
  const [isLeadsCruisePasswordFocused, setIsLeadsCruisePasswordFocused] = useState(false);
  const [isIndiaMartPasswordFocused, setIsIndiaMartPasswordFocused] = useState(false);

  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  useEffect(() => {
    // Fetch credentials from localStorage
    const storedMobile = localStorage.getItem("mobileNumber") || "";
    const storedEmail = localStorage.getItem("userEmail") || "";

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

  const [maxCaptures, setMaxCaptures] = useState(7);
  const [isEditingMaxCaptures, setIsEditingMaxCaptures] = useState(false);
  const [tempCaptures, setTempCaptures] = useState(maxCaptures);

  // Check if password is valid
  const validatePassword = (password) => {
    return passwordRegex.test(password);
  };

  // Update validation for LeadsCruise password
  useEffect(() => {
    if (isEditing && newPassword.length > 0 && isLeadsCruisePasswordFocused) {
      setShowLeadsCruiseValidation(!validatePassword(newPassword));
    } else {
      setShowLeadsCruiseValidation(false);
    }
  }, [newPassword, isEditing, isLeadsCruisePasswordFocused]);

  // Update validation for IndiaMart password
  useEffect(() => {
    if (isEditingSavedPassword && savedNewPassword.length > 0 && isIndiaMartPasswordFocused) {
      setShowIndiaMartValidation(!validatePassword(savedNewPassword));
    } else {
      setShowIndiaMartValidation(false);
    }
  }, [savedNewPassword, isEditingSavedPassword, isIndiaMartPasswordFocused]);

  const handleSaveMaxCaptures = async () => {
    try {
      const userMobileNumber = localStorage.getItem("mobileNumber");
  
      // Prevent API call if maxCaptures is the same
      if (tempCaptures === maxCaptures) {
        alert("Max captures value is unchanged.");
        setIsEditingMaxCaptures(false);
        return;
      }
  
      const response = await axios.post("http://localhost:5000/api/update-max-captures", {
        user_mobile_number: userMobileNumber,
        maxCaptures: tempCaptures,
      });
  
      setMaxCaptures(tempCaptures);
      setIsEditingMaxCaptures(false);
      alert(response.data.message);
    } catch (error) {
      if (error.response?.status === 403) {
        alert(error.response.data.message);
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
            setIsEditingMaxCaptures(false);
          }
        }
      } catch (error) {
        console.error("Error fetching max captures:", error);
      }
    };

    fetchMaxCaptures();
  }, []);

  // Function to handle password update for LeadsCruise
  const handlePasswordUpdate = async () => {
    try {
      if (!validatePassword(newPassword)) {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        setShowLeadsCruiseValidation(true);
        return;
      }

      const response = await axios.post("http://localhost:5000/api/update-password", {
        email: localStorage.getItem("userEmail"),
        newPassword,
      });

      alert(response.data.message);
      setIsEditing(false);
      setNewPassword("");
      setShowLeadsCruiseValidation(false);
    } catch (error) {
      alert("Failed to update password. Try again.");
    }
  };

  // Function to handle password update for IndiaMart
  const handleSavedPasswordUpdate = async () => {
    try {
      if (savedNewPassword.length < 6) {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        setShowIndiaMartValidation(true);
        return;
      }

      const response = await axios.post("http://localhost:5000/api/update-saved-password", {
        email: localStorage.getItem("userEmail"),
        newPassword: savedNewPassword,
      });

      alert(response.data.message);
      setIsEditingSavedPassword(false);
      setSavedNewPassword("");
      setShowIndiaMartValidation(false);
    } catch (error) {
      alert("Failed to update password. Try again.");
    }
  };

  // Handle canceling password edit
  const handleCancelEdit = (type) => {
    if (type === 'saved') {
      setIsEditingSavedPassword(false);
      setSavedNewPassword("");
      setShowIndiaMartValidation(false);
    } else {
      setIsEditing(false);
      setNewPassword("");
      setShowLeadsCruiseValidation(false);
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
                <button className="edit-max-captures" onClick={(e) => { e.preventDefault(); handleSaveMaxCaptures(); }}>Save</button>
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
                <span className="info-icon" data-tooltip="Registered mobile number cannot be updated.">ⓘ</span>
              </div>
            </div>
          </div>
          <div className="credential-group">
            <label>Password</label>
            <div className="password-field">
              {isEditingSavedPassword ? (
                <input
                  type="password"
                  className="password-input"
                  value={savedNewPassword}
                  onChange={(e) => setSavedNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  onFocus={() => setIsIndiaMartPasswordFocused(true)}
                  onBlur={() => setIsIndiaMartPasswordFocused(false)}
                />
              ) : (
                <span>************</span>
              )}
              {isEditingSavedPassword ? (
                <div className="edit-button-container">
                  <button className="save-button" onClick={(e) => { e.preventDefault(); handleSavedPasswordUpdate(); }}>
                    Save
                  </button>
                  <button className="cancel-button" onClick={() => handleCancelEdit('saved')}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="edit-button" onClick={() => setIsEditingSavedPassword(true)}>
                  Edit
                </button>
              )}
            </div>
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
                <span className="info-icon" data-tooltip="Registered email ID cannot be updated.">ⓘ</span>
              </div>
            </div>
          </div>
          <div className="credential-group">
            <label>Password</label>
            <div className="password-field">
              {isEditing ? (
                <input
                  type="password"
                  className="password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  onFocus={() => setIsLeadsCruisePasswordFocused(true)}
                  onBlur={() => setIsLeadsCruisePasswordFocused(false)}
                />
              ) : (
                <span>************</span>
              )}
              {isEditing ? (
                <div className="edit-button-container">
                  <button className="save-button" onClick={(e) => { e.preventDefault(); handlePasswordUpdate(); }}>
                    Save
                  </button>
                  <button className="cancel-button" onClick={() => handleCancelEdit('leadscruise')}>Cancel</button>
                </div>
              ) : (
                <button className="edit-button" onClick={(e) => { e.preventDefault(); setIsEditing(true); }}>
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IndiaMart Password Validation Popup */}
      {showLeadsCruiseValidation && (
        <div className={`password-validation-popup ${shakeError ? "shake" : ""}`}>
          <div className="validation-container">
            <div className="validation-error">
              <span className="error-icon">⚠️</span>
              <p>Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character.</p>
            </div>
          </div>
        </div>
      )}

      {/* LeadsCruise Password Validation Popup */}
      {showIndiaMartValidation && (
        <div className={`password-validation-popup-1 ${shakeError ? "shake" : ""}`}>
          <div className="validation-container">
            <div className="validation-error">
              <span className="error-icon">⚠️</span>
              <p>Password must contain at least 6 characters.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCredentials;