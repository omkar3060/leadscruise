import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import { useNavigate } from "react-router-dom";
import styles from "./Dashboard.module.css";
import demoLeads from "../data/demoLeads";
import demoSettings from "../data/demoSettings";
import * as XLSX from "xlsx";

const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="spinner">
        <div className="double-bounce1"></div>
        <div className="double-bounce2"></div>
      </div>
      <div className="loading-text">
        <h3>Loading...</h3>
        <div className="loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
      <p className="loading-message">Please wait</p>
    </div>
  </div>
);

const Sheets = () => {
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [status, setStatus] = useState("Stopped");
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [settings, setSettings] = useState({
    sentences: [],
    wordArray: [],
    h2WordArray: [],
  });
  const [buyerBalance, setBuyerBalance] = useState(null);
  const [isVisible, setIsVisible] = useState(
    localStorage.getItem("isVisible") === "true" || false
  );
  const [messageCount, setMessageCount] = useState(null);
  const [showOtpPopup, setShowOtpPopup] = useState(() => {
    return localStorage.getItem("showOtpPopup") === "true";
  });
  const [otpValue, setOtpValue] = useState('');
  const [otpRequestId, setOtpRequestId] = useState(null);
  const [showOtpWaitPopup, setShowOtpWaitPopup] = useState(() => {
    return localStorage.getItem("showOtpWaitPopup") === "true";
  });
  const [cancelled, setCancelled] = useState(() => {
    return localStorage.getItem("cancelled") === "true";
  });
  const [otpError, setOtpError] = useState('');

  const fetchBuyerBalance = useCallback(async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");

      if (!userEmail) {
        console.error("Please login to your leads provider account first.");
        return;
      }

      const response = await fetch(
        `https://api.leadscruise.com/api/user/balance?email=${userEmail}`
      );
      const data = await response.json();

      setBuyerBalance(data.buyerBalance);
      localStorage.setItem("buyerBalance", data.buyerBalance);
    } catch (error) {
      console.error("Error fetching buyer balance:", error);
    }
  }, []);

  useEffect(() => {
    fetchBuyerBalance();

    const balanceInterval = setInterval(() => {
      fetchBuyerBalance();
    }, 60000);

    return () => clearInterval(balanceInterval);
  }, [status]);

  const ZeroBalanceAlert = () => (
    <div className="maintenance-banner">
      <div className="maintenance-container">
        <div className="maintenance-content">
          <div className="maintenance-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="maintenance-message">
            <span className="mobile-message">
              Dear user, your buyer balance is zero, add more buyer balance or
              wait till next day to capture more leads
            </span>
            <span className="desktop-message">
              Dear user, your buyer balance is zero, add more buyer balance or
              wait till next day to capture more leads
            </span>
          </p>
        </div>
        <button
          className="maintenance-close-button"
          onClick={() => {
            setIsVisible(true);
            localStorage.setItem("isVisible", "true");
          }}
          aria-label="Dismiss maintenance notification"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );

  const zeroBalanceAlertMemo = useMemo(() => {
    if (isVisible == false && buyerBalance === 0 && status === "Running") {
      return <ZeroBalanceAlert />;
    }
    return null;
  }, [buyerBalance, status, isVisible]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
          console.error("Email not found in localStorage.");
          return;
        }

        const response = await axios.get(
          `https://api.leadscruise.com/api/get-status/${userEmail}`
        );
        setStatus(response.data.status || "Stopped");
        localStorage.setItem("status", response.data.status || "Stopped");
        if (response.data.startTime) {
          const startTime = new Date(response.data.startTime);
          const currentTime = new Date();
          const timeElapsed = Math.floor((currentTime - startTime) / 1000);

          if (timeElapsed < 300) {
            setIsDisabled(true);
            setTimer(300 - timeElapsed);
          } else {
            setIsDisabled(false);
          }
        } else {
          setIsDisabled(false);
        }
      } catch (error) {
        console.error("Error fetching script status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("isDisabled", JSON.stringify(isDisabled));
  }, [isDisabled]);

  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(countdown);
    } else if (timer === 0 && isDisabled) {
      setIsDisabled(false);
    }
  }, [timer, isDisabled]);

  useEffect(() => {
    const status = localStorage.getItem("status");

    if (status === "Running") {
      localStorage.setItem("cancelled", "true");
    } else {
      localStorage.setItem("cancelled", "false");
    }
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const userEmail = localStorage.getItem("userEmail");

      if (!userEmail) {
        alert("User email not found!");
        return;
      }
      try {
        const response = await axios.get(
          `https://api.leadscruise.com/api/get-settings/${userEmail}`
        );
        const userSettings = response.data;

        if (!userSettings) {
          alert("No settings found, please configure them first.");
          navigate("/settings");
          return;
        }

        setSettings(userSettings);
        localStorage.setItem(
          "settings", JSON.stringify(userSettings)
        );
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, [navigate]);
  
  const handleOtpSubmit = async () => {
    if (!otpValue || otpValue.length !== 4) {
      alert("Please enter a valid 4-digit OTP");
      return;
    }

    const confirmSubmit = window.confirm(`Are you sure you want to submit OTP: ${otpValue}?`);
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
      localStorage.setItem("cancelled", "true");
      setCancelled(true);
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
            alert("The OTP you entered is incorrect. Please try again.");
            localStorage.setItem("otp_alert_shown", "true");
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

    if (status === "Running" && timer > 210) {
      setShowOtpWaitPopup(true);
      localStorage.setItem("showOtpWaitPopup", "true");
    } else {
      setShowOtpWaitPopup(false);
      localStorage.setItem("showOtpWaitPopup", "false");
    }

    const otpCheckInterval = setInterval(async () => {
      const cancelled = localStorage.getItem("cancelled") === "true";
      if (cancelled || status !== "Running") return;

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/check-otp-request/${uniqueId}`);
        if (response.data.otpRequired) {
          setOtpRequestId(response.data.requestId);
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

  const handleStartScript = async () => {
    try {
      setIsStarting(true);
      setCancelled(false);
      setShowOtpPopup(false);
      localStorage.setItem("cancelled", "false");
      localStorage.setItem("otp_alert_shown", "false");
      localStorage.setItem("showOtpPopup", "false");
      const mobileNumber = localStorage.getItem("mobileNumber");
      const password = localStorage.getItem("savedPassword");
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");
      if (mobileNumber === "9999999999") {
        const result = window.confirm("Demo mode is enabled. Do you want to login?");
        if (result === true) {
          navigate("/signup");
          return;
        }
        else {
          alert("Demo mode is enabled. You can only view the dashboard.");
          setIsStarting(false);
          return;
        }
      }
      try {
        const credCheckRes = await axios.get(
          `https://api.leadscruise.com/api/check-user-credentials/${userEmail}`
        );
        if (credCheckRes.status !== 200) {
          alert("Please login to your leads provider account first.");
          navigate("/execute-task");
          setIsStarting(false);
          return;
        }
      } catch (err) {
        alert(
          err.response?.data?.message || "Error checking stored credentials"
        );
        navigate("/execute-task");
        setIsStarting(false);
        return;
      }

      if (!mobileNumber) {
        alert("Please login to you leads provider account first.");
        navigate("/execute-task");
        setIsStarting(false);
        return;
      }

      if (!userEmail) {
        alert("User email not found!");
        setIsStarting(false);
        return;
      }

      const detailsResponse = await fetch(
        `https://api.leadscruise.com/api/billing/${userEmail}`
      );
      if (!detailsResponse.ok) {
        alert("Please add your billing details first to start.");
        setIsStarting(false);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-settings/${userEmail}`
      );
      const userSettings = response.data;
      console.log("Fetched settings:", userSettings);
      setSettings(response.data);

      if (!userSettings) {
        alert("No settings found, please configure them first.");
        navigate("/settings");
        setIsStarting(false);
        return;
      }

      if (
        (!userSettings.sentences || userSettings.sentences.length < 1) &&
        (!userSettings.wordArray || userSettings.wordArray.length < 1) &&
        (!userSettings.h2WordArray || userSettings.h2WordArray.length < 1)
      ) {
        alert("Please configure your settings first.");
        navigate("/settings");
        setIsStarting(false);
        return;
      }

      console.log("Sending the following settings to backend:", userSettings);

      const cycleResponse = await axios.post(
        "https://api.leadscruise.com/api/cycle",
        {
          sentences: userSettings.sentences,
          wordArray: userSettings.wordArray,
          h2WordArray: userSettings.h2WordArray,
          mobileNumber,
          password,
          uniqueId,
          userEmail,
          minOrder: userSettings.minOrder || 0,
          leadTypes: userSettings.leadTypes || [],
          selectedStates: userSettings.selectedStates || [],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      setIsStarting(false);
      setStatus("Running");
    } catch (error) {
      if (error.response?.status === 403) {
        alert("Lead limit reached. Cannot capture more leads today.");
      }
      console.error("Error:", error.response?.data?.message || error.message);
      setIsStarting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

  useEffect(() => {
    const cooldownEnd = localStorage.getItem("cooldownEnd");

    if (cooldownEnd) {
      const endTime = parseInt(cooldownEnd);
      const currentTime = new Date().getTime();

      if (currentTime < endTime) {
        setCooldownActive(true);

        const remainingTime = Math.ceil((endTime - currentTime) / 1000);
        setCooldownTime(remainingTime);
        setIsDisabled(true);

        const interval = setInterval(() => {
          const newCurrentTime = new Date().getTime();
          const newRemainingTime = Math.ceil((endTime - newCurrentTime) / 1000);

          if (newRemainingTime <= 0) {
            clearInterval(interval);
            setCooldownActive(false);
            setCooldownTime(0);
            setIsDisabled(false);
            localStorage.removeItem("cooldownEnd");
          } else {
            setCooldownTime(newRemainingTime);
          }
        }, 1000);

        return () => clearInterval(interval);
      } else {
        localStorage.removeItem("cooldownEnd");
      }
    }
  }, []);

  const handleStop = async () => {
    if (window.confirm("Are you sure you want to stop the AI?")) {
      setIsLoading(true);

      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      if (!userEmail || !uniqueId) {
        alert("User email or mobile number is missing!");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.post(
          "https://api.leadscruise.com/api/stop",
          { userEmail, uniqueId }
        );
        alert(response.data.message);

        localStorage.setItem("status", "Stopped");
        setStatus("Stopped");

        const cooldownDuration = 60 * 1000;
        const cooldownEnd = new Date().getTime() + cooldownDuration;

        localStorage.setItem("cooldownEnd", cooldownEnd.toString());

        setCooldownActive(true);
        setCooldownTime(60);
        setIsDisabled(true);

        const interval = setInterval(() => {
          setCooldownTime((prevTime) => {
            if (prevTime <= 1) {
              clearInterval(interval);
              setCooldownActive(false);
              setIsDisabled(false);
              return 0;
            }
            return prevTime - 1;
          });
        }, 1000);
      } catch (error) {
        alert(error.response?.data?.message || "Failed to stop the AI.");
        console.error("Error stopping script:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStart = async () => {
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");
      const password = localStorage.getItem("savedPassword");
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      try {
        const credCheckRes = await axios.get(
          `https://api.leadscruise.com/api/check-user-credentials/${userEmail}`
        );
        if (credCheckRes.status !== 200) {
          alert("Please login to your leads provider account first.");
          navigate("/execute-task");
          return;
        }
      } catch (err) {
        alert(
          err.response?.data?.message || "Error checking stored credentials"
        );
        navigate("/execute-task");
        return;
      }

      if (!mobileNumber) {
        alert("Please login to you leads provider account first.");
        navigate("/execute-task");
        return;
      }

      if (!userEmail) {
        alert("User email not found!");
        return;
      }

      const cycleResponse = await axios.post(
        "https://api.leadscruise.com/api/start-fetching-leads",
        {
          mobileNumber,
          password,
          uniqueId,
          userEmail,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Error:", error.response?.data?.message || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  const getSettingsFromStorage = () => {
    try {
      const settings = localStorage.getItem('settings');
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error parsing settings from localStorage:', error);
      return null;
    }
  };

  const updateSettingsInStorage = (updatedSettings) => {
    try {
      localStorage.setItem('settings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error updating settings in localStorage:', error);
    }
  };

  const handleToggleRejected = async (leadProduct, isCurrentlyRejected) => {
    const action = isCurrentlyRejected ? 'remove from' : 'add to';
    const confirmMessage = `Are you sure you want to ${action} the rejected list?\n\nProduct: ${leadProduct}`;

    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      const settings = getSettingsFromStorage();
      if (!settings) {
        console.error('No settings found in localStorage');
        return;
      }

      let updatedH2WordArray = [...(settings.h2WordArray || [])];

      if (isCurrentlyRejected) {
        updatedH2WordArray = updatedH2WordArray.filter(item => item !== leadProduct);
      } else {
        if (!updatedH2WordArray.includes(leadProduct)) {
          updatedH2WordArray.push(leadProduct);
        }
      }

      const updatedSettings = {
        ...settings,
        h2WordArray: updatedH2WordArray
      };

      updateSettingsInStorage(updatedSettings);

      const response = await fetch('https://api.leadscruise.com/api/settings/toggle-rejected-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadProduct: leadProduct,
          action: isCurrentlyRejected ? 'remove' : 'add',
          userEmail: settings.userEmail
        })
      });

      if (response.ok) {
        console.log('Lead status updated successfully');
        alert(`Lead ${isCurrentlyRejected ? 'removed from' : 'added to'} rejected list successfully!`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        console.error('Failed to update lead status in database');
        updateSettingsInStorage(settings);
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const isLeadRejected = (leadProduct) => {
    const settings = getSettingsFromStorage();
    if (!settings || !settings.h2WordArray) {
      return false;
    }
    return settings.h2WordArray.includes(leadProduct);
  };

  const fetchLeads = async () => {
    try {
      const userMobile = localStorage.getItem("mobileNumber");
      console.log("🔍 User mobile from localStorage:", userMobile);
      if (!userMobile) {
        alert("Kindly login to your account first!");
        navigate(-1);
        return;
      }
      setIsLoadingLeads(true);
      
      if (userMobile === "9999999999") {
        setLeads(demoLeads);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-user-leads/${userMobile}`
      );
      console.log("🔍 Raw API response:", response.data);
      console.log("🔍 First lead from API:", response.data.leads[0]);

      if (response.status === 200) {
        console.log("🔍 Sarfaraz lead:", response.data.leads.find(l => l.name === "Sarfaraz"));
        setLeads(response.data.leads);
        setTotalLeads(response.data.totalLeads);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      alert("Error fetching leads: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    const fetchMessageCount = async () => {
      try {
        const mobileNumber = localStorage.getItem("mobileNumber");
        const response = await axios.get(`https://api.leadscruise.com/api/whatsapp-settings/get-message-count?mobileNumber=${mobileNumber}`);

        setMessageCount(response.data.messageCount);
      } catch (error) {
        console.error("Failed to fetch message count:", error);
      }
    };

    fetchMessageCount();
  }, []);

  const calculateMetrics = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    
    const today = new Date(istNow.toISOString().split('T')[0]);
    
    const startOfWeek = new Date(today);
    const day = today.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setUTCDate(today.getUTCDate() - diff);

    const leadsToday = leads.filter((lead) => {
      if (!lead.createdAt) return false;
      const leadDate = new Date(lead.createdAt);
      const leadDateOnly = new Date(leadDate.toISOString().split('T')[0]);
      return leadDateOnly.getTime() === today.getTime();
    });

    const leadsThisWeek = leads.filter((lead) => {
      if (!lead.createdAt) return false;
      const leadDate = new Date(lead.createdAt);
      const leadDateOnly = new Date(leadDate.toISOString().split('T')[0]);
      return leadDateOnly >= startOfWeek;
    });

    return {
      totalLeadsToday: leadsToday.length,
      totalLeadsThisWeek: leadsThisWeek.length,
      totalLeadsCaptured: leads.length,
    };
  };

  const metrics = calculateMetrics();

  const handleDownloadLeadsExcel = () => {
    if (!leads || leads.length === 0) {
      alert("No leads available to download.");
      return;
    }

    const formattedData = leads.map((lead, index) => ({
      "Sl. No": index + 1,
      Name: lead.name || "N/A",
      Email: lead.email || "N/A",
      Phone: lead.mobile || lead.user_mobile_number || "N/A",
      "Product(s)": lead.lead_bought || "N/A",
      "Captured At": new Date(lead.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Total Leads Captured");

    const today = new Date().toISOString().split("T")[0];
    const filename = `Total Leads Captured_${today}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
      {showOtpWaitPopup && !showOtpPopup && !cancelled && (
        <div className={styles['otp-popup-overlay']}>
          <div className={styles['otp-popup-container']}>
            <h3 className={styles['otp-popup-title']}>Please Wait...</h3>
            <p className={styles['otp-popup-description']}>
              We are requesting the OTP. You will be able to enter it shortly.
            </p>
          </div>
        </div>
      )}

      {showOtpPopup && !cancelled && (
        <div className={styles['otp-popup-overlay']}>
          <div className={styles['otp-popup-container']}>
            <h3 className={styles['otp-popup-title']}>Enter OTP</h3>
            <p className={styles['otp-popup-description']}>
              Please enter the 4-digit OTP sent to your mobile number.
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
                  setCancelled(true);
                  localStorage.setItem("cancelled", "true");
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

      {zeroBalanceAlertMemo}

      {isLoading && <LoadingScreen />}

      {(windowWidth > 768 || sidebarOpen) && <Sidebar status={status} />}
      <DashboardHeader
        status={status}
        handleStart={handleStartScript}
        handleStop={handleStop}
        isDisabled={isDisabled}
        timer={timer}
        isStarting={isStarting}
        cooldownActive={cooldownActive}
        cooldownTime={cooldownTime}
      />

      <div style={{ 
        background: "#fff", 
        borderRadius: "8px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)", 
        padding: "20px 40px",
        margin: "0px 20px 15px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>

        <div className={styles.metricsSection}>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsToday")}>
            <strong>{metrics.totalLeadsToday}</strong>
            <span>Leads Purchased Today</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsThisWeek")}>
            <strong>{metrics.totalLeadsThisWeek}</strong>
            <span>Leads Purchased This Week</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsToday")}>
            <strong>{metrics.totalLeadsToday * (settings?.sentences?.length || 0)}</strong>
            <span>Lead Manager Replies Today</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsToday")}>
            <strong>{messageCount * metrics.totalLeadsToday || 0}</strong>
            <span>Whatsapp Replies Today</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsToday")}>
            <strong>{metrics.totalLeadsToday * (settings?.sentences?.length || 0)}</strong>
            <span>Emails Sent Today</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsCaptured")}>
            <strong>{metrics.totalLeadsCaptured * (settings?.sentences?.length || 0)}</strong>
            <span>Total Emails Sent</span>
          </div>
          <div className={styles.metric} onClick={() => navigate("/TotalLeadsCaptured")}>
            <strong>{metrics.totalLeadsCaptured}</strong>
            <span>Total Leads Captured</span>
          </div>
        </div>

        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "4px",
          marginLeft: "20px"
        }}>
          <button className={styles.buttonSmall} onClick={() => navigate("/settings")}>
            Settings
          </button>
          <button className={styles.buttonLarge} 
            onClick={handleDownloadLeadsExcel} 
            style={{ marginBottom: 0 }}
          >
            Download Reports
          </button>
        </div>

      </div>

      <div className="settings-scroll-container">
        <div className="sheets-container">
          <div className="table-container table-container-height">
            {isLoadingLeads ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  backgroundColor: '#fefefe',
                  boxShadow: '0 4px 12px rgba(49, 13, 13, 0.05)',
                  maxWidth: '500px',
                  margin: '40px auto',
                }}
              >
                <div style={{ fontSize: '40px', color: '#999', marginBottom: '16px' }}>
                  <span role="img" aria-label="no leads">📭</span>
                </div>
                <h3 style={{ color: '#555', marginBottom: '8px' }}>No leads found</h3>
                <p style={{ color: '#777', fontSize: '14px' }}>
                  We couldn't find any leads in the last 30 days. Try to fetch them by clicking on the start button.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: '20px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '0px',
                  }}
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={`${styles.leadsTable} ${styles.tablePadding}`}> 
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>No.</th>
                      <th style={{ width: '80px' }}>Tag</th>
                      <th>Product Requested</th>
                      <th>Address</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Date</th>
                      <th style={{ width: '100px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ overflowY: 'auto' }}>
                    {leads.map((lead, index) => {
                      const isRejected = isLeadRejected(lead.lead_bought);
                      return (
                        <tr
                          key={lead._id || index}
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa' }}
                        >
                          <td>{index + 1}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: lead.source === 'AI' ? '#e3f2fd' : '#fff3e0',
                              color: lead.source === 'AI' ? '#1976d2' : '#f57c00',
                              border: `1px solid ${lead.source === 'AI' ? '#90caf9' : '#ffb74d'}`,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {lead.source || 'Normal'}
                            </span>
                          </td>
                          <td>{lead.lead_bought}</td>
                          <td>{lead.address || 'N/A'}</td>
                          <td>{lead.name}</td>
                          <td>{lead.email || 'N/A'}</td>
                          <td>{lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : lead.mobile}</td>
                          <td>
                            {lead.createdAt
                              ? new Date(lead.createdAt).toLocaleString("en-IN", {
                                timeZone: "UTC"
                              })
                              : "N/A"}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleRejected(lead.lead_bought, isRejected)}
                              style={{
                                padding: '8px 0px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '22px',
                                backgroundColor: 'transparent',
                                transition: 'transform 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                                height: '40px',
                              }}
                              onMouseOver={(e) => {
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.transform = 'scale(1)';
                              }}
                              title={isRejected ? 'Remove from Rejected' : 'Add to Rejected'}
                            >
                              {isRejected ? '🚩' : '🏳️'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sheets;