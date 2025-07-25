import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import styles from "./Header.module.css";
import { useNavigate, useLocation } from "react-router-dom";
import { FaCheck, FaUser, FaPlay, FaStop, FaCheckCircle, FaTimesCircle, FaCog, FaWhatsapp, FaFileExcel, FaSignOutAlt, FaArrowLeft, FaSave, FaUndo, FaHeadset, FaWallet } from "react-icons/fa";

const DashboardHeader = ({ status, handleStart, handleStop, isDisabled, handleSubmit, handleRevert, timer, isStarting, cooldownActive, cooldownTime }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
    unique_id: "Loading...",
  });
  const [showPopup, setShowPopup] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const supportEmail = "support@leadscruise.com";
  const whatsappNumber = "+919579797269"; // Replace with actual number
  const [scriptStatus, setScriptStatus] = useState("");
  const [lastTime, setLastTime] = useState(null);
  const isDemoAccount = localStorage.getItem("userEmail") === "demo@leadscruise.com";

  useEffect(() => {
    const fetchStatus = async () => {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        alert("Please log in to view your status.");
        navigate("/login");
        return;
      }
      try {
        const res = await axios.get(`https://api.leadscruise.com/api/user-status?email=${userEmail}`);
        setScriptStatus(res.data.status);
        setLastTime(res.data.startTime); // unified field
      } catch (err) {
        console.error("Error fetching status:", err);
      }
    };

    fetchStatus();
  }, [status, navigate]);

  const formatTime = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${supportEmail}`;
  };

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Hi, I need support with Focus Engineering products.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  // const fetchUserBalance = async () => {
  //   const userEmail = localStorage.getItem("userEmail");
  //   try {
  //     const response = await fetch(`https://api.leadscruise.com/api/user/balance?email=${(userEmail)}`);
  //     if (!response.ok) {
  //       throw new Error('Failed to fetch balance');
  //     }
  //     const data = await response.json();
  //     return data;
  //   } catch (error) {
  //     console.error('Error fetching balance:', error);
  //     return { buyerBalance: 0, hasZeroBalance: true };
  //   }
  // };

  // Add useEffect to fetch balance on component mount
  // useEffect(() => {
  //   const loadBalance = async () => {
  //     setIsLoadingBalance(true);
  //     // Get user email from your auth context or state
  //     const userEmail = localStorage.getItem('userEmail');
  //     if (userEmail) {
  //       const balanceData = await fetchUserBalance(userEmail);
  //       setBalance(balanceData);
  //     }
  //     setIsLoadingBalance(false);
  //   };

  //   loadBalance();

  //   // Optional: Set up interval to refresh balance periodically
  //   const balanceInterval = setInterval(loadBalance, 30000); // Refresh every 30 seconds

  //   return () => clearInterval(balanceInterval);
  // }, []);

  const getBalanceFromStorage = () => {
    try {
      const storedBalance = localStorage.getItem('buyerBalance');
      const balance = storedBalance ? parseFloat(storedBalance) : 0;
      // console.log('Balance retrieved from localStorage:', balance);
      // console.log("Status", status);
      return {
        buyerBalance: balance,
        hasZeroBalance: balance === 0
      };
    } catch (error) {
      console.error('Error getting balance from localStorage:', error);
      return { buyerBalance: 0, hasZeroBalance: true };
    }
  };

  // Your existing component code with balance state
  const [balance, setBalance] = useState(() => getBalanceFromStorage());

  // Simplified useEffect for localStorage balance management
  useEffect(() => {
    // Function to update balance from localStorage
    const updateBalance = () => {
      const newBalance = getBalanceFromStorage();
      setBalance(newBalance);
    };

    // Listen for storage events (when localStorage changes in other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'buyerBalance') {
        updateBalance();
      }
    };

    // Listen for custom balance update events
    const handleBalanceUpdate = (e) => {
      if (e.detail) {
        setBalance(e.detail);
      } else {
        updateBalance();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('balanceUpdated', handleBalanceUpdate);

    // Optional: Set up interval to refresh balance periodically from localStorage
    const balanceInterval = setInterval(updateBalance, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
      clearInterval(balanceInterval);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
          console.warn("No user email found in localStorage.");
          return;
        }

        const response = await axios.get(`https://api.leadscruise.com/api/get-subscription/${userEmail}`);
        const { renewal_date, status, unique_id } = response.data;

        if (!unique_id) {
          console.warn("Unique ID is missing from the response.");
        } else {
          localStorage.setItem("unique_id", unique_id);
        }

        setSubscriptionDetails({ renewal_date, status, unique_id });
        localStorage.setItem("subscriptionDetails", JSON.stringify(response.data));

        if (!renewal_date) {
          console.warn("Invalid renewal date received.");
          return;
        }

        // Calculate days left for renewal
        const renewalDate = new Date(renewal_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
        const diffTime = renewalDate - today;
        const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (remainingDays < 0) {
          remainingDays = 0; // Ensure days left is not negative
        }
        setDaysLeft(remainingDays);
        setIsSubscriptionActive(remainingDays > 0);

        // Show popup only once after login
        const hasSeenPopup = localStorage.getItem("hasSeenPopup");
        // console.log("userEmail", userEmail); 
        if (
          userEmail?.trim().toLowerCase() !== "support@leadscruise.com" &&
          remainingDays > 0 &&
          remainingDays < 3 &&
          !hasSeenPopup
        ) {
          setShowPopup(true);
        } else {
          setShowPopup(false);
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error.response?.data || error.message);

        if (error.response?.data?.message === "No subscription found") {
          const today = new Date().toISOString().split("T")[0];
          setSubscriptionDetails({ renewal_date: today, status: "Expired", unique_id: "Unavailable" });
          localStorage.setItem("subscriptionDetails", JSON.stringify({ renewal_date: today, status: "Expired", unique_id: "Unavailable" }));

          setDaysLeft(0);
          setIsSubscriptionActive(false);

          // Show popup only once after login for expired subscriptions
          const hasSeenPopup = localStorage.getItem("hasSeenPopup");
          if (!hasSeenPopup) {
            setShowPopup(true);
          } else {
            setShowPopup(false);
          }
        }
      }
    };

    fetchSubscriptionDetails();
  }, []);

  const handleStartScript = () => {
    if (!isSubscriptionActive) {
      alert("Your subscription has expired. Please renew to start the AI.");
      navigate("/plans");
      return;
    }
    handleStart();
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    localStorage.setItem("hasSeenPopup", "true");
  };

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    if (window.innerWidth < 768) {
      setShowProfileDropdown(!showProfileDropdown);
    } else {
      navigate("/profile");
    }
  };

  // Navigation handlers
  const handleNavigation = (path) => {
    setShowProfileDropdown(false);
    navigate(path);
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm("Are you sure you want to logout?");

    if (!isConfirmed) return; // Stop if user cancels

    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://app.leadscruise.com/"
          : "http://localhost:3000";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className={styles.dashboardHeader}>
      {/* Subscription Expiry Popup */}
      {showPopup && localStorage.getItem("userEmail") !== "support@leadscruise.com" && localStorage.getItem("userEmail") !== "demo@leadscruise.com" && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            <h2>Subscription Expiring Soon!</h2>
            <p>Your subscription will expire in {daysLeft} day(s). Please renew it to continue using the service.</p>
            <button onClick={() => navigate("/plans")} className={styles.renewButton}>Renew Now</button>
            <button onClick={handleClosePopup} className={styles.closeButton}>Close</button>
          </div>
        </div>
      )}

      <div className={styles.statusSection}>
        {/* If the user is in settings or profile, show 'Return to Dashboard' */}
        {location.pathname === "/settings" || location.pathname === "/profile" || location.pathname === "/whatsapp" || location.pathname === "/analytics" ? (
          <div>
            <div className={styles.statusLabel} onClick={() => navigate("/dashboard")}>
              <FaArrowLeft className={styles.iconOnly} /> <span className={styles.statusText}>Return to Dashboard</span>
            </div>
          </div>
        ) : (
          <div className={styles.statusLabel}>
            {status === "Running" ? (
              <>
                <FaCheckCircle className={styles.iconOnly} /> <span className={styles.statusText}>{status}</span>
              </>
            ) : (
              <>
                <FaTimesCircle className={styles.iconOnly} /> <span className={styles.statusText}>{status}</span>
              </>
            )}
          </div>
        )}

        <div className={styles.startStopButtons}>
          {location.pathname === "/settings" ? (
            <>


              <button
                className={styles.startButton}
                style={{
                  backgroundColor: isDemoAccount ? "#ccc" : "",
                  color: isDemoAccount ? "#666" : "",
                  cursor: isDemoAccount ? "not-allowed" : "pointer"
                }}
                onClick={(e) => {
                  if (isDemoAccount) {
                    alert("You cannot save in demo account");
                    return;
                  }
                  handleSubmit();
                }}
              >
                <FaSave className={styles.iconOnly} />{" "}
                <span className={styles.buttonText}>Save All</span>
              </button>

              <button
                className={styles.stopButton}
                style={{
                  backgroundColor: isDemoAccount ? "#ccc" : "",
                  color: isDemoAccount ? "#666" : "",
                  cursor: isDemoAccount ? "not-allowed" : "pointer"
                }}
                onClick={(e) => {
                  if (isDemoAccount) {
                    alert("You cannot revert in demo account");
                    return;
                  }
                  handleRevert();
                }}
              >
                <FaUndo className={styles.iconOnly} />{" "}
                <span className={styles.buttonText}>Revert All</span>
              </button>
            </>
          ) : location.pathname !== "/profile" && location.pathname !== "/whatsapp" && location.pathname !== "/analytics" ? (
            <>
              <div
                className={status === "Running" || isStarting || cooldownActive ? styles.tooltip1 : ""}
                data-tooltip={
                  cooldownActive
                    ? `Buttons disabled for ${cooldownTime} seconds`
                    : status === "Running"
                      ? "Please visit the WhatsApp page to log in and message buyers if you haven't already."
                      : "Starting the AI..."
                }
              >
                <button
                  className={`${styles.startButton} ${status === "Running" || isStarting || cooldownActive ? styles.disabledButton : ""}`}
                  onClick={handleStartScript}
                  disabled={status === "Running" || isStarting || cooldownActive}
                >
                  {isStarting && status !== "Running" ? (
                    <>
                      <div className={styles.spinnerSmall}></div>
                      <span className={styles.buttonText}>Starting</span>
                    </>
                  ) : status === "Running" ? (
                    <>
                      <FaCheck className={styles.iconOnly} />
                      <span className={styles.buttonText}>Started</span>
                    </>
                  ) : (
                    <>
                      <FaPlay className={styles.iconOnly} />
                      <span className={styles.buttonText}>Start</span>
                    </>
                  )}
                </button>
              </div>

              <div
                className={isDisabled || cooldownActive ? styles.tooltip : ""}
                data-tooltip={
                  cooldownActive
                    ? `Buttons disabled for ${cooldownTime} seconds`
                    : `You have to wait ${timer} seconds to stop the AI`
                }
              >
                <button
                  className={`${styles.stopButton} ${isDisabled || cooldownActive ? styles.disabledButton : ""}`}
                  onClick={handleStop}
                  disabled={isDisabled || cooldownActive || (!status === "Running" && !isStarting)}
                >
                  <FaStop className={styles.iconOnly} />
                  <span className={styles.buttonText}>Stop</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className={styles.profileSection} ref={dropdownRef}>
        {location.pathname === "/profile" ? (
          <>
            {/* Show both Profile & Renew buttons in mobile view */}
            <div className={styles.profileButtonGroup}>

              {isMobile && (
                <button className={styles.profileButton} onClick={toggleProfileDropdown}>
                  <FaUser className={styles.iconOnly} /> <span className={styles.buttonText}>Profile</span>
                </button>
              )}
              <button
                className={styles.subscriptionButton}
                onClick={() => {
                  const userEmail = localStorage.getItem("userEmail");
                  if (userEmail === "demo@leadscruise.com") {
                    alert("You cannot pay in demo account");
                    return;
                  }
                  navigate("/plans");
                }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                disabled={localStorage.getItem("userEmail") === "demo@leadscruise.com"}
                style={{
                  cursor: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "not-allowed" : "pointer",
                  opacity: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? 0.6 : 1
                }}
              >
                <div className={styles.buttonContent}>
                  <div className={styles.daysInfo}>
                    <span className={styles.daysText}>
                      {isHovering ? "Renew now" : daysLeft !== null ? `${daysLeft} days left` : "0 days left"}
                    </span>
                  </div>
                </div>
              </button>

            </div>
          </>
        ) : (
          <div className={styles.profileHeader} style={location.pathname === "/analytics" || location.pathname === "/whatsapp" ? { marginTop: "15px" } : {}}>
            {/* Balance Display for non-profile pages */}
            <div className={`${styles.balanceContainer} ${styles.tooltip2}`} data-tooltip={
              `Shows the latest fetched balance from the Leads provider`
            }>
              <div className={`${styles.balanceDisplay} ${scriptStatus !== 'Running' || balance?.hasZeroBalance
                ? styles.zeroBalance
                : styles.positiveBalance
                }`}>
                <FaWallet className={styles.balanceIcon} />
                <div className={styles.balanceContent}>
                  <span className={styles.balanceLabel}>Balance</span>
                  <span className={styles.balanceAmount}>
                    {scriptStatus === 'Running'
                      ? (balance?.buyerBalance || '0')
                      : 'OFF'
                    }
                  </span>
                </div>
                {(scriptStatus !== 'Running' || balance?.hasZeroBalance) && (
                  <div className={styles.lowBalanceIndicator}>
                    <span className={styles.warningDot}></span>
                  </div>
                )}
              </div>
            </div>

            <button
              className={styles.profileButton}
              onClick={toggleProfileDropdown}

            >
              <FaUser className={styles.iconOnly} /> <span className={styles.buttonText}>Profile</span>
            </button>
          </div>
        )}

        {showProfileDropdown && (
          <div className={styles.profileDropdown}>
            <ul>
              <li onClick={() => handleNavigation("/profile")}><FaUser /> Profile</li>
              <li onClick={() => handleNavigation("/settings")}><FaCog /> Settings</li>
              <li onClick={() => handleNavigation("/whatsapp")}><FaWhatsapp /> WhatsApp</li>
              <li onClick={() => handleNavigation("/sheets")}><FaFileExcel /> Sheets</li>
              {isMobile && (
                <li onClick={() => setIsPopupOpen(true)} className={styles.supportItem}>
                  <FaHeadset /> Contact Support
                </li>
              )}
              <li onClick={handleLogout}><FaSignOutAlt /> Logout</li>
            </ul>
          </div>
        )}

        {isPopupOpen && (
          <div className={styles.popupOverlay} onClick={() => setIsPopupOpen(false)}>
            <div className={styles.popupContent} onClick={e => e.stopPropagation()}>
              <div className={styles.popupHeader}>
                <h2>Contact Support</h2>
                <button
                  className={styles.closeButton}
                  onClick={() => setIsPopupOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className={styles.popupBody}>
                <p>Need help? Our support team is here to assist you.
                  Choose your preferred method to contact us:</p>
                <div className={styles.contactButtons}>
                  <button
                    className={styles.emailButton}
                    onClick={handleEmailClick}
                  >
                    <svg
                      className={styles.mailIcon}
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                    >
                      <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {supportEmail}
                  </button>
                  <button
                    className={styles.whatsappButton}
                    onClick={handleWhatsAppClick}
                  >
                    <svg
                      className={styles.whatsappIcon}
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                    >
                      <path
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                        fill="currentColor"
                      />
                    </svg>
                    Chat on WhatsApp
                  </button>
                </div>
                <p className={styles.responseTime}>Our team typically responds within 24 business hours.</p>
              </div>
            </div>
          </div>
        )}

        <p className={styles.renewalText}>Subscription Next Renewal Date: {subscriptionDetails.renewal_date}</p>
        <p className={styles.renewalText}>
          Last {scriptStatus === "Running" ? "Started" : "Stopped"}: {formatTime(lastTime)}
        </p>
        <p className={styles.renewalText}>Subscription Status: {subscriptionDetails.status}</p>
      </div>
    </div>
  );
};

export default DashboardHeader;
