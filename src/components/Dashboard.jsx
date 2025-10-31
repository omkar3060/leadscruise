import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dither from "./Dither.tsx"; // Add this import
import axios from "axios";
import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";
import styles from "./Dashboard.module.css";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import redFlag from "../images/red_flag.png";
import greyFlag from "../images/grey_flag.png";
import { minor } from "@mui/material";
import demoLeads from "../data/demoLeads";
const getScoreColor = (score) => {
  if (!score || isNaN(score) || score === 0) {
    return {
      backgroundColor: '#f5f5f5',
      color: '#999',
      borderColor: '#ddd'
    };
  }
  
  const numScore = parseFloat(score);
  
  if (numScore < 40) {
    return {
      backgroundColor: '#ffebee',
      color: '#c62828',
      borderColor: '#ef5350'
    };
  } else if (numScore >= 40 && numScore < 50) {
    return {
      backgroundColor: '#fff3e0',
      color: '#e65100',
      borderColor: '#ff9800'
    };
  } else if (numScore >= 50 && numScore < 60) {
    return {
      backgroundColor: '#fffde7',
      color: '#f57f17',
      borderColor: '#ffeb3b'
    };
  } else if (numScore >= 60 && numScore < 70) {
    return {
      backgroundColor: '#e3f2fd',
      color: '#1565c0',
      borderColor: '#42a5f5'
    };
  } else if (numScore >= 70 && numScore < 80) {
    return {
      backgroundColor: '#e8f5e9',
      color: '#2e7d32',
      borderColor: '#66bb6a'
    };
  } else { // >= 80
    return {
      backgroundColor: '#c8e6c9',
      color: '#1b5e20',
      borderColor: '#4caf50'
    };
  }
};
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

const Dashboard = () => {
  const [leads, setLeads] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [status, setStatus] = useState("Stopped");
  const [isDisabled, setIsDisabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [canDownloadReports, setCanDownloadReports] = useState(false);
const [subscriptionCheckLoading, setSubscriptionCheckLoading] = useState(true);
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    sentences: [],
    wordArray: [],
    h2WordArray: [],
  });
  const [buyerBalance, setBuyerBalance] = useState(null);
  const [userSubscriptionPlan, setUserSubscriptionPlan] = useState(null);
  const [showZeroBalanceAlert, setShowZeroBalanceAlert] = useState(false);
  const [isVisible, setIsVisible] = useState(
    localStorage.getItem("isVisible") === "true" || false
  );
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    keyword: "",
    type: null,
  });
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
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
 const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);

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
  const fetchUserSubscriptionPlan = async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) return;

      const response = await axios.get(`https://api.leadscruise.com/api/get-user-subscription?email=${userEmail}`);
      setUserSubscriptionPlan(response.data.subscriptionPlan);
      console.log("User subscription plan:", response.data.subscriptionPlan);
    } catch (error) {
      console.error("Failed to fetch subscription plan:", error);
    }
  };

  fetchUserSubscriptionPlan();
}, []);
// Add this useEffect to check active subscriptions
useEffect(() => {
  const checkActiveSubscriptions = async () => {
    try {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        setCanDownloadReports(false);
        setSubscriptionCheckLoading(false);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-active-subscriptions?email=${userEmail}`
      );

      if (response.data.success) {
        setCanDownloadReports(response.data.canDownloadReports);
        
        // Log subscription details for debugging
        console.log("Active Subscriptions:", response.data.activeSubscriptions);
        console.log("Can Download Reports:", response.data.canDownloadReports);
      }
    } catch (error) {
      console.error("Failed to check active subscriptions:", error);
      setCanDownloadReports(false);
    } finally {
      setSubscriptionCheckLoading(false);
    }
  };

  checkActiveSubscriptions();
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

  const fetchLeads = async () => {
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");
      if (!mobileNumber) {
        console.error("Mobile number not found in localStorage.");
        return;
      }

      if (mobileNumber === "9999999999") {
        setLeads(demoLeads);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-leads/${mobileNumber}`
      );
      setLeads(response.data);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

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
    setIsLoading(true);
    fetchLeads().finally(() => {
      setIsLoading(false);
    });
    const interval = setInterval(fetchLeads, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const calculateMetrics = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    const leadsToday = leads.filter((lead) => {
      const leadDate = new Date(lead.createdAt);
      leadDate.setHours(0, 0, 0, 0);
      return leadDate.getTime() === today.getTime();
    });

    const leadsThisWeek = leads.filter((lead) => {
      const leadDate = new Date(lead.createdAt);
      return leadDate >= oneWeekAgo;
    });

    return {
      totalLeadsToday: leadsToday.length,
      totalLeadsThisWeek: leadsThisWeek.length,
      totalLeadsCaptured: leads.length,
    };
  };

  const metrics = calculateMetrics();

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

  const handleStart = async () => {
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
          thresholdScore: userSettings.thresholdScore || 0,
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
      } else if (error.response?.status === 400 && error.response?.data?.route === "/execute-task") {
        alert(error.response.data.message);
        navigate("/execute-task");
      } else {
        console.error("Error:", error.response?.data?.message || error.message);
      }
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

  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (field) => {
    const newSortOrder =
      sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(newSortOrder);
  };

  const sortedLeads = [...leads].sort((a, b) => {
    const valueA = a[sortField] || "";
    const valueB = b[sortField] || "";

    if (sortField === "createdAt") {
      return sortOrder === "asc"
        ? new Date(valueA) - new Date(valueB)
        : new Date(valueB) - new Date(valueA);
    } else {
      return sortOrder === "asc"
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    }
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDownloadDropdown && !event.target.closest('.download-reports-container')) {
        setShowDownloadDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadDropdown]);

  const filterLeadsByDateRange = (dateRange) => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const today = new Date(istNow.toISOString().split('T')[0]);

    let startDate, endDate;

    switch (dateRange) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        break;

      case 'thisWeek':
        startDate = new Date(today);
        const day = today.getUTCDay();
        const diff = day === 0 ? 6 : day - 1;
        startDate.setUTCDate(today.getUTCDate() - diff);
        endDate = new Date(istNow);
        break;

      case 'thisMonth':
        startDate = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
        endDate = new Date(istNow);
        break;

      case 'thisQuarter':
        const currentQuarter = Math.floor(today.getUTCMonth() / 3);
        startDate = new Date(today.getUTCFullYear(), currentQuarter * 3, 1);
        endDate = new Date(istNow);
        break;

      case 'thisYear':
        startDate = new Date(today.getUTCFullYear(), 0, 1);
        endDate = new Date(istNow);
        break;

      case 'yesterday':
        startDate = new Date(today);
        startDate.setUTCDate(startDate.getUTCDate() - 1);
        endDate = new Date(today);
        break;

      case 'previousWeek':
        const prevWeekEnd = new Date(today);
        const dayOfWeek = today.getUTCDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        prevWeekEnd.setUTCDate(today.getUTCDate() - diffToMonday);
        startDate = new Date(prevWeekEnd);
        startDate.setUTCDate(prevWeekEnd.getUTCDate() - 7);
        endDate = prevWeekEnd;
        break;

      case 'previousMonth':
        startDate = new Date(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
        endDate = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
        break;

      case 'previousQuarter':
        const prevQuarter = Math.floor(today.getUTCMonth() / 3) - 1;
        if (prevQuarter < 0) {
          startDate = new Date(today.getUTCFullYear() - 1, 9, 1);
          endDate = new Date(today.getUTCFullYear(), 0, 1);
        } else {
          startDate = new Date(today.getUTCFullYear(), prevQuarter * 3, 1);
          endDate = new Date(today.getUTCFullYear(), (prevQuarter + 1) * 3, 1);
        }
        break;

      case 'previousYear':
        startDate = new Date(today.getUTCFullYear() - 1, 0, 1);
        endDate = new Date(today.getUTCFullYear(), 0, 1);
        break;

      default:
        return leads;
    }

    return leads.filter((lead) => {
      if (!lead.createdAt) return false;
      const leadDate = new Date(lead.createdAt);
      return leadDate >= startDate && leadDate < endDate;
    });
  };

  // Update the handleDownloadLeadsExcel function
// In Dashboard.tsx, update the download reports check:
// Update the handleDownloadLeadsExcel function in Dashboard.jsx
// Update the handleDownloadLeadsExcel function in Dashboard.jsx
const handleDownloadLeadsExcel = async (dateRange = 'all', customStart = null, customEnd = null) => {
  const userEmail = localStorage.getItem("userEmail");
  
  // First, check if user is exclusive
  let isExclusiveUser = false;
  
  try {
    console.log("🔍 Checking exclusive status for:", userEmail);
    const exclusiveCheck = await fetch(`https://api.leadscruise.com/api/check-exclusive/${userEmail}`);
    
    if (exclusiveCheck.ok) {
      const exclusiveData = await exclusiveCheck.json();
      console.log("📊 Exclusive check response:", exclusiveData);
      
      // Strict boolean check
      if (exclusiveData.success === true && exclusiveData.isExclusive === true) {
        console.log("✅ User is exclusive - granting download access");
        isExclusiveUser = true;
      }
    }
  } catch (error) {
    console.error("⚠️ Error checking exclusive status:", error);
  }

  // Determine if user has download access
  const hasDownloadAccess = isExclusiveUser || canDownloadReports;
  
  console.log("🎯 Download access decision:");
  console.log("   - isExclusiveUser:", isExclusiveUser);
  console.log("   - canDownloadReports:", canDownloadReports);
  console.log("   - hasDownloadAccess:", hasDownloadAccess);

  // Block access if user is neither exclusive nor has proper subscription
  if (!hasDownloadAccess) {
    console.log("🚫 Access denied - showing upgrade popup");
    setShowUpgradePopup(true);
    setShowDownloadDropdown(false);
    return;
  }

  console.log("✅ Access granted - proceeding with download");

  // Check if there are leads to download
  if (!leads || leads.length === 0) {
    alert("No leads available to download.");
    return;
  }

  // Rest of your existing download logic...
  let filteredLeads;
  let label;

  if (dateRange === 'custom' && customStart && customEnd) {
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    filteredLeads = leads.filter((lead) => {
      if (!lead.createdAt) return false;
      const leadDate = new Date(lead.createdAt);
      return leadDate >= startDate && leadDate < endDate;
    });

    label = `Custom_${customStart}_to_${customEnd}`;
  } else if (dateRange === 'all') {
    filteredLeads = leads;
    label = 'Total Leads Captured';
  } else {
    filteredLeads = filterLeadsByDateRange(dateRange);
    const dateRangeLabels = {
      'today': 'Today',
      'thisWeek': 'This Week',
      'thisMonth': 'This Month',
      'thisQuarter': 'This Quarter',
      'thisYear': 'This Year',
      'yesterday': 'Yesterday',
      'previousWeek': 'Previous Week',
      'previousMonth': 'Previous Month',
      'previousQuarter': 'Previous Quarter',
      'previousYear': 'Previous Year'
    };
    label = dateRangeLabels[dateRange] || 'Total Leads Captured';
  }

  if (filteredLeads.length === 0) {
    alert("No leads found for the selected date range.");
    return;
  }

  const formattedData = filteredLeads.map((lead, index) => ({
    "Sl. No": index + 1,
    "Tag": lead.source || "Normal",
    "Product Requested": lead.lead_bought || "N/A",
    "Address": lead.address || "N/A",
    "Name": lead.name || "N/A",
    "Email": lead.email || "N/A",
    "Mobile": lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : (lead.mobile || lead.user_mobile_number || "N/A"),
    "Captured At": new Date(lead.createdAt).toLocaleString(),
    "Score": lead.score && !isNaN(lead.score) && lead.score !== 0 ? lead.score.toFixed(2) : "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Total Leads Captured");

  const today = new Date().toISOString().split("T")[0];
  const filename = `${label}_${today}.xlsx`;

  XLSX.writeFile(workbook, filename);
  setShowDownloadDropdown(false);
  
  console.log("✅ Download completed successfully");
};

  // PART 2 - Continuation from handleCustomDateSubmit function

  const handleCustomDateSubmit = () => {
    if (!customStartDate || !customEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    const start = new Date(customStartDate);
    const end = new Date(customEndDate);

    if (start > end) {
      alert('Start date cannot be after end date.');
      return;
    }

    handleDownloadLeadsExcel('custom', customStartDate, customEndDate);
    setShowCustomDateModal(false);
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const handleConfirmAction = async () => {
    const { keyword, type } = confirmModal;
    const rejected = settings.h2WordArray || [];

    let updatedRejected = [...rejected];

    if (type === "reject") {
      if (!updatedRejected.includes(keyword)) {
        updatedRejected.push(keyword);
      }
    } else if (type === "accept") {
      updatedRejected = updatedRejected.filter((word) => word !== keyword);
    }

    const updatedSettings = {
      ...settings,
      h2WordArray: updatedRejected,
    };

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      alert("User email not found!");
      return;
    }

    try {
      await axios.post("https://api.leadscruise.com/api/save-settings", {
        userEmail,
        sentences: updatedSettings.sentences || [],
        wordArray: updatedSettings.wordArray || [],
        h2WordArray: updatedSettings.h2WordArray || [],
      });

      setSettings(updatedSettings);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    }

    setConfirmModal({ open: false, keyword: "", type: null });
  };

  return (
    <div className={styles.dashboardContainer}>
    
    {/* Dither Background */}
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      zIndex: 0 
    }}>
      <Dither
        waveColor={[51/255, 102/255, 128/255]}
        disableAnimation={false}
        enableMouseInteraction={true}
        mouseRadius={0.3}
        colorNum={5}
        waveAmplitude={0.25}
        waveFrequency={2.5}
        waveSpeed={0.03}
        pixelSize={2.5}
      />
    </div>
    {/* Upgrade Popup Modal */}
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
              Subscription Required
            </h2>

            {/* Description */}
            <p style={{ 
              color: '#666',
              textAlign: 'center',
              marginBottom: '25px',
              fontSize: '15px',
              lineHeight: '1.6'
            }}>
              Download Reports feature is only available for 6-month and yearly subscription plans.
              Please upgrade your plan to access this feature.
            </p>

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
                  navigate('/plans');
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
                Go to Plans Page →
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
      {showCustomDateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Select Custom Date Range</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '14px' }}>
                Start Date:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#555', fontSize: '14px' }}>
                End Date:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCustomDateModal(false);
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCustomDateSubmit}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

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

      <Sidebar status={status} />

      <div className={styles.dashboardContent}>
        <DashboardHeader
          status={status}
          handleStart={handleStart}
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
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsToday")}>
              <strong>{metrics.totalLeadsToday}</strong>
              <span>Leads Purchased Today</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsThisWeek")}>
              <strong>{metrics.totalLeadsThisWeek}</strong>
              <span>Leads Purchased This Week</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsToday")}>
              <strong>{metrics.totalLeadsToday * (settings?.sentences?.length || 0)}</strong>
              <span>Lead Manager Replies Today</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsToday")}>
              <strong>{messageCount * metrics.totalLeadsToday || 0}</strong>
              <span>Whatsapp Replies Today</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsToday")}>
              <strong>{metrics.totalLeadsToday * (settings?.sentences?.length || 0)}</strong>
              <span>Emails Sent Today</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsCaptured")}>
              <strong>{metrics.totalLeadsCaptured * (settings?.sentences?.length || 0)}</strong>
              <span>Total Emails Sent</span>
            </div>
            <div className={styles.metric} onClick={() => navigate("/aiTotalLeadsCaptured")}>
              <strong>{metrics.totalLeadsCaptured}</strong>
              <span>Total Leads Captured</span>
            </div>
          </div>

          <div
            className="download-reports-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginLeft: "20px",
              position: "relative"
            }}
          >
            <button className={styles.buttonSmall} onClick={() => navigate("/settings")}>
              Settings
            </button>
           <button
  className={styles.buttonLarge}
  onClick={() => {
    if (subscriptionCheckLoading) {
      alert("Checking subscription status, please wait...");
      return;
    }
    
    // Remove this check - let handleDownloadLeadsExcel decide
    // if (!canDownloadReports) {
    //   setShowUpgradePopup(true);
    //   return;
    // }
    
    setShowDownloadDropdown(!showDownloadDropdown);
  }}
  style={{ 
    marginBottom: 0,
    opacity: subscriptionCheckLoading ? 0.6 : 1,
    cursor: subscriptionCheckLoading ? 'wait' : 'pointer'
  }}
>
  {subscriptionCheckLoading ? "Checking..." : "Download Reports"}
</button>

            {showDownloadDropdown && (
              <div style={{
                position: 'absolute',
                right: 0,
                marginTop: '4px',
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '200px',
                zIndex: 1000,
                overflow: 'hidden'
              }}>
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'This Week', value: 'thisWeek' },
                  { label: 'This Month', value: 'thisMonth' },
                  { label: 'This Quarter', value: 'thisQuarter' },
                  { label: 'This Year', value: 'thisYear' },
                  { label: 'Yesterday', value: 'yesterday' },
                  { label: 'Previous Week', value: 'previousWeek' },
                  { label: 'Previous Month', value: 'previousMonth' },
                  { label: 'Previous Quarter', value: 'previousQuarter' },
                  { label: 'Previous Year', value: 'previousYear' },
                  { label: 'Custom', value: 'custom' }
                ].map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      if (option.value === 'custom') {
                        setShowDownloadDropdown(false);
                        setShowCustomDateModal(true);
                      } else {
                        handleDownloadLeadsExcel(option.value);
                      }
                    }}
                    style={{
                      padding: '12px 20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: option.value === 'thisMonth' ? 'white' : '#333',
                      backgroundColor: option.value === 'thisMonth' ? '#2196F3' : 'white',
                      transition: 'background-color 0.2s ease',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                    onMouseEnter={(e) => {
                      if (option.value !== 'thisMonth') {
                        e.target.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (option.value !== 'thisMonth') {
                        e.target.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.leadsSection} style={{ height: 'calc(100vh - 410px)' }}>
          <div className={styles.mobileOnlyMessage}>
            <p>Use Desktop to login to see recent leads captured information</p>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.leadsTable}>
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>S.No</th>
                  <th onClick={() => handleSort("lead_bought")} style={{ cursor: "pointer" }}>
                    Product
                    {sortField === "lead_bought" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("address")} style={{ cursor: "pointer" }}>
                    Address
                    {sortField === "address" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("name")} style={{ cursor: "pointer" }}>
                    Name
                    {sortField === "name" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("mobile")} style={{ cursor: "pointer" }}>
                    Mobile Number
                    {sortField === "mobile" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("email")} style={{ cursor: "pointer" }}>
                    Email
                    {sortField === "email" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("createdAt")} style={{ cursor: "pointer" }}>
                    Purchase Date
                    {sortField === "createdAt" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th onClick={() => handleSort("score")} style={{ cursor: "pointer", width: "8%" }}>
                    Score
                    {sortField === "score" && (sortOrder === "asc" ? "🔼" : "🔽")}
                  </th>
                  <th style={{ width: "6%" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {sortedLeads.length > 0 ? (
                  sortedLeads.map((lead, index) => {
                    const keyword = lead.lead_bought;
                    const isRejected = Array.isArray(settings?.h2WordArray) && settings.h2WordArray.includes(keyword);

                    return (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{keyword || "N/A"}</td>
                        <td>{lead.address || "N/A"}</td>
                        <td>{lead.name || "N/A"}</td>
                        <td>{lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : lead.mobile || "N/A"}</td>
                        <td>{lead.email || "N/A"}</td>
                        <td>
                          {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata"
                            })
                            : "N/A"}
                        </td>
                        <td>
  {lead.score && !isNaN(lead.score) && lead.score !== 0 ? (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      ...getScoreColor(lead.score),
      border: `1px solid ${getScoreColor(lead.score).borderColor}`,
      whiteSpace: 'nowrap',
      display: 'inline-block'
    }}>
      {lead.score.toFixed(2)}
    </span>
  ) : (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#f5f5f5',
      color: '#999',
      border: '1px solid #ddd',
      whiteSpace: 'nowrap',
      display: 'inline-block'
    }}>
      N/A
    </span>
  )}
</td>
                        <td>
                          <img
                            src={isRejected ? redFlag : greyFlag}
                            alt={isRejected ? "Reject Flag" : "Accept Flag"}
                            style={{
                              width: "20px",
                              height: "20px",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setConfirmModal({
                                open: true,
                                keyword,
                                type: isRejected ? "accept" : "reject",
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
                      No leads available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>
              Are you sure you want to put
              {" "}<strong>{confirmModal.keyword}</strong> into{" "}
              <strong>
                {confirmModal.type === "reject" ? "Rejected" : "Accepted"}
              </strong>
              {" "}
              List?
            </p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
              <button
                onClick={handleConfirmAction}
                style={{
                  marginBottom: "0px",
                  padding: "6px 12px",
                  backgroundColor: "#4caf50",
                  color: "white",
                  border: "none",
                }}
              >
                Okay
              </button>
              <button
                onClick={() =>
                  setConfirmModal({ open: false, keyword: "", type: null })
                }
                style={{
                  marginBottom: "0px",
                  padding: "6px 12px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;