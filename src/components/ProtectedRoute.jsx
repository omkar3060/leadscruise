import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Styled component approach using template literals and CSS-in-JS
const styles = {
  alertContainer: `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  `,
  alertBox: `
    background-color: #fff;
    border-left: 4px solid #e53e3e;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    max-width: 450px;
    width: 100%;
    padding: 16px;
    animation: slideDown 0.4s ease-out forwards;
  `,
  alertContent: `
    display: flex;
    align-items: flex-start;
  `,
  iconContainer: `
    flex-shrink: 0;
  `,
  messageContainer: `
    margin-left: 12px;
    flex-grow: 1;
  `,
  alertTitle: `
    color: #c53030;
    font-weight: 700;
    font-size: 16px;
    margin: 0;
  `,
  alertMessage: `
    color: #742a2a;
    margin-top: 8px;
    font-size: 14px;
  `,
  dismissButton: `
    color: #c53030;
    background: none;
    border: none;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
    border-radius: 4px;
    margin-bottom:0px;
    transition: background-color 0.2s;
  `,
  dismissButtonHover: `
    background-color: rgba(229, 62, 62, 0.1);
    outline: none;
  `,
  animations: `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `
};

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");
  const location = useLocation();
  const navigate = useNavigate(); // Add this line
  const [isHovering, setIsHovering] = useState(false);

  const handleDismiss = () => {
    setShowAlert(false);
    navigate(-1);
  };

  useEffect(() => {
    // Handle unauthorized access scenarios
    if (!token) {
      setAlertMessage("You must be signed in to access this page!");
      setShowAlert(true);

      const redirectTimer = setTimeout(() => {
        setShowAlert(false);
        navigate('/'); // Use navigate instead of redirect
      }, 3000);

      return () => clearTimeout(redirectTimer);
    }

    if (adminOnly && userRole !== "admin") {
      setAlertMessage("Access denied. Admins only.");
      setShowAlert(true);

      const redirectTimer = setTimeout(() => {
        setShowAlert(false);
        navigate('/dashboard');
      }, 3000);

      return () => clearTimeout(redirectTimer);
    }


    if (userRole === "admin" && location.pathname !== "/master") {
      setAlertMessage("Admins are redirected to the Master Page.");
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
        navigate("/master"); // Redirect admin to master page
      }, 2000);
    }
  }, [token, userRole, adminOnly, location.pathname, navigate]);


  // Render alert component
  const renderAlert = () => {
    if (!showAlert) return null;

    return (
      <div style={{ cssText: styles.alertContainer }}>
        <div style={{ cssText: styles.alertBox }}>
          <div style={{ cssText: styles.alertContent }}>
            <div style={{ cssText: styles.iconContainer }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#e53e3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 8V12" stroke="#e53e3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="16" r="1" fill="#e53e3e" />
              </svg>
            </div>
            <div style={{ cssText: styles.messageContainer }}>
              <h3 style={{ cssText: styles.alertTitle }}>Authentication Required</h3>
              <p>{alertMessage}</p>
              <button
                type="button"
                onClick={handleDismiss}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{ cssText: `${styles.dismissButton} ${isHovering ? styles.dismissButtonHover : ''}` }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Remove hardcoded alerts and use more robust navigation
  if (!token) {
    return renderAlert();
  }

  if (adminOnly && userRole !== "admin") {
    return renderAlert();
  }

  if (userRole === "admin" && location.pathname !== "/master") {
    return renderAlert();
  }

  return children;
};

export default ProtectedRoute;