import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./styles.css";
import "./TaskExecutor.css";
import "./Signin.css";
import "./Plans.css";
import styles from "./Dashboard.module.css";
import loginBg from "../images/login-background.jpg";

// Custom hook for dynamic separator (same as SignIn)
const useDynamicSeparator = () => {
  useEffect(() => {
    const updateSeparatorHeight = () => {
      const loginBox = document.querySelector('.login-box');
      
      // Only apply on larger screens where separator is visible
      if (loginBox && window.innerWidth > 1200) {
        const boxHeight = loginBox.offsetHeight;
        
        // Set CSS custom property for separator height
        document.documentElement.style.setProperty('--separator-height', boxHeight + 'px');
      } else {
        // Reset the custom property on smaller screens
        document.documentElement.style.removeProperty('--separator-height');
      }
    };
    
    // Update on mount
    updateSeparatorHeight();
    
    // Update on window resize
    const handleResize = () => {
      updateSeparatorHeight();
    };
    
    // Update when login box content changes
    const handleMutation = () => {
      setTimeout(updateSeparatorHeight, 100); // Small delay to ensure DOM is updated
    };
    
    // Set up event listeners
    window.addEventListener('resize', handleResize);
    
    // Use MutationObserver to detect changes in login box content
    const observer = new MutationObserver(handleMutation);
    const loginBox = document.querySelector('.login-box');
    
    if (loginBox) {
      observer.observe(loginBox, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);
};

const TypingAnimation = () => {
  const messages = [
    "working 24×7 !",
    "capturing leads automatically !",
    "sending messages on WhatsApp !"
  ];
  
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(50);

  useEffect(() => {
    const handleTyping = () => {
      const currentMessage = messages[currentMessageIndex];
      
      if (isDeleting) {
        setCurrentText(currentMessage.substring(0, currentText.length - 1));
        setTypingSpeed(25);
      } else {
        setCurrentText(currentMessage.substring(0, currentText.length + 1));
        setTypingSpeed(50);
      }

      if (!isDeleting && currentText === currentMessage) {
        setTimeout(() => setIsDeleting(true), 1000); // Pause before deleting
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentMessageIndex, typingSpeed, messages]);

  return (
    <div className="typing-container">
      <span className="static-text">Your LeadsCruise AI is </span>
      <span className="typing-text">
        {currentText}
        <span className="cursor">|</span>
      </span>
    </div>
  );
};

const TaskExecutor = () => {
  const [mobileNumber, setMobileNumber] = useState(localStorage.getItem("mobileNumber") || "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpPopup, setShowOtpPopup] = useState(() => {
    return localStorage.getItem("showOtpPopup") === "true";
  });
  const [otpValue, setOtpValue] = useState('');
  const [otpRequestId, setOtpRequestId] = useState(null);
  const [otpType, setOtpType] = useState("login"); // Track OTP type
  const [showOtpWaitPopup, setShowOtpWaitPopup] = useState(() => {
    return localStorage.getItem("showOtpWaitPopup") === "true";
  });
  const [cancelled, setCancelled] = useState(() => {
    return localStorage.getItem("cancelled") === "true";
  });

  // Add the dynamic separator hook
  useDynamicSeparator();

  const handleOtpSubmit = async () => {
    if (!otpValue || otpValue.length !== 4) {
      alert("Please enter a valid 4-digit OTP");
      return;
    }

    const otpTypeText = otpType === "password_change" ? "password change" : "login";
    const confirmSubmit = window.confirm(`Are you sure you want to submit OTP: ${otpValue} for ${otpTypeText}?`);
    if (!confirmSubmit) return;

    try {
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      await axios.post("https://api.leadscruise.com/api/submit-otp", {
        otp: otpValue,
        userEmail,
        uniqueId,
        requestId: otpRequestId
      });

      setShowOtpPopup(false);
      localStorage.setItem("showOtpPopup", "false");
      setOtpValue('');
      alert("OTP submitted successfully!");
    } catch (error) {
      console.error("Error submitting OTP:", error);
      alert("Failed to submit OTP. Please try again.");
    }
  };

  useEffect(() => {
    const uniqueId = localStorage.getItem("unique_id");
    if (!uniqueId) return;

    const failureInterval = setInterval(async () => {
      const isCancelled = localStorage.getItem("cancelled") === "true";
      const isAlertShown = localStorage.getItem("otp_alert_shown") === "true";

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/check-otp-failure/${uniqueId}`);

        if (response.data.otpFailed) {
          setCancelled(true);
          localStorage.setItem("cancelled", "true");
          localStorage.setItem("showOtpPopup", "true");
          localStorage.setItem("showOtpWaitPopup", "false");
          setShowOtpPopup(true);
          setShowOtpWaitPopup(false);

          if (!isAlertShown) {
            const otpTypeText = otpType === "password_change" ? "password change" : "login";
            alert(`The ${otpTypeText} OTP you entered is incorrect or Something went wrong. Please try again.`);
            localStorage.setItem("otp_alert_shown", "true");
            setStatus("error");
          }
        }
      } catch (err) {
        console.error("API Error:", err);
      }
    }, 2000);

    return () => clearInterval(failureInterval);
  }, [showOtpPopup, otpRequestId]);

  useEffect(() => {
    const uniqueId = localStorage.getItem("unique_id");

    if (!uniqueId) return;

    const otpCheckInterval = setInterval(async () => {
      const cancelled = localStorage.getItem("cancelled") === "true";
      if (cancelled) return;

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/check-otp-request/${uniqueId}`);
        if (response.data.otpRequired) {
          setCancelled(false);
          localStorage.setItem("cancelled", "false");
          setOtpRequestId(response.data.requestId);
          setOtpType(response.data.type || "login");
          setShowOtpPopup(true);
          localStorage.setItem("showOtpPopup", "true");
          setShowOtpWaitPopup(false);
          localStorage.setItem("showOtpWaitPopup", "false");
        }
      } catch (error) {
        // Silently ignore
      }
    }, 2000);

    return () => clearInterval(otpCheckInterval);
  }, [status]);

  const handleTaskExecution = async () => {
    setCancelled(false);
    setShowOtpPopup(false);
    setOtpType("login");
    localStorage.setItem("cancelled", "false");
    localStorage.setItem("otp_alert_shown", "false");
    localStorage.setItem("showOtpPopup", "false");
    const email = localStorage.getItem("userEmail");
    const uniqueId = localStorage.getItem("unique_id");
    
    if (!mobileNumber || !email) {
      setMessage("All fields are required.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const checkResponse = await axios.post("https://api.leadscruise.com/api/check-mobile", {
        mobileNumber,
        email,
      });

      if (checkResponse.status === 409) {
        setStatus("idle");
        alert("This mobile number is already used by another account.");
        return;
      }
    }
    catch (error) {
      if (error.response?.status === 409) {
        setStatus("idle");
        alert("This mobile number is already used by another account.");
        return;
      } else {
        setStatus("idle");
        alert("An error occurred while executing the task.");
        return;
      }
    }

    try {
      localStorage.setItem("savedpassword", password || "");

      const response = await axios.post(
        "https://api.leadscruise.com/api/execute-task",
        {
          mobileNumber,
          email,
          uniqueId,
          password: password || null,
        }
      );

      if (response.data.status === "success") {
        setStatus("success");
        setMessage("Task executed successfully! Details saved.");
      } else {
        setStatus("error");
        setMessage("Task execution failed.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred while executing the task.");
    }
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm("Are you sure you want to logout?");

    if (!isConfirmed) return;

    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      sessionStorage.clear();
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://app.leadscruise.com/"
          : "http://localhost:3000";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const [tryAgainDisabled, setTryAgainDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    const checkExistingCooldown = () => {
      const cooldownStartTime = localStorage.getItem("tryAgainCooldownStart");
      if (cooldownStartTime) {
        const elapsed = Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
        const remaining = 90 - elapsed;

        if (remaining > 0) {
          setStatus("error");
          setTryAgainDisabled(true);
          setCooldownRemaining(remaining);

          const interval = setInterval(() => {
            const newRemaining = 90 - Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
            if (newRemaining <= 0) {
              setStatus("idle");
              setTryAgainDisabled(false);
              setCooldownRemaining(0);
              localStorage.removeItem("tryAgainCooldownStart");
              clearInterval(interval);
            } else {
              setCooldownRemaining(newRemaining);
            }
          }, 1000);

          return () => clearInterval(interval);
        } else {
          localStorage.removeItem("tryAgainCooldownStart");
        }
      }
    };

    checkExistingCooldown();
  }, []);

  useEffect(() => {
    if (status === "error") {
      const cooldownStart = localStorage.getItem("tryAgainCooldownStart");
      if (!cooldownStart) {
        const now = Date.now();
        localStorage.setItem("tryAgainCooldownStart", now.toString());
      }

      const checkCooldown = () => {
        const cooldownStartTime = localStorage.getItem("tryAgainCooldownStart");
        if (cooldownStartTime) {
          const elapsed = Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
          const remaining = 90 - elapsed;

          if (remaining > 0) {
            setTryAgainDisabled(true);
            setCooldownRemaining(remaining);

            const interval = setInterval(() => {
              const newRemaining = 90 - Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
              if (newRemaining <= 0) {
                setTryAgainDisabled(false);
                setCooldownRemaining(0);
                localStorage.removeItem("tryAgainCooldownStart");
                clearInterval(interval);
              } else {
                setCooldownRemaining(newRemaining);
              }
            }, 1000);

            return () => clearInterval(interval);
          } else {
            setTryAgainDisabled(false);
            setCooldownRemaining(0);
            localStorage.removeItem("tryAgainCooldownStart");
          }
        }
      };

      checkCooldown();
    }
  }, [status]);

  return (
    <div className="login-page-container" style={{ backgroundImage: `url(${loginBg})` }}>
      <div className="login-form-wrapper">
        <div className="login-box">
          <div className="login-form-container">
            {status === "idle" && (
              <>
                <h1 className="login-title">Connect Your Account</h1>
                <div className="instruction-section">
                  <p className="instruction-text">Enter the login number to connect your LeadsProvider account to LeadsCruise</p>
                  <div className="warning-box">
                    <p className="warning-text">Do not quit the screen from here until you are prompted to.</p>
                    <p className="warning-text">Once you click next this cannot be undone, please input details correctly!</p>
                  </div>
                </div>
                
                <div className="input-group">
                  <label htmlFor="mobile">Mobile Number</label>
                  <input 
                    type="text" 
                    id="mobile" 
                    placeholder="Mobile Number"
                    value={mobileNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMobileNumber(value);
                      localStorage.setItem("mobileNumber", value);
                    }}
                    required 
                  />
                </div>
                
                <p className="confirm-text">
                  By clicking next you confirm to connect to LeadsCruise
                </p>

                <button onClick={handleTaskExecution} className="login-button">
                  Link Using AI
                </button>

                <div className="navigation-links">
                  <p className="back-link" onClick={() => window.location.reload()}>
                    Go Back
                  </p>
                  <p className="logout-text">
                    Wish to <span onClick={handleLogout} className="logout-link">Logout</span>?
                  </p>
                </div>

                {message && <p className="error-message">{message}</p>}
              </>
            )}

            {status === "loading" && !showOtpPopup && (
              <div className="loading-content">
                <img
                  src={loadingGif}
                  alt="Loading"
                  className="loading-image"
                />
                <p className="loading-text">Please wait while AI processes your task.</p>
              </div>
            )}

            {status === "success" && (
              <div className="success-content">
                <h1 className="login-title">Task Executed</h1>
                <div className="status-icon">
                  <img
                    src={successImage}
                    alt="Success"
                    className="status-image"
                  />
                </div>
                <p className="status-message">Great! Your task was executed successfully.</p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="login-button"
                >
                  Next
                </button>
                <div className="navigation-links">
                  <p className="back-link" onClick={() => window.location.reload()}>
                    Go Back
                  </p>
                  <p className="logout-text">
                    Wish to <span onClick={handleLogout} className="logout-link">Logout</span>?
                  </p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="error-content">
                <h1 className="login-title">Task Execution Failed</h1>
                <div className="status-icon">
                  <img
                    src={errorImage}
                    alt="Error"
                    className="status-image"
                  />
                </div>
                <p className="status-message">
                  Oops, the task execution failed. Try again or contact support. Please make sure you have entered the correct password.
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem("tryAgainCooldownStart");
                    setStatus("idle");
                  }}
                  disabled={tryAgainDisabled}
                  className="login-button"
                >
                  {tryAgainDisabled ? `Try Again in ${cooldownRemaining}s` : "Try Again"}
                </button>
                <div className="navigation-links">
                  <p className="back-link" onClick={() => window.location.reload()}>
                    Go Back
                  </p>
                  <p className="logout-text">
                    Wish to <span onClick={handleLogout} className="logout-link">Logout</span>?
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="login-info-panel">
        <div className="info-box">
          <TypingAnimation />
          <button className="arrow-button" aria-label="More info">↑</button>
        </div>
      </div>

      {/* OTP Popup */}
      {status === "loading" && showOtpPopup && !cancelled && (
        <div className={styles['otp-popup-overlay']}>
          <div className={styles['otp-popup-container']}>
            <h3 className={styles['otp-popup-title']}>
              {otpType === "password_change" ? "Enter Password Change OTP" : "Enter Login OTP"}
            </h3>
            <p className={styles['otp-popup-description']}>
              {otpType === "password_change"
                ? "Please enter the 4-digit OTP sent to your mobile number for password change."
                : "Please enter the 4-digit OTP sent to your mobile number for login."
              }
            </p>
            <input
              type="text"
              value={otpValue}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setOtpValue(value);
              }}
              placeholder="Enter 4-digit OTP"
              className={styles['otp-input']}
              maxLength="4"
              autoFocus
            />

            <div className={styles['otp-buttons']}>
              <button
                onClick={() => {
                  setShowOtpPopup(false);
                  localStorage.setItem("showOtpPopup", "false");
                  setShowOtpWaitPopup(false);
                  localStorage.setItem("showOtpWaitPopup", "false");
                  setOtpValue('');
                  setOtpRequestId(null);
                  setOtpType("login");
                }}
                className={`${styles['otp-button']} ${styles['otp-button-cancel']}`}
              >
                Cancel
              </button>
              <button
                onClick={handleOtpSubmit}
                disabled={otpValue.length !== 4}
                className={`${styles['otp-button']} ${styles['otp-button-submit']}`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskExecutor;