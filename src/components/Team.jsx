import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import { useNavigate } from "react-router-dom";
import styles from "./Dashboard.module.css";
import "./Team.css";
import { HiUserGroup } from "react-icons/hi";
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

const Team = () => {
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
    const [teammates, setTeammates] = useState({ names: [], phones: [] });
    const [showPopup, setShowPopup] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [error, setError] = useState('');

    const calendarData = [
        { day: 'Friday', date: '20/06/25', newLeads: 10, assigned: 9, inProgress: 4, won: 12, lost: 2 },
        { day: 'Saturday', date: '21/06/25', newLeads: 10, assigned: 9, inProgress: 4, won: 12, lost: 2 },
        { day: 'Sunday', date: '22/06/25', newLeads: 10, assigned: 9, inProgress: 4, won: 12, lost: 2 },
        { day: 'Monday', date: '23/06/25', newLeads: 10, assigned: 9, inProgress: 4, won: 12, lost: 2 },
        { day: 'Tuesday', date: '24/06/25', newLeads: 10, assigned: 9, inProgress: 4, won: 12, lost: 2 }
    ];

    useEffect(() => {
        fetchTeammates();
    }, []);

    const userEmail = localStorage.getItem("userEmail"); // Save this during login

    const fetchTeammates = async () => {
        try {
            const res = await axios.get('https://api.leadscruise.com/api/teammates', {
                params: { userEmail }
            });
            setTeammates(res.data);
        } catch (err) {
            console.error('Error fetching teammates:', err);
        }
    };

    const handleAddTeammate = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            setError("Both fields are required.");
            return;
        }

        try {
            await axios.post('https://api.leadscruise.com/api/teammates', {
                name: newName,
                phone: newPhone,
                userEmail,
            });
            setShowPopup(false);
            setNewName('');
            setNewPhone('');
            setError('');
            fetchTeammates();
            alert("Teammate added successfully!");
        } catch (err) {
            console.error('Error adding teammate:', err);
            setError("Failed to add teammate.");
        }
    };

    const handleDeleteTeammate = async (index) => {
        try {
            await axios.delete('https://api.leadscruise.com/api/teammates', {
                data: { userEmail, index },
            });

            alert("Teammate removed successfully!");
            fetchTeammates(); // Refresh list
        } catch (err) {
            console.error("Failed to delete teammate:", err);
            window.alert("Failed to delete teammate.");
        }
    };

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
            try {
                const response = await axios.get(
                    `https://api.leadscruise.com/api/get-settings/${userEmail}`
                );
                const userSettings = response.data; // Extracting 'settings' from response

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
            setOtpValue('');
            // setOtpRequestId(null);
            alert("OTP submitted successfully!");
            localStorage.setItem("cancelled", "false");
        } catch (error) {
            console.error("Error submitting OTP:", error);
            alert("Failed to submit OTP. Please try again.");
        }
    };

    useEffect(() => {
        const uniqueId = localStorage.getItem("unique_id");

        if (!uniqueId) return; // ⛔ Skip check if cancelled

        const failureInterval = setInterval(async () => {
            const cancelled = localStorage.getItem("cancelled") === "true";
            if (cancelled) return; // 🚫 Skip if cancelled
            try {
                const response = await axios.get(`https://api.leadscruise.com/api/check-otp-failure/${uniqueId}`);
                if (response.data.otpFailed && !cancelled) { // ✅ Ensure popup doesn't reappear
                    setOtpError("Incorrect OTP. Please try again.");
                    setShowOtpPopup(true);
                    localStorage.setItem("showOtpPopup", "true");
                    setShowOtpWaitPopup(false);
                    localStorage.setItem("showOtpWaitPopup", "false");
                }
            } catch (err) {
                // Ignore silently
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

    const handleStartScript = async () => {
        try {
            // Set a "Starting" state
            setIsStarting(true);

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

            if (!mobileNumber || !password) {
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
            console.log("Fetched settings:", userSettings);
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

            console.log("Sending the following settings to backend:", userSettings);

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
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            setIsStarting(false); // Reset starting state after process completes
            alert(
                "AI started successfully!Please navigate to the whatsapp page to login and send messages to the buyers if you already have not done so."
            );
            setStatus("Running");
            // Note: we don't reset isStarting here because the status is now "Running"
        } catch (error) {
            if (error.response?.status === 403) {
                alert("Lead limit reached. Cannot capture more leads today.");
            }
            console.error("Error:", error.response?.data?.message || error.message);
            //alert(error.response?.data?.message || error.message);
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

            if (!mobileNumber || !password) {
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
            //alert(error.response?.data?.message || error.message);
        } finally {
            setIsLoading(false); // Hide loading after process completes or fails
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

    // Function to update settings in localStorage
    const updateSettingsInStorage = (updatedSettings) => {
        try {
            localStorage.setItem('settings', JSON.stringify(updatedSettings));
        } catch (error) {
            console.error('Error updating settings in localStorage:', error);
        }
    };

    // Function to handle toggle action
    const handleToggleRejected = async (leadProduct, isCurrentlyRejected) => {
        const action = isCurrentlyRejected ? 'remove from' : 'add to';
        const confirmMessage = `Are you sure you want to ${action} the rejected list?\n\nProduct: ${leadProduct}`;

        if (!window.confirm(confirmMessage)) {
            return; // User cancelled the action
        }
        try {
            const settings = getSettingsFromStorage();
            if (!settings) {
                console.error('No settings found in localStorage');
                return;
            }

            let updatedH2WordArray = [...(settings.h2WordArray || [])];

            if (isCurrentlyRejected) {
                // Remove from rejected list
                updatedH2WordArray = updatedH2WordArray.filter(item => item !== leadProduct);
            } else {
                // Add to rejected list
                if (!updatedH2WordArray.includes(leadProduct)) {
                    updatedH2WordArray.push(leadProduct);
                }
            }

            // Update settings object
            const updatedSettings = {
                ...settings,
                h2WordArray: updatedH2WordArray
            };

            // Update localStorage
            updateSettingsInStorage(updatedSettings);

            // Make API call to update database
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
                // Force re-render by updating a state variable if needed
                // You might want to call a function to refresh the component
            } else {
                console.error('Failed to update lead status in database');
                // Revert localStorage changes if API call fails
                updateSettingsInStorage(settings);
            }
        } catch (error) {
            console.error('Error updating lead status:', error);
        }
    };

    // Check if a lead is in the rejected list by comparing product text
    const isLeadRejected = (leadProduct) => {
        const settings = getSettingsFromStorage();
        if (!settings || !settings.h2WordArray) {
            return false;
        }
        return settings.h2WordArray.includes(leadProduct);
    };

    const fetchLeads = async () => {
        try {
            setIsLoadingLeads(true);
            const userMobile = localStorage.getItem("mobileNumber");

            if (!userMobile) {
                alert("User mobile number not found!");
                return;
            }

            const response = await axios.get(
                `https://api.leadscruise.com/api/get-user-leads/${userMobile}`
            );

            if (response.status === 200) {
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

    const downloadExcel = () => {
        try {
            // Prepare data for Excel export
            const excelData = leads.map((lead, index) => ({
                'No.': index + 1,
                'Product Requested': lead.lead_bought || '',
                'Address': lead.address || 'N/A',
                'Name': lead.name || '',
                'Email': lead.email || 'N/A',
                'Mobile': lead.mobile?.startsWith('0') ? lead.mobile.slice(1) : lead.mobile || '',
                'Date': formatDate(lead.createdAt) || '',
                'Status': isLeadRejected(lead.lead_bought) ? 'Rejected' : 'Active'
            }));

            // Create CSV content
            const headers = Object.keys(excelData[0]);
            const csvContent = [
                headers.join(','), // Header row
                ...excelData.map(row =>
                    headers.map(header => {
                        const value = row[header] || '';
                        // Escape commas and quotes in data
                        return value.toString().includes(',') || value.toString().includes('"')
                            ? `"${value.toString().replace(/"/g, '""')}"`
                            : value;
                    }).join(',')
                )
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');

            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `leads.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Error downloading Excel file:', error);
            alert('Error downloading file. Please try again.');
        }
    };

    return (
        <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
            {/* {isLoading && <LoadingScreen />} */}
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

            {showOtpPopup && (
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
                        {otpError && (
                            <p className={styles['otp-popup-description']}>{otpError}</p> // 👈 Display error here
                        )}
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
            <div className="dashboard">
                <div className="left-panel">
                    <div className="section-header">
                        <div className="section-title">
                            <div className="team-icon">
                                <HiUserGroup size={40} />
                            </div>
                            <div className="title-text">
                                <div>Team</div>
                                <div>Management</div>
                            </div>
                        </div>
                        <div className="info-icon">ⓘ</div>
                    </div>

                    <div className="action-buttons">
                        <button className="add-teammate-btn" onClick={() => setShowPopup(true)}>
                            <span className="plus-icon">+</span>
                            Add New Teammate
                        </button>
                        <button className="get-report-btn">
                            <span className="download-icon">⬇</span>
                            Get Report
                        </button>
                    </div>

                    <div className="teammates-list">
                        {teammates.names?.map((name, index) => (
                            <div key={index} className="teammate-item">
                                <div className="teammate-info">
                                    <div className="teammate-name">{name}</div>
                                    <div className="teammate-phone">{teammates.phones[index]}</div>
                                </div>
                                <div
                                    className="action-icon remove"
                                    onClick={() => handleDeleteTeammate(index)}
                                >
                                    ×
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* <div className="scroll-indicator">
                        Scroll down to see more
                    </div> */}
                    {showPopup && (
                        <div className="popup-overlay">
                            <div className="popup-container">
                                <h3>Add New Teammate</h3>
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="WhatsApp Number"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                />
                                {error && <p className="error-text">{error}</p>}
                                <div className="popup-actions">
                                    <button onClick={handleAddTeammate}>Save</button>
                                    <button onClick={() => setShowPopup(false)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="right-panel">
                    <div className="calendar-header">
                        <div className="calendar-title">
                            <div className="calendar-icon">📅</div>
                            <div className="title-text">
                                <div>Calendar</div>
                                <div>management</div>
                            </div>
                        </div>
                        <div className="info-icon">ⓘ</div>
                        <button className="get-report-btn calendar-report">
                            <span className="download-icon">⬇</span>
                            Get Report
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {calendarData.map((day, index) => (
                            <div key={index} className="calendar-day">
                                <div className="day-header">
                                    <div className="day-name">{day.day}</div>
                                    <div className="day-date">{day.date}</div>
                                </div>
                                <div className="day-stats">
                                    <div className="stat-item new-leads">
                                        <span className="stat-label">New Leads</span>
                                        <span className="stat-value">: {day.newLeads}</span>
                                    </div>
                                    <div className="stat-item assigned">
                                        <span className="stat-label">Assigned</span>
                                        <span className="stat-value">: 0{day.assigned}</span>
                                    </div>
                                    <div className="stat-item in-progress">
                                        <span className="stat-label">In-progress</span>
                                        <span className="stat-value">: 0{day.inProgress}</span>
                                    </div>
                                    <div className="stat-item won">
                                        <span className="stat-label">Won</span>
                                        <span className="stat-value">: {day.won}</span>
                                    </div>
                                    <div className="stat-item lost">
                                        <span className="stat-label">Lost</span>
                                        <span className="stat-value">: 0{day.lost}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="scroll-indicator">
                        Scroll left to see older stats
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Team;
