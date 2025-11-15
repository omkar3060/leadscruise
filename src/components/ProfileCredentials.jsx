import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "./ProfileCredentials.css";
import { FaChevronDown } from "react-icons/fa";
import MiscSettingsPopup from "./MiscSettingsPopup";
const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const StatesDropdown = ({ userEmail, automationStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStates, setSelectedStates] = useState([]);
  const [tempStates, setTempStates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStates = useCallback(async () => {
    try {
      const response = await axios.get(`https://api.leadscruise.com/api/get-states?userEmail=${userEmail}`);
      if (response.data && response.data.states) {
        setSelectedStates(response.data.states);
        setTempStates(response.data.states);
      }
    } catch (error) {
      console.error("Failed to fetch selected states:", error);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      fetchStates();
    }
  }, [userEmail, fetchStates]);

  const handleSave = async () => {
    try {
      await axios.post("https://api.leadscruise.com/api/update-states", {
        userEmail,
        states: tempStates,
      });
      setSelectedStates(tempStates);
      setIsOpen(false);
      alert("States updated successfully!");
    } catch (error) {
      console.error("Error updating states:", error);
      alert("Failed to update states.");
    }
  };

  const handleStateChange = (state, isChecked) => {
    if (isChecked) {
      setTempStates(prev => [...prev, state]);
    } else {
      setTempStates(prev => prev.filter(s => s !== state));
    }
  };

  const handleAllIndiaChange = (isChecked) => {
    setTempStates(isChecked ? [...indianStates] : []);
  };

  const filteredStates = indianStates.filter(state =>
    state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isEditDisabled = automationStatus === "Running";

  return (
    <div className="credentials-section">
      <div className="credentials-header">States</div>
      <div className="max-captures-content">
        <div className="dropdown-container">
          <div className="dropdown-header">
            <span className="credential-value">
              {
                selectedStates.length === 0 ? "None selected" :
                  selectedStates.length === indianStates.length ? "ALL INDIA" :
                    selectedStates.length <= 3 ? selectedStates.join(", ") :
                      `${selectedStates.length} states selected`
              }
            </span>
            <button
              type="button"
              className="edit-max-captures"
              onClick={() => {
                if (isEditDisabled) {
                  alert("You cannot edit while automation is running");
                  return;
                }
                setIsOpen(!isOpen);
              }}
              style={{
                backgroundColor: isEditDisabled ? "#ccc" : "",
                cursor: isEditDisabled ? "not-allowed" : "pointer",
                color: isEditDisabled ? "#666" : ""
              }}
            >
              <FaChevronDown
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s"
                }}
              />
            </button>
          </div>
          {isOpen && (
            <div className="dropdown-menu">
              <input
                type="text"
                placeholder="Search for a state..."
                className="dropdown-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="dropdown-list">
                <label className="checkbox-label styled-checkbox">
                  <input
                    type="checkbox"
                    checked={tempStates.length === indianStates.length}
                    onChange={(e) => handleAllIndiaChange(e.target.checked)}
                  />
                  <span className="misc-checkmark" />
                  <strong>ALL INDIA</strong>
                </label>
                {filteredStates.map(state => (
                  <label key={state} className="checkbox-label styled-checkbox">
                    <input
                      type="checkbox"
                      checked={tempStates.includes(state)}
                      onChange={(e) => handleStateChange(state, e.target.checked)}
                    />
                    <span className="misc-checkmark" />
                    {state}
                  </label>
                ))}
              </div>
              <div className="dropdown-actions">
                <button className="edit-max-captures save-btn" onClick={(e) => {
                  e.preventDefault();
                  handleSave();
                }}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const WhatsAppFilterToggle = ({ userEmail, automationStatus }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeInfo, setTimeInfo] = useState({
    daysRemaining: 0,
    hoursRemaining: 0,
    hasExpired: false
  });

  const fetchFilterStatus = useCallback(async () => {
    try {
      const response = await axios.get(
        `https://api.leadscruise.com/api/whatsapp-filter/status?userEmail=${userEmail}`
      );

      if (response.data.success) {
        setIsEnabled(response.data.todayOnlyEnabled);
        setTimeInfo({
          daysRemaining: response.data.daysRemaining,
          hoursRemaining: response.data.hoursRemaining,
          hasExpired: response.data.hasExpired
        });
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp filter status:", error);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      fetchFilterStatus();
      
      // Auto-refresh every minute to update countdown
      const interval = setInterval(fetchFilterStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [userEmail, fetchFilterStatus]);

  const handleToggle = async () => {
    if (automationStatus === "Running") {
      alert("Cannot change WhatsApp filter while automation is running");
      return;
    }

    try {
      setLoading(true);
      const newState = !isEnabled;
      
      const response = await axios.post(
        "https://api.leadscruise.com/api/whatsapp-filter/toggle",
        {
          userEmail,
          enabled: newState
        }
      );

      if (response.data.success) {
        setIsEnabled(newState);
        await fetchFilterStatus(); // Refresh to get updated expiry time
        
        if (newState) {
          alert("WhatsApp filter enabled! Messages will only be sent for today's leads for the next 3 days.");
        } else {
          alert("WhatsApp filter disabled. All leads will receive WhatsApp messages.");
        }
      }
    } catch (error) {
      console.error("Failed to toggle WhatsApp filter:", error);
      alert("Failed to update WhatsApp filter. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = () => {
    if (!isEnabled) {
      return "All Leads (Filter OFF)";
    }
    
    if (timeInfo.hasExpired) {
      return "Expired - All Leads";
    }
    
    if (timeInfo.daysRemaining > 0) {
      return `Today's Leads Only (${timeInfo.daysRemaining}d ${timeInfo.hoursRemaining}h left)`;
    }
    
    return `Today's Leads Only (${timeInfo.hoursRemaining}h left)`;
  };

  const getStatusColor = () => {
    if (!isEnabled || timeInfo.hasExpired) return "#6c757d";
    if (timeInfo.daysRemaining === 0 && timeInfo.hoursRemaining < 6) return "#ff9800";
    return "#28a745";
  };

  return (
    <div className="credentials-section">
      <div className="credentials-header">WhatsApp Message Filter</div>
      <div className="whatsapp-filter-container">
        <div className="filter-info">
          <div className="filter-status-text" style={{ color: getStatusColor() }}>
            {loading ? "Loading..." : getStatusText()}
          </div>
          <div className="filter-description">
            {isEnabled && !timeInfo.hasExpired ? (
              <>
                <span style={{ color: "#28a745", fontWeight: "600" }}>✓ Active:</span> 
                {" "}Only sending WhatsApp messages for leads captured today
              </>
            ) : (
              <>
                <span style={{ color: "#6c757d", fontWeight: "600" }}>○ Inactive:</span> 
                {" "}(default behavior)
              </>
            )}
          </div>
        </div>
        
        <label className="whatsapp-filter-switch">
          <input
            type="checkbox"
            checked={isEnabled && !timeInfo.hasExpired}
            onChange={handleToggle}
            disabled={loading || automationStatus === "Running"}
          />
          <span className="whatsapp-filter-slider"></span>
        </label>
      </div>
      
      {/*{isEnabled && !timeInfo.hasExpired && (
        <div className="filter-warning">
          <span style={{ fontSize: "18px" }}>⏱️</span>
          <span>
            This filter will automatically turn off in{" "}
            {timeInfo.daysRemaining > 0 && `${timeInfo.daysRemaining} day${timeInfo.daysRemaining > 1 ? 's' : ''} `}
            {timeInfo.hoursRemaining > 0 && `${timeInfo.hoursRemaining} hour${timeInfo.hoursRemaining > 1 ? 's' : ''}`}
          </span>
        </div>
      )}*/}
      
      {automationStatus === "Running" && (
        <div className="filter-locked-message">
          🔒 Filter locked while automation is running
        </div>
      )}
    </div>
  );
};
const ProfileCredentials = ({
  isProfilePage,
  newWhatsappNumber,
  setNewWhatsappNumber,
  isEditingWhatsapp,
  setIsEditingWhatsapp,
  updateWhatsappNumber,
  verificationCode,
  setVerificationCode,
  isLoading,
  justUpdated,
  setJustUpdated,
  editLockedUntil,
  setEditLockedUntil,
  error
}) => {
  const location = useLocation();
  const isSettingsPage = location.pathname === "/settings";
  const isWhatsAppPage = location.pathname === "/whatsapp";
  const isSheetsPage = location.pathname === "/sheets";
  const [shakeError, setShakeError] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSavedPassword, setIsEditingSavedPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savedNewPassword, setSavedNewPassword] = useState("");
  const [leadTypes, setLeadTypes] = useState([]);
  const [tempLeadTypes, setTempLeadTypes] = useState([]);
  const [isEditingLeadTypes, setIsEditingLeadTypes] = useState(false);
  const [automationStatus, setAutomationStatus] = useState(localStorage.getItem("status") || "Stopped");

  const [showLeadsCruiseValidation, setShowLeadsCruiseValidation] = useState(false);
  const [showIndiaMartValidation, setShowIndiaMartValidation] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [isLeadsCruisePasswordFocused, setIsLeadsCruisePasswordFocused] = useState(false);
  const [isIndiaMartPasswordFocused, setIsIndiaMartPasswordFocused] = useState(false);
  const [canAccessDesktopApp, setCanAccessDesktopApp] = useState(false);
  const [subscriptionCheckLoading, setSubscriptionCheckLoading] = useState(true);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const [countdown, setCountdown] = useState(0);
  const [thresholdLevel, setThresholdLevel] = useState('');
  const [thresholdScore, setThresholdScore] = useState(0);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThresholdLevel, setTempThresholdLevel] = useState('');

  // Monitor automation status changes
  useEffect(() => {
    const checkAutomationStatus = () => {
      const status = localStorage.getItem("status");
      setAutomationStatus(status || "Stopped");
    };

    checkAutomationStatus();
    const interval = setInterval(checkAutomationStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      if (editLockedUntil && now < editLockedUntil) {
        setCountdown(Math.ceil((editLockedUntil - now) / 1000));
      } else {
        setCountdown(0);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [editLockedUntil]);

  useEffect(() => {
    const storedMobile = localStorage.getItem("mobileNumber") || "";
    const storedEmail = localStorage.getItem("userEmail") || "";

    setMobileNumber(storedMobile);
    setEmail(maskEmail(storedEmail));
  }, []);

  const maskEmail = (email) => {
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;
    const visiblePart = localPart.slice(-3);
    return `*****${visiblePart}@${domain}`;
  };

  const [maxCaptures, setMaxCaptures] = useState(7);
  const [isEditingMaxCaptures, setIsEditingMaxCaptures] = useState(false);
  const [tempCaptures, setTempCaptures] = useState(maxCaptures);

  const [minOrder, setminOrder] = useState(0);
  const [isEditingminOrder, setIsEditingminOrder] = useState(false);
  const [tempMin, setTempMin] = useState(minOrder);

  const validatePassword = (password) => {
    return passwordRegex.test(password);
  };

  useEffect(() => {
    if (isEditing && newPassword.length > 0 && isLeadsCruisePasswordFocused) {
      setShowLeadsCruiseValidation(!validatePassword(newPassword));
    } else {
      setShowLeadsCruiseValidation(false);
    }
  }, [newPassword, isEditing, isLeadsCruisePasswordFocused]);

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

      if (tempCaptures === maxCaptures) {
        alert("Max captures value is unchanged.");
        setIsEditingMaxCaptures(false);
        return;
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-max-captures", {
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
    const checkActiveSubscriptions = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
          setCanAccessDesktopApp(false);
          setSubscriptionCheckLoading(false);
          return;
        }

        // Demo account gets full access
        if (userEmail === "demo@leadscruise.com") {
          setCanAccessDesktopApp(true);
          setSubscriptionCheckLoading(false);
          return;
        }

        const response = await axios.get(
          `https://api.leadscruise.com/api/get-active-subscriptions?email=${userEmail}`
        );

        if (response.data.success) {
          setActiveSubscriptions(response.data.activeSubscriptions);

          // Check if user has any active yearly subscription
          const hasYearlySubscription = response.data.activeSubscriptions.some(
            sub => sub.type === 'year-mo'
          );

          setCanAccessDesktopApp(hasYearlySubscription);

          console.log("Active Subscriptions:", response.data.activeSubscriptions);
          console.log("Has Yearly Subscription:", hasYearlySubscription);
          console.log("Can Access Desktop App:", hasYearlySubscription);
        }
      } catch (error) {
        console.error("Failed to check active subscriptions:", error);
        setCanAccessDesktopApp(false);
      } finally {
        setSubscriptionCheckLoading(false);
      }
    };

    checkActiveSubscriptions();
  }, []);
  useEffect(() => {
    const fetchMaxCaptures = async () => {
      try {
        const userMobileNumber = localStorage.getItem("mobileNumber");
        const response = await axios.get(`https://api.leadscruise.com/api/get-max-captures?user_mobile_number=${userMobileNumber}`);

        if (response.data) {
          setMaxCaptures(response.data.maxCaptures);

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

  useEffect(() => {
    const fetchThresholdSettings = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        const response = await axios.get(
          `https://api.leadscruise.com/api/get-threshold?user_email=${userEmail}`
        );

        if (response.data) {
          setThresholdLevel(response.data.thresholdLevel);
          setThresholdScore(response.data.thresholdScore || 0);
          setTempThresholdLevel(response.data.thresholdLevel);

          // Optional: Check if threshold was updated in last 24 hours
          if (response.data.lastUpdatedThreshold) {
            const lastUpdated = new Date(response.data.lastUpdatedThreshold);
            const now = new Date();
            const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);

            if (hoursPassed < 24) {
              setIsEditingThreshold(false);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching threshold settings:", error);
        // Set defaults if fetch fails
        setThresholdLevel('medium');
        setThresholdScore(60);
        setTempThresholdLevel('medium');
      }
    };

    fetchThresholdSettings();
  }, []);

  useEffect(() => {
    const fetchMinOrder = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        const response = await axios.get(`https://api.leadscruise.com/api/get-min-order?userEmail=${userEmail}`);

        if (response.data) {
          setminOrder(response.data.minOrder);
        }
      } catch (error) {
        console.error("Error fetching min order:", error);
      }
    };

    fetchMinOrder();
  }, []);

  const handlePasswordUpdate = async () => {
    try {
      if (!validatePassword(newPassword)) {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        setShowLeadsCruiseValidation(true);
        return;
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-password", {
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

  const handleSavedPasswordUpdate = async () => {
    try {
      if (savedNewPassword.length < 6) {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
        setShowIndiaMartValidation(true);
        return;
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-saved-password", {
        email: localStorage.getItem("userEmail"),
        newPassword: savedNewPassword,
      });

      alert(response.data.message);
      setIsEditingSavedPassword(false);
      setSavedNewPassword("");
      localStorage.setItem("savedPassword", savedNewPassword);
      setShowIndiaMartValidation(false);
    } catch (error) {
      alert("Failed to update password. Try again.");
    }
  };

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

const unlinkWhatsappNumber = async () => {
  const confirmed = window.confirm("Are you sure you want to unlink your WhatsApp number?");
  if (!confirmed) return;

  try {
    const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/whatsapp-logout", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mobileNumber })
    });

    const data = await res.json();
    if (res.ok) {
      alert("WhatsApp unlinked successfully");
      setVerificationCode(null);
      setNewWhatsappNumber("");

      const lockUntil = Date.now() + 1 * 300 * 1000;
      localStorage.setItem("editLockedUntil", lockUntil);
      setEditLockedUntil(lockUntil);
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    console.error("Unlink failed:", err);
    alert("Something went wrong while unlinking WhatsApp");
  }
};

  const downloadLatestRelease = () => {
    if (!latestRelease || !latestRelease.assets || latestRelease.assets.length === 0) {
      setDownloadError("No download available for this release");
      return;
    }

    const windowsAssets = latestRelease.assets.filter(
      asset =>
        asset.name.toLowerCase().includes("windows") ||
        asset.name.toLowerCase().endsWith(".exe") ||
        asset.name.toLowerCase().endsWith(".zip")
    );

    if (windowsAssets.length > 1) {
      windowsAssets.forEach(asset => {
        window.open(asset.browser_download_url, "_blank");
      });
    } else if (windowsAssets.length === 1) {
      window.open(windowsAssets[0].browser_download_url, "_blank");
    } else {
      window.open(latestRelease.assets[0].browser_download_url, "_blank");
    }
  };

  const viewReleaseNotes = () => {
    if (latestRelease) {
      window.open(latestRelease.html_url, "_blank");
    }
  };

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/omkar3060/Lead-Fetcher/releases/latest"
        );

        if (response.ok) {
          const data = await response.json();
          setLatestRelease(data);
        }
      } catch (error) {
        console.error("Error fetching latest release:", error);
      }
    };

    fetchLatestRelease();
  }, []);

  useEffect(() => {
    if (editLockedUntil && Date.now() < editLockedUntil) {
      const timeout = setTimeout(() => {
        setEditLockedUntil(null);
        localStorage.removeItem("editLockedUntil");
      }, editLockedUntil - Date.now());

      return () => clearTimeout(timeout);
    }
  }, [editLockedUntil]);

  useEffect(() => {
    if (justUpdated && verificationCode || (verificationCode === "111")) {
      setEditLockedUntil(null);
      localStorage.removeItem("editLockedUntil");
    }
  }, [verificationCode, justUpdated]);

  const getButtonStyle = (baseColor) => {
    return {
      background: countdown > 0 ? "#6c757d" : baseColor,
      cursor: countdown > 0 ? "not-allowed" : "pointer",
    };
  };

  const getButtonTitle = (action) => {
    return countdown > 0
      ? `${action} locked. Try again in ${countdown}s`
      : `${action} your WhatsApp number`;
  };

  const handleSaveminOrder = async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");

      if (tempMin === minOrder) {
        alert("Minimum order value is unchanged.");
        setIsEditingminOrder(false);
        return;
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-min-order", {
        userEmail,
        minOrder: tempMin,
      });

      setminOrder(tempMin);
      setIsEditingminOrder(false);
      alert(response.data.message);
    } catch (error) {
      if (error.response?.status === 403) {
        alert(error.response.data.message);
      } else {
        console.error("Failed to update minimum order:", error);
        alert(error.response.data.message || "Error updating minimum order. Try again.");
      }
    }
  };

  const handleSaveLeadTypes = async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");

      if (JSON.stringify(leadTypes.sort()) === JSON.stringify(tempLeadTypes.sort())) {
        alert("Lead types are unchanged.");
        setIsEditingLeadTypes(false);
        return;
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-lead-types", {
        userEmail,
        leadTypes: tempLeadTypes,
      });

      setLeadTypes(tempLeadTypes);
      setIsEditingLeadTypes(false);
      alert(response.data.message);
    } catch (error) {
      console.error("Error updating lead types:", error);
      alert("Failed to update lead types. Please try again.");
    }
  };

  useEffect(() => {
    const fetchLeadTypes = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        const response = await axios.get(
          `https://api.leadscruise.com/api/get-lead-types?userEmail=${userEmail}`
        );

        if (response.data.leadTypes) {
          setLeadTypes(response.data.leadTypes);
        }
      } catch (error) {
        console.error("Failed to fetch lead types:", error);
      }
    };

    fetchLeadTypes();
  }, []);

  // Helper function to check if editing should be disabled
  const isEditDisabled = () => {
    return localStorage.getItem("userEmail") === "demo@leadscruise.com" || automationStatus === "Running";
  };

  // Helper function to handle edit button click
  const handleEditClick = (callback) => {
    if (localStorage.getItem("userEmail") === "demo@leadscruise.com") {
      alert("You cannot edit in demo account");
      return;
    }
    if (automationStatus === "Running") {
      alert("You cannot edit while automation is running");
      return;
    }
    callback();
  };

  // Helper function to get score from level
  const getScoreFromLevel = (level) => {
    const scoreMap = {
      'aggressive': 40,
      'mild_aggressive': 50,
      'medium': 60,
      'mild_accurate': 70,
      'accurate': 80
    };
    return scoreMap[level];
  };

  // Helper function to get level display name
  const getLevelDisplayName = (level) => {
    const nameMap = {
      'aggressive': 'Aggressive',
      'mild_aggressive': 'Mild Aggressive',
      'medium': 'Medium',
      'mild_accurate': 'Mild Accurate',
      'accurate': 'Accurate'
    };
    return nameMap[level];
  };

  // Save threshold handler
  const handleSaveThreshold = async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");
      const newScore = getScoreFromLevel(tempThresholdLevel);

      const response = await axios.put(
        `https://api.leadscruise.com/api/settings/threshold/${userEmail}`,
        {
          thresholdLevel: tempThresholdLevel,
          thresholdScore: newScore
        }
      );

      if (response.data.success) {
        setThresholdLevel(tempThresholdLevel);
        setThresholdScore(newScore);
        setIsEditingThreshold(false);

        // Optional: Show success message
        alert('Threshold setting saved successfully!');
      }
    } catch (error) {
      console.error('Error saving threshold:', error);
      alert('Failed to save threshold setting');
    }
  };

  // Cancel edit handler
  const handleCancelThresholdEdit = () => {
    setTempThresholdLevel(thresholdLevel);
    setIsEditingThreshold(false);
  };

  // Main Settings Button Component
  const MiscSettingsButton = ({ userEmail, automationStatus }) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const isEditDisabled = automationStatus === "Running";

    const handleOpenPopup = () => {
      if (isEditDisabled) {
        alert("You cannot edit while automation is running");
        return;
      }
      setIsPopupOpen(true);
    };

    return (
      <>
        <div className="credentials-section">
          <div className="credentials-header">Miscellaneous Settings</div>
          <div className="max-captures-content">
            <span className="credential-value">
              Lead Types, States & Minimum Order
            </span>
            <button
              className="edit-max-captures"
              onClick={handleOpenPopup}
              style={{
                backgroundColor: isEditDisabled ? "#ccc" : "",
                cursor: isEditDisabled ? "not-allowed" : "pointer",
                color: isEditDisabled ? "#666" : ""
              }}
            >
              Configure
            </button>
          </div>
        </div>

        <MiscSettingsPopup
          userEmail={userEmail}
          automationStatus={automationStatus}
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
        />
      </>
    );
  };

  return (
    <div className={`credentials-container ${isProfilePage ? 'profile-page' : ''}`}>
      {isSettingsPage && !isWhatsAppPage && (
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
                  disabled={isEditDisabled()}
                />
                <button
                  className="edit-max-captures"
                  style={{
                    backgroundColor: isEditDisabled() ? "#ccc" : "",
                    cursor: isEditDisabled() ? "not-allowed" : "pointer",
                    color: isEditDisabled() ? "#666" : ""
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleEditClick(handleSaveMaxCaptures);
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <button
                className="edit-max-captures"
                style={{
                  backgroundColor: isEditDisabled() ? "#ccc" : "",
                  cursor: isEditDisabled() ? "not-allowed" : "pointer",
                  color: isEditDisabled() ? "#666" : ""
                }}
                onClick={() => handleEditClick(() => setIsEditingMaxCaptures(true))}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {isSettingsPage && !isWhatsAppPage && (
        <div className="credentials-section">
          <div className="credentials-header">Detection Threshold</div>
          <div className="max-captures-content">
            <span className="credential-value">
              CURRENT: {thresholdLevel.toUpperCase()} (Score: {thresholdScore})
            </span>
            {isEditingThreshold ? (
              <>
                <select
                  className="max-captures-input min-order"
                  value={tempThresholdLevel}
                  onChange={(e) => setTempThresholdLevel(e.target.value)}
                >
                  <option value="aggressive">Aggressive (Score ≥ 40)</option>
                  <option value="mild_aggressive">Mild Aggressive (Score ≥ 50)</option>
                  <option value="medium">Medium (Score ≥ 60)</option>
                  <option value="mild_accurate">Mild Accurate (Score ≥ 70)</option>
                  <option value="accurate">Accurate (Score ≥ 80)</option>
                </select>
                <button
                  className="edit-max-captures"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSaveThreshold();
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <button
                className="edit-max-captures"
                style={{
                  backgroundColor: isEditDisabled() ? "#ccc" : "",
                  cursor: isEditDisabled() ? "not-allowed" : "pointer",
                  color: isEditDisabled() ? "#666" : ""
                }}
                onClick={() => handleEditClick(() => setIsEditingThreshold(true))}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}


      {isSettingsPage && !isWhatsAppPage && (
        <MiscSettingsButton
          userEmail={localStorage.getItem("userEmail")}
          automationStatus={automationStatus}
        />
      )}
      {isWhatsAppPage && (
        <div className="credentials-section">
          <h3 className="credentials-header">WhatsApp Settings</h3>
          <div className="credentials-content">
            <div className="credential-group">
              <label>Your WhatsApp Number</label>
              <div className="whatsapp-number-container">
                {!isEditingWhatsapp ? (
                  <span className="mobile-text">{newWhatsappNumber || "No WhatsApp Number Set"}</span>
                ) : (
                  <input
                    type="text"
                    className="api-key-input"
                    value={newWhatsappNumber}
                    placeholder="Enter new WhatsApp Number..."
                    onChange={(e) => setNewWhatsappNumber(e.target.value)}
                  />
                )}
                {!isEditingWhatsapp ? (
                  verificationCode === "111" ? (
                    <button
                      className="unlink-button"
                      style={getButtonStyle("#000")}
                      disabled={countdown > 0}
                      title={getButtonTitle("Unlink")}
                      onClick={unlinkWhatsappNumber}
                    >
                      Unlink {countdown > 0 && `(${countdown}s)`}
                    </button>
                  ) : (
                    <button
                      className="edit-button"
                      disabled={countdown > 0}
                      title={getButtonTitle("Edit")}
                      style={{
                        backgroundColor: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "#ccc" : "",
                        cursor: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "not-allowed" : "pointer",
                        color: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "#666" : ""
                      }}
                      onClick={() => handleEditClick(() => setIsEditingWhatsapp(true))}
                    >
                      Edit {countdown > 0 && `(${countdown}s)`}
                    </button>
                  )
                ) : (
                  <div className="edit-button-container">
                    <button className="update-api-btn" onClick={updateWhatsappNumber}>Update</button>
                    <button className="cancel-button" onClick={() => setIsEditingWhatsapp(false)}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}

            <div className="verification-code-container">
              <label className="verification-code-label">Linking Status:</label>
              {isLoading ? (
                <div className="loading-spinner">
                  <div className="spinner1"></div>
                  <span></span>
                </div>
              ) : verificationCode ? (
                verificationCode === "111" ? (
                  <div className="already-logged-in-message">
                    <p>Successful!</p>
                  </div>
                ) : (
                  <span className="verification-code">{verificationCode}</span>
                )
              ) : (
                <span className="no-code">Edit and update your number to link</span>
              )}
            </div>
          </div>
        </div>
      )}
      {isSettingsPage && !isWhatsAppPage && (
  <WhatsAppFilterToggle 
    userEmail={localStorage.getItem("userEmail")}
    automationStatus={automationStatus}
  />
)}
      {/* Upgrade Popup Modal - Only shows when non-yearly user clicks buttons */}
      {showUpgradePopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease-out',
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowUpgradePopup(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#999',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0'
              }}
            >
              ×
            </button>

            {/* Lock Icon */}
            <div style={{
              textAlign: 'center',
              fontSize: '64px',
              marginBottom: '20px',
              animation: 'bounce 0.5s ease-in-out'
            }}>
              🔒
            </div>

            {/* Title */}
            <h2 style={{
              color: '#333',
              textAlign: 'center',
              marginBottom: '15px',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Yearly Subscription Required
            </h2>

            {/* Description */}
            <p style={{
              color: '#666',
              textAlign: 'center',
              marginBottom: '25px',
              fontSize: '15px',
              lineHeight: '1.6'
            }}>
              The Desktop Application feature is exclusively available for yearly subscription plans.
              Upgrade your plan to download the desktop app and access release notes.
            </p>

            {/* Current Subscriptions */}
            {activeSubscriptions.length > 0 && (
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '25px'
              }}>
                <p style={{
                  fontSize: '14px',
                  color: '#495057',
                  marginBottom: '12px',
                  fontWeight: '600'
                }}>
                  Your Current Subscriptions:
                </p>
                {activeSubscriptions.map((sub, index) => (
                  <div key={index} style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    marginBottom: index < activeSubscriptions.length - 1 ? '8px' : '0',
                    border: '1px solid #dee2e6'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#333' }}>
                          {sub.type === 'six-mo' ? '📅 6-Month Plan' :
                            sub.type === 'three-mo' ? '📅 3-Month Plan' :
                              sub.type === 'one-mo' ? '📅 Monthly Plan' :
                                sub.type === '7-days' ? '📅 7-Day Trial' : '📅 Subscription'}
                        </strong>
                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                          Expires: {new Date(sub.expirationDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        {sub.daysRemaining} days left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowUpgradePopup(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                  marginBottom: '0'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  setShowUpgradePopup(false);
                  window.location.href = '/plans';
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                  marginBottom: '0'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
              >
                Upgrade to Yearly Plan →
              </button>
            </div>
          </div>

          <style>{`
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }
    `}</style>
        </div>
      )}

      {!isWhatsAppPage && !isSheetsPage && !isSettingsPage && (
        <div className="credentials-section">
          <h3 className="credentials-header"> Leads Provider credentials</h3>
          <div className="credentials-content">
            <div className="credential-group">
              <label>Registered mobile number</label>
              <div className="mobile">
                <span className="mobile-text">{mobileNumber}</span>
                <div className="icon-group">
                  <span className="lock-icon">🔒</span>
                  <span className="info-icon" data-tooltip="Registered mobile number cannot be updated.">ⓘ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isWhatsAppPage && !isSettingsPage && !isSheetsPage && (
        <div className="credentials-section">
          <h3 className="credentials-header">LeadsCruise Credentials</h3>
          <div className="credentials-content">
            <div className="credential-group">
              <label>Registered Email ID</label>
              <div className="mobile">
                <span className="mobile-text">{email}</span>
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
                  <button
                    className="edit-button"
                    style={{
                      backgroundColor: isEditDisabled() ? "#ccc" : "",
                      cursor: isEditDisabled() ? "not-allowed" : "pointer",
                      color: isEditDisabled() ? "#666" : ""
                    }}
                    onClick={() => handleEditClick(() => setIsEditing(true))}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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