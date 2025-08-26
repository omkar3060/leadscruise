import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";
import styles from "./Dashboard.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, TrendingUp, Target, BarChart3, Users, BookOpen, Video } from 'lucide-react';
import demoLeads from "../data/demoLeads";
import demoSettings from "../data/demoSettings";
import demoAnalytics from "../data/demoAnalytics";

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
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    sentences: [],
    wordArray: [],
    h2WordArray: [],
  });
  const [buyerBalance, setBuyerBalance] = useState(null);
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
  const [userLeads, setUserLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [tableData, setTableData] = useState({
    categories: [] // For future implementation
  });

  const fetchData = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    const savedPassword = localStorage.getItem("savedPassword");
    setIsLoading(true);
    try {
      // Fetch charts and tables data from the API
      if(mobileNumber === "9999999999"){
        setTableData({categories: demoAnalytics.tables.categories});
        // console.log("Using demo table data:", demoAnalytics.tables.categories);
        return;
      }

      const response = await fetch(
        `https://api.leadscruise.com/api/analytics/charts?mobileNumber=${mobileNumber}&savedPassword=${savedPassword}`
      );

      const data = await response.json();

      if (data.success) {
        setTableData({
          categories: data.tables.categories || []
        });
        // console.log("Fetched table data:", data.tables.categories);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {

    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createPieChart = () => {
    const total = 360;
    let currentAngle = 0;

    return pieChartData.map((segment, index) => {
      const angle = (segment.value / 100) * total;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;

      const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
      const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
      const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
      const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M 50 50`,
        `L ${x1} ${y1}`,
        `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      return (
        <path
          key={index}
          d={pathData}
          fill={segment.color}
          className={`${styles.animatedPath} ${styles.segment} ${styles[`segment${index}`]}`}
        />
      );
    });
  };

  const fetchLeadsFromSheets = async () => {
    try {
      const userMobile = localStorage.getItem("mobileNumber");

      if (!userMobile) {
        // Check if alert has already been shown to prevent duplicate alerts
        const alertShown = sessionStorage.getItem("loginAlertShown");
        if (!alertShown) {
          alert("Kindly login to your account first!");
          sessionStorage.setItem("loginAlertShown", "true");
          navigate("/");
        }
        return;
      }

      if(userMobile === "9999999999"){
        setUserLeads(demoLeads);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-user-leads/${userMobile}`
      );

      if (response.status === 200) {
        setUserLeads(response.data.leads);
        setTotalLeads(response.data.totalLeads);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      alert("Error fetching leads: " + (error.response?.data?.message || error.message));
    } finally {
    }
  };

  useEffect(() => {
    fetchLeadsFromSheets();
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

  // Function to fetch balance
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
    // If status changes, check balance immediately
    fetchBuyerBalance();

    const balanceInterval = setInterval(() => {
      fetchBuyerBalance();
    }, 60000); // Check every 60 seconds

    return () => clearInterval(balanceInterval);
  }, [status]); // Remove fetchBuyerBalance from dependency

  // Add zero balance alert component
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

  // Fetch leads from backend
  const fetchLeads = async () => {
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");
      if (!mobileNumber) {
        console.error("Mobile number not found in localStorage.");
        return;
      }

      if(mobileNumber === "9999999999"){
        setLeads(demoLeads);
        return;
      }

      const response = await axios.get(
        `https://api.leadscruise.com/api/get-user-leads/${mobileNumber}`
      );
      setLeads(response.data.leads);
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
          const timeElapsed = Math.floor((currentTime - startTime) / 1000); // Time elapsed in seconds

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
        setIsLoading(false); // Set loading to false after status is fetched
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh status every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("isDisabled", JSON.stringify(isDisabled));
  }, [isDisabled]);

  useEffect(() => {
    setIsLoading(true); // Set loading to true before fetching leads
    fetchLeads().finally(() => {
      setIsLoading(false); // Set loading to false after leads are fetched
    });
    const interval = setInterval(fetchLeads, 10000);
    return () => clearInterval(interval);
  }, []);

  // Countdown Timer Effect
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
  }, []);  // Reacts to status changes in localStorage

  useEffect(() => {
    const fetchSettings = async () => {
      const userEmail = localStorage.getItem("userEmail");

      if (!userEmail) {
        alert("User email not found!");
        return;
      }
      if(userEmail === "demo@leadscruise.com"){
              setSettings(demoSettings); // Use demo settings for testing
              setIsLoading(false); // End loading
              return;
            }
      
      try {
        const response = await axios.get(
          `https://api.leadscruise.com/api/get-settings/${userEmail}`
        );
        const userSettings = response.data; // Extracting 'settings' from response
        // console.log("Fetched settings:", userSettings);
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

  // Calculate metrics based on leads data
  const calculateMetrics = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the start of the current week (Monday)
  const startOfWeek = new Date(today);
  const day = today.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
  const diff = day === 0 ? 6 : day - 1; // if Sunday, go back 6 days to get to Monday
  startOfWeek.setDate(today.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const leadsToday = leads.filter((lead) => {
    const leadDate = new Date(lead.createdAt);
    leadDate.setHours(0, 0, 0, 0);
    return leadDate.getTime() === today.getTime();
  });

  const leadsThisWeek = leads.filter((lead) => {
    const leadDate = new Date(lead.createdAt);
    return leadDate >= startOfWeek;
  });

  return {
    totalLeadsToday: leadsToday.length,
    totalLeadsThisWeek: leadsThisWeek.length,
    totalLeadsCaptured: leads.length,
  };
};

  const metrics = calculateMetrics();

  // Add OTP submission handler
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
      // setOtpRequestId(null);
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
    
    // console.log("Polling - isCancelled:", isCancelled, "isAlertShown:", isAlertShown);
    
    try {
      const response = await axios.get(`https://api.leadscruise.com/api/check-otp-failure/${uniqueId}`);
      // console.log("API Response:", response.data);
      
      if (response.data.otpFailed) {
        // console.log("OTP Failed detected! About to show alert...");
        
        setCancelled(true);
        localStorage.setItem("cancelled", "true");
        localStorage.setItem("showOtpPopup", "true");
        localStorage.setItem("showOtpWaitPopup", "false");
        setShowOtpPopup(true);
        setShowOtpWaitPopup(false);
        
        if (!isAlertShown) {
          // console.log("Showing alert now...");
          alert("The OTP you entered is incorrect. Please try again.");
          localStorage.setItem("otp_alert_shown", "true");
        } else {
          // console.log("Alert already shown, skipping...");
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
      const cancelled = localStorage.getItem("cancelled") === "true"; // ✅ moved inside
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
      // Set a "Starting" state
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
          setIsStarting(false); // Reset starting state on error
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
        setIsStarting(false); // Reset starting state on error
        return;
      }

      if (!userEmail) {
        alert("User email not found!");
        setIsStarting(false); // Reset starting state on error
        return;
      }

      const detailsResponse = await fetch(
        `https://api.leadscruise.com/api/billing/${userEmail}`
      );
      if (!detailsResponse.ok) {
        alert("Please add your billing details first to start.");
        setIsStarting(false); // Reset starting state on error
        return;
      }

      // Fetch settings
      const response = await axios.get(
        `https://api.leadscruise.com/api/get-settings/${userEmail}`
      );
      const userSettings = response.data;
      // console.log("Fetched settings:", userSettings);
      setSettings(response.data);

      if (!userSettings) {
        alert("No settings found, please configure them first.");
        navigate("/settings");
        setIsStarting(false); // Reset starting state on error
        return;
      }

      // Check if all settings arrays are empty
      if (
        (!userSettings.sentences || userSettings.sentences.length < 1) &&
        (!userSettings.wordArray || userSettings.wordArray.length < 1) &&
        (!userSettings.h2WordArray || userSettings.h2WordArray.length < 1)
      ) {
        alert("Please configure your settings first.");
        navigate("/settings");
        setIsStarting(false); // Reset starting state on error
        return;
      }

      // console.log("Sending the following settings to backend:", userSettings);

      // Send the fetched settings instead of using the state
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
      setIsStarting(false); // Reset starting state after process completes
      // alert(
      //   "AI started successfully!Please navigate to the whatsapp page to login and send messages to the buyers if you already have not done so."
      // );
      setStatus("Running");
      // Note: we don't reset isStarting here because the status is now "Running"
    } catch (error) {
      if (error.response?.status === 403) {
        alert("Lead limit reached. Cannot capture more leads today.");
      } else if (error.response?.status === 400 && error.response?.data?.route === "/execute-task") {
        alert(error.response.data.message);
        navigate("/execute-task");
      } else {
        console.error("Error:", error.response?.data?.message || error.message);
        //alert(error.response?.data?.message || error.message);
      }
      setIsStarting(false); // Reset starting state on error
    } finally {
      setIsLoading(false); // Hide loading after process completes or fails
    }
  };

  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

  // Add this useEffect to check the cooldown status when the component mounts
  useEffect(() => {
    // Check if there's an active cooldown in localStorage
    const cooldownEnd = localStorage.getItem("cooldownEnd");

    if (cooldownEnd) {
      const endTime = parseInt(cooldownEnd);
      const currentTime = new Date().getTime();

      if (currentTime < endTime) {
        // Cooldown is still active
        setCooldownActive(true);

        // Calculate remaining time in seconds
        const remainingTime = Math.ceil((endTime - currentTime) / 1000);
        setCooldownTime(remainingTime);
        setIsDisabled(true);

        // Set up interval to update the cooldown timer
        const interval = setInterval(() => {
          const newCurrentTime = new Date().getTime();
          const newRemainingTime = Math.ceil((endTime - newCurrentTime) / 1000);

          if (newRemainingTime <= 0) {
            // Cooldown finished
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
        // Cooldown has expired
        localStorage.removeItem("cooldownEnd");
      }
    }
  }, []);

  // Modify your handleStop function
  const handleStop = async () => {
    if (window.confirm("Are you sure you want to stop the AI?")) {
      setIsLoading(true); // Show loading when stopping

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

        // Update the status in localStorage
        localStorage.setItem("status", "Stopped");
        setStatus("Stopped");

        // Set cooldown for 1 minute (60 seconds)
        const cooldownDuration = 60 * 1000; // 1 minute in milliseconds
        const cooldownEnd = new Date().getTime() + cooldownDuration;

        // Store the cooldown end time in localStorage
        localStorage.setItem("cooldownEnd", cooldownEnd.toString());

        // Update component state
        setCooldownActive(true);
        setCooldownTime(60);
        setIsDisabled(true);

        // Set up interval to update the cooldown timer
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

  const generatePieChartData = () => {
    const green = metrics.totalLeadsCaptured || 0;
    const blue = green * 7;
    const h2Length = settings?.h2WordArray?.length || 0;
    const red = Math.round(blue / (2 * h2Length)) || 0; // Ensure red is at least 0

    const total = green + blue + red;
    if (total === 0) return [];

    return [
      { label: 'Saved', value: Number(((blue / total) * 100).toFixed(2)), color: '#3B82F6' },   // 🔵
      { label: 'Prospects', value: Number(((green / total) * 100).toFixed(2)), color: '#10B981' },      // 🟢
      { label: 'Rejected', value: Number(((red / total) * 100).toFixed(2)), color: '#EF4444' }      // 🔴
    ];
  };

  const pieChartData = generatePieChartData();

  return (
    <div className={`${styles.dashboardContainer} ${styles.dashboardHeight}`}>

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
      {/* <ZeroBalanceAlert/> */}

      {/* Loading Screen */}
      {isLoading && <LoadingScreen />}

      {/* Sidebar Component */}
      <Sidebar status={status} />

      {/* Main Content */}
      <div className={styles.dashboardContent}>
        {/* Header Component */}
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

        {/* Metrics Section */}
        <div className={styles.metricsSection}>
          <div
            onClick={() => navigate("/totalLeadsToday")}
            className={styles.metricBox}
          >
            {metrics.totalLeadsToday} <br />
            <span>Total Leads Today</span>
          </div>
          <div
            onClick={() => navigate("/totalLeadsThisWeek")}
            className={styles.metricBox}
          >
            {metrics.totalLeadsThisWeek} <br />
            <span>Total Leads This Week</span>
          </div>
          <div className={styles.metricBox} onClick={() => navigate("/totalLeadsToday")}>
            {metrics.totalLeadsToday * (settings?.sentences?.length || 0)}
            <br />
            <span>Replies Sent Today</span>
          </div>
          <div className={styles.metricBox} style={{ color: "#28a745" }} onClick={() => navigate("/totalLeadsToday")}>
            {messageCount * metrics.totalLeadsToday || 0}
            <br />
            <span>WA Messages Sent Today</span>
          </div>
          <div className={styles.metricBox} onClick={() => navigate("/totalLeadsToday")}>
            {metrics.totalLeadsToday * (settings?.sentences?.length || 0)}
            <br />
            <span>Emails Sent Today</span>
          </div>
          <div className={styles.metricBox} onClick={() => navigate("/totalLeadsCaptured")}>
            {metrics.totalLeadsCaptured * (settings?.sentences?.length || 0)}
            <br />
            <span>Total Emails Sent</span>
          </div>
          <div className={styles.metricBox} onClick={() => navigate("/totalLeadsCaptured")}>
            {metrics.totalLeadsCaptured} <br />
            <span>Total Leads Captured</span>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.gridContainer}>
            {/* Overall AI Activity Card */}
            <div className={styles.aiActivityCard}>
              <div className={styles.aiActivityHeader}>
                <div className={styles.aiActivityHeaderInner}>
                  <div className={styles.aiBadge}>
                    AI
                  </div>
                </div>
                <TrendingUp size={20} className={styles.icon} />
                <h3 className={styles.cardTitle}>
                  Overall AI Activity
                </h3>
              </div>

              {/* Pie Chart */}
              <div className={styles.pieChartContainer}>
                <svg width="225" height="225" viewBox="0 0 100 100">
                  {createPieChart()}
                </svg>
              </div>

              {/* Legend */}
              <div className={styles.legend}>
                {pieChartData.map((item, index) => (
                  <div key={index} className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className={styles.legendLabel}>{item.label}</span>
                    <span className={styles.legendValue}>
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
              <button className={styles.seeMoreButton} onClick={() => navigate("/ai")}>
                See More
                <span className={styles.linkArrow}>→</span>
              </button>
            </div>

            {/* Attention Required Card */}
            <div className={styles.attentionColumn}>
              <div className={styles.attentionCard}>
                <div className={styles.attentionHeader}>
                  <Target size={20} className={styles.icon} />
                  <h3 className={styles.cardTitle}>
                    System Status
                  </h3>
                </div>

                <div className={styles.systemStatus}>
                  <CheckCircle size={35} className={styles.greenIcon} />
                  <div className={styles.systemStatusTextContainer}>
                    <div className={styles.systemStatusText}>
                      All systems are
                    </div>
                    <div className={styles.systemStatusText}>
                      fully operational
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.attentionCard}>
                <div className={styles.attentionHeader}>
                  <Video size={20} className={styles.icon} />
                  <div className={styles.tutorialText}>
                    New Tutorials Available
                  </div>
                </div>

                <div className={styles.comingSoon}>
                  <AlertTriangle size={24} className={styles.yellowIcon} />
                  <div className={styles.comingSoonText}>
                    Coming Soon
                  </div>
                </div>

                <button className={styles.linkButton} onClick={() => window.open("https://www.youtube.com/@FocusEngineeringProducts", "_blank")}>
                  Go to Youtube Page
                  <span className={styles.linkArrow}>→</span>
                </button>
              </div>
            </div>

            {/* Latest Leads Captured Card */}
            <div className={styles.leadsCard}>
              <div className={styles.leadsHeader}>
                <Target size={20} className={styles.icon} />
                <h3 className={styles.cardTitle}>
                  Latest Leads Captured
                </h3>
              </div>

              <div className={styles.leadsContent}>
                {userLeads && userLeads.length > 0 ? (
                  userLeads.slice(0, 3).map((lead, index) => (
                    <div key={index} className={styles.leadBar}>
                      <div className={styles.leadInfo}>
                        <div className={styles.leadName}>
                          {lead.lead_bought || 'Unknown'}
                        </div>
                        <div className={styles.leadDetails}>
                          <span className={styles.leadPhone}>
                            {lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : lead.mobile}
                          </span>
                          <span className={styles.leadDate}>
                            {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata"
                            })
                            : "N/A"}
                          </span>
                        </div>
                        {lead.source && (
                          <div className={styles.leadSource}>
                            Source: {lead.source}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.noLeads}>
                    <p>No leads found</p>
                  </div>
                )}
              </div>

              <button className={styles.seeMoreButton} onClick={() => navigate("/sheets")}>
                See More
                <span className={styles.linkArrow}>→</span>
              </button>
            </div>

            {/* Analytics Card */}
            <div className={styles.analyticsCard}>
              <div className={styles.analyticsHeader}>
                <BarChart3 size={20} className={styles.icon} />
                <h3 className={styles.cardTitle}>
                  Analytics - Top Products by Leads
                </h3>
              </div>

              <div className={styles.chartContainer}>
                {tableData.categories && tableData.categories.length > 0 ? (
                  <div className={styles.barChart}>
                    {tableData.categories.slice(0, 5).map((item, index) => {
                      const maxLeads = Math.max(...tableData.categories.slice(0, 5).map(cat => cat.leadsConsumed));
                      const percentage = (item.leadsConsumed / maxLeads) * 100;

                      return (
                        <div
                          key={item._id}
                          className={styles.barItem}
                          style={{
                            '--item-delay': `${index * 0.15}s`
                          }}
                        >
                          <div className={styles.barLabel}>
                            <span className={styles.categoryName}>
                              {item.category.length > 30 ?
                                `${item.category.substring(0, 30)}...` :
                                item.category
                              }
                            </span>
                            <span className={styles.leadsCount}>{item.leadsConsumed}</span>
                          </div>
                          <div className={styles.barWrapper}>
                            <div
                              className={styles.barFill}
                              style={{
                                '--target-width': `${percentage}%`,
                                '--animation-delay': `${0.3 + index * 0.2}s`,
                                backgroundColor: `hsl(${210 + index * 15}, 70%, ${60 - index * 5}%)`
                              }}
                            >
                              <div className={styles.barValue}>{item.leadsConsumed}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.noData}>
                    <p>No analytics data available</p>
                  </div>
                )}
              </div>

              <button className={styles.analyticsButton} onClick={() => navigate("/analytics")}>
                Go to Analytics Page
                <span className={styles.linkArrow}>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
