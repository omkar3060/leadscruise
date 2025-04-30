import React, { useEffect, useState } from "react";
import "./MaintenanceBanner.css"; // Import the CSS file

const MaintenanceBanner = () => {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const checkMaintenanceStatus = async () => {
    try {
      const res = await fetch("https://api.leadscruise.com/api/maintenance-status");
      const data = await res.json();
      setIsMaintenance(data.maintenanceOngoing);
    } catch (error) {
      console.error("Failed to fetch maintenance status:", error);
    }
  };

  useEffect(() => {
    checkMaintenanceStatus();

    // Re-check every 5 minutes
    const interval = setInterval(checkMaintenanceStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isMaintenance || !isVisible) return null;

  return (
    <div className="maintenance-banner">
      <div className="maintenance-container">
        <div className="maintenance-content">
          <div className="maintenance-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="maintenance-message">
            <span className="mobile-message">System maintenance in progress</span>
            <span className="desktop-message">System maintenance is currently in progress. You may experience temporary disruptions.</span>
          </p>
        </div>
        <button 
          className="maintenance-close-button"
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss maintenance notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MaintenanceBanner;