import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";
import styles from "./Dashboard.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";
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

  // Fetch leads from backend
  const fetchLeads = async () => {
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");
      if (!mobileNumber) {
        console.error("Mobile number not found in localStorage.");
        return;
      }

      const response = await axios.get(`http://localhost:5000/api/get-leads/${mobileNumber}`);
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

        const response = await axios.get(`http://localhost:5000/api/get-status/${userEmail}`);
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
    fetchLeads()
      .finally(() => {
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
    const fetchSettings = async () => {
      const userEmail = localStorage.getItem("userEmail");

      if (!userEmail) {
        alert("User email not found!");
        return;
      }
      try {
        const response = await axios.get(`http://localhost:5000/api/get-settings/${userEmail}`);
        const userSettings = response.data // Extracting 'settings' from response

        if (!userSettings) {
          alert("No settings found, please configure them first.");
          navigate("/settings");
          return;
        }

        setSettings(userSettings);
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

  const handleStart = async () => {
    try {
      // Set a "Starting" state
      setIsStarting(true);

      const mobileNumber = localStorage.getItem("mobileNumber");
      const password = localStorage.getItem("savedPassword");
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      try {
        const credCheckRes = await axios.get(`http://localhost:5000/api/check-user-credentials/${userEmail}`);
        if (credCheckRes.status !== 200) {
          alert("Please login to your leads provider account first.");
          navigate("/execute-task");
          setIsStarting(false);
          return;
        }
      } catch (err) {
        alert(err.response?.data?.message || "Error checking stored credentials");
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

      const detailsResponse = await fetch(`http://localhost:5000/api/billing/${userEmail}`);
      if (!detailsResponse.ok) {
        alert("Please add your billing details first to start.");
        setIsStarting(false); // Reset starting state on error
        return;
      }

      // Fetch settings
      const response = await axios.get(`http://localhost:5000/api/get-settings/${userEmail}`);
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
      const cycleResponse = await axios.post("http://localhost:5000/api/cycle", {
        sentences: userSettings.sentences,
        wordArray: userSettings.wordArray,
        h2WordArray: userSettings.h2WordArray,
        mobileNumber,
        password,
        uniqueId,
        userEmail,
      });
      setIsStarting(false); // Reset starting state after process completes
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
        const response = await axios.post("http://localhost:5000/api/stop", { userEmail, uniqueId });
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
          setCooldownTime(prevTime => {
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
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"

  // Function to handle sorting
  const handleSort = (field) => {
    const newSortOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(newSortOrder);
  };

  // Sorting logic
  const sortedLeads = [...leads].sort((a, b) => {
    const valueA = a[sortField] || ""; // Handle empty values
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

  const handleDownloadLeadsExcel = () => {
    if (!leads || leads.length === 0) {
      alert("No leads available to download.");
      return;
    }

    const formattedData = leads.map((lead, index) => ({
      "Sl. No": index + 1,
      "Name": lead.name || "N/A",
      "Email": lead.email || "N/A",
      "Phone": lead.mobile || lead.user_mobile_number || "N/A",
      "Product(s)": lead.lead_bought || "N/A",
      "Captured At": new Date(lead.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "RecentLeads");

    const today = new Date().toISOString().split("T")[0];
    const filename = `Captured_${today}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className={styles.dashboardContainer}>
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
          <div className={styles.metricBox}>{metrics.totalLeadsToday} <br /><span>Total Leads Today</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsThisWeek} <br /><span>Total Leads This Week</span></div>
          <div className={styles.metricBox}>
            {metrics.totalLeadsToday * (settings?.sentences?.length || 0)} <br />
            <span>Replies Sent Today</span>
          </div>
          <div className={styles.comingSoon} style={{ "color": "#28a745" }}>Coming soon<br /><span>WA Messages Sent Today</span></div>
          <div className={styles.comingSoon}>{metrics.totalLeadsToday * (settings?.sentences?.length || 0)} <br /><span>Emails Sent Today</span></div>
          <div className={styles.comingSoon}>{metrics.totalLeadsCaptured * (settings?.sentences?.length || 0)} <br /><span>Total Emails Sent</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsCaptured} <br /><span>Total Leads Captured</span></div>
        </div>

        {/* Recent Leads Table */}
        <div className={styles.leadsSection}>
          <div className={styles.mobileOnlyMessage}>
            <p>Use Desktop to login to see recent leads captured information</p>
          </div>


          <div style={{ display: "flex", justifyContent: "end" }}>
            <button style={{ width: "10%", padding: "20px 60px" }} onClick={handleDownloadLeadsExcel}>Download</button>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.leadsTable}>
              <thead>
                <tr>
                  {[
                    { label: "Product", field: "lead_bought" },
                    { label: "Name", field: "name" },
                    { label: "Mobile Number", field: "mobile" },
                    { label: "Email", field: "email" },
                    { label: "Purchase Date", field: "createdAt" },
                  ].map(({ label, field }) => (
                    <th key={field} onClick={() => handleSort(field)} style={{ cursor: "pointer" }}>
                      {label} {sortField === field && (sortOrder === "asc" ? "🔼" : "🔽")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLeads.length > 0 ? (
                  sortedLeads.map((lead, index) => (
                    <tr key={index}>
                      <td>{lead.lead_bought || "N/A"}</td>
                      <td>{lead.name || "N/A"}</td>
                      <td>{lead.mobile || "N/A"}</td>
                      <td>{lead.email || "N/A"}</td>
                      <td>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "N/A"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>No leads available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
        <div className={styles.scrollDownText}>
          scroll down to see old captured leads
        </div>
      </div>

    </div>
  );
};

export default Dashboard;