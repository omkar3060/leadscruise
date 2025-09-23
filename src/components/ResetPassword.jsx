import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import Lottie from "lottie-react"; // Add this import
import "./styles.css";
import "./TaskExecutor.css";
import "./Signin.css";
import "./Plans.css";
import styles from "./Dashboard.module.css";
import loginBg from "../images/login-background.jpg";
import logo from "../images/logo_front.png";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import successAnimation from "../animations/success.json"; // Replace with your Lottie JSON file
import errorAnimation from "../animations/error_red.json"; // Replace with your Lottie JSON file
import loadingGif from "../images/loading.gif";
import { Eye, EyeOff } from "lucide-react";

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

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [showError, setShowError] = useState(false);
  const [selected, setSelected] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const token = searchParams.get("token");
  var email = searchParams.get("email");

  email = decodeURIComponent(email);

  // Add the dynamic separator hook
  useDynamicSeparator();

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
      setTimeout(() => navigate("/signin"), 3000);
    }
  }, [token, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 3);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    console.log({ token, newPassword, email });

    setStatus("loading");

    try {
      const response = await fetch("https://api.leadscruise.com/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setStatus("success");
      } else {
        setError(data.message || "Password reset failed");
        setStatus("error");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setStatus("error");
    }
  };

  const strongPasswordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setNewPassword(newPassword);

    if (!strongPasswordRegex.test(newPassword)) {
      setShowError(true);
      setError(
        "Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character."
      );
    } else {
      setError("");
      setShowError(false);
    }
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm("Are you sure you want to logout?");

    if (!isConfirmed) return;

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://app.leadscruise.com/"
          : "http://localhost:3000";
      return;
    }

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
    <div className="login-page-container" style={{ backgroundImage: `url(${loginBg})` }}>
      <div className="login-form-wrapper">
        <div className="login-box">
          <div className="login-form-container">
            {status === "idle" && (
              <>
                <h1 className="login-title">Reset Your Password</h1>
                <div className="instruction-section">
                  <p className="instruction-text">Enter your new password below to reset your account password</p>
                  <div className="warning-box">
                    <p className="warning-text">Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character.</p>
                    <p className="warning-text">Make sure both passwords match before proceeding.</p>
                  </div>
                </div>
                
                <div className="input-group">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="Enter Your Email Address"
                    value={email}
                    name="email"
                    autoComplete="email"
                    readOnly
                    required 
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="newPassword">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? "text" : "password"}
                      id="newPassword" 
                      placeholder="New Password"
                      value={newPassword}
                      onChange={handlePasswordChange}
                      name="password"
                      autoComplete="new-password"
                      onFocus={() => setShowError(true)}
                      onBlur={() => setShowError(false)}
                      required 
                      style={{ paddingRight: '45px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        height: '20px',
                        width: '28px'
                      }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword" 
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    name="confirmpassword"
                    autoComplete="new-password"
                    required 
                  />
                </div>
                
                <p className="confirm-text">
                  By clicking next you confirm to reset your password
                </p>

                <button onClick={handleResetPassword} className="login-button">
                  Reset Password
                </button>

                <div className="navigation-links">
                  <p className="back-link" onClick={() => navigate("/")}>
                    Back to Sign In
                  </p>
                  <p className="logout-text">
                    Need help? <span onClick={handleLogout} className="logout-link">Contact Support</span>
                  </p>
                </div>

                {showError && error && <p className="error-message">{error}</p>}
              </>
            )}

            {status === "loading" && (
              <div className="loading-content">
                <img
                  src={loadingGif}
                  alt="Loading"
                  className="loading-image"
                />
                <p className="loading-text">Please wait while we reset your password.</p>
              </div>
            )}

            {status === "success" && (
              <div className="success-content">
                <h1 className="login-title">Password Changed</h1>
                <div className="status-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Lottie 
                    animationData={successAnimation}
                    className="status-animation"
                    loop={false}
                    autoplay={true}
                    style={{ 
                      width: '100px', 
                      height: '100px' 
                    }}
                  />
                </div>
                <p className="status-message">Great!! Password Successfully Updated.</p>
                <p className="confirm-text">
                  You can now sign in with your new password by clicking next.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="login-button"
                >
                  Sign In
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
                <h1 className="login-title">Reset Failed</h1>
                <div className="status-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Lottie 
                    animationData={errorAnimation}
                    className="status-animation"
                    loop={true}
                    autoplay={true}
                    style={{ 
                      width: '100px', 
                      height: '100px' 
                    }}
                  />
                </div>
                <p className="status-message">
                  Oops! There was a problem updating your password. Try again to update your password.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="login-button"
                >
                  Try Again
                </button>
                <div className="navigation-links">
                  <p className="back-link" onClick={() => navigate("/")}>
                    Back to Sign In
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

export default ResetPassword;