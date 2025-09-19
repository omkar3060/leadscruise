import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import "./TaskExecutor.css";
import "./Signin.css";
import "./Plans.css";
import styles from "./Dashboard.module.css";
import loginBg from "../images/login-background.jpg";

// Custom hook for dynamic separator (same as TaskExecutor)
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

const CheckNumber = () => {
  const [mobileNumber, setMobileNumber] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Add the dynamic separator hook
  useDynamicSeparator();

  const handleCheckNumber = async () => {
    if (!mobileNumber) {
      setMessage("Mobile number is required.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      localStorage.setItem("mobileNumber", mobileNumber);
      const response = await axios.post(
        "https://api.leadscruise.com/api/check-number",
        { mobileNumber }
      );

      const data = response.data;

      if (data.exists) {
        // Number already subscribed
        setStatus("error");
        setMessage("Oops, you have already subscribed from this number. Contact Support for more details.");
      } else {
        // Handle OTP scenarios
        if (data.code === 0) {
          setStatus("success");
          setMessage("Great! You are now eligible to subscribe to Leads Cruise.");
        } else {
          setStatus("error");
          setMessage("Oops, something went wrong. Please try again later.");
        }
      }
    } catch (error) {
      setStatus("error");
      setMessage("Error occurred while checking the number.");
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

  return (
    <div className="login-page-container" style={{ backgroundImage: `url(${loginBg})` }}>
      <div className="login-form-wrapper">
        <div className="login-box">
          <div className="login-form-container">
            {status === "idle" && (
              <>
                <h1 className="login-title">Check Number Status</h1>
                <div className="instruction-section">
                  <p className="instruction-text">
                    Enter your Leads Provider login number below and click next to
                    check if you have already subscribed to us.
                  </p>
                  <div className="warning-box">
                    <p className="warning-text">Please enter your mobile number correctly.</p>
                    <p className="warning-text">This will help us verify your subscription status with us.</p>
                  </div>
                </div>
                
                <div className="input-group">
                  <label htmlFor="mobile">Mobile Number</label>
                  <input 
                    type="text" 
                    id="mobile" 
                    placeholder="Enter Your Mobile number"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required 
                  />
                </div>
                
                <p className="confirm-text">
                  By clicking next you confirm to check subscription status
                </p>

                <button onClick={handleCheckNumber} className="login-button">
                  Next
                </button>

                <div className="navigation-links">
                  <p className="back-link" onClick={() => window.history.back()}>
                    Go Back
                  </p>
                  <p className="logout-text">
                    Wish to <span onClick={handleLogout} className="logout-link">Logout</span>?
                  </p>
                </div>

                {message && <p className="error-message">{message}</p>}
              </>
            )}

            {status === "loading" && (
              <div className="loading-content">
                <img
                  src={loadingGif}
                  alt="Loading"
                  className="loading-image"
                />
                <p className="loading-text">Please, wait while AI searches for you.</p>
              </div>
            )}

            {status === "success" && (
              <div className="success-content">
                <h1 className="login-title">Eligibility Confirmed</h1>
                <div className="status-icon">
                  <img
                    src={successImage}
                    alt="Success"
                    className="status-image"
                  />
                </div>
                <p className="status-message">Great! You are now eligible to subscribe to Leads Cruise.</p>
                <p className="confirm-text">
                  Wish to proceed and connect with {mobileNumber}?
                </p>
                <button
                  onClick={() => navigate("/plans")}
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
                <h1 className="login-title">Check Status</h1>
                <div className="status-icon">
                  <img
                    src={errorImage}
                    alt="Error"
                    className="status-image"
                  />
                </div>
                <p className="status-message">
                  {message || "Oops, something went wrong. Please try again later."}
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="login-button"
                >
                  Try Again
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
    </div>
  );
};

export default CheckNumber;