import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";
import styles from "./Dashboard.module.css"; // Import CSS module
import { useNavigate } from "react-router-dom";
const Master = () => {
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState("Not Running");
  const [isDisabled, setIsDisabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    sentences: [],
    wordArray: [],
    h2WordArray: [],
  });
  const [subscriptions, setSubscriptions] = useState([]);

  const fetchSubscriptions = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/get-all-subscriptions`);
      setSubscriptions(response.data);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    const interval = setInterval(fetchSubscriptions, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/get-all-leads");
      setLeads(response.data); // Ensure leads are set properly
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };
  
  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);
  
  const calculateRemainingDays = (createdAt) => {
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate);
    expiryDate.setDate(expiryDate.getDate() + 30); // Monthly subscription (30 days)

    const today = new Date();
    const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    return remainingDays > 0 ? remainingDays : "Expired";
  };
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
      const mobileNumber = localStorage.getItem("mobileNumber");
      const password = localStorage.getItem("password");
      const userEmail = localStorage.getItem("userEmail");
  
      if (!mobileNumber || !password) {
        alert("Mobile number or password not found in local storage!");
        return;
      }
  
      if (!userEmail) {
        alert("User email not found!");
        return;
      }
  
      // Fetch settings
      const response = await axios.get(`http://localhost:5000/api/get-settings/${userEmail}`);
      const userSettings = response.data;
  
      if (!userSettings) {
        alert("No settings found, please configure them first.");
        navigate("/settings");
        return;
      }
  
      // Check if all settings arrays are empty
      if (
        (!userSettings.sentences || userSettings.sentences.length === 0) &&
        (!userSettings.wordArray || userSettings.wordArray.length === 0) &&
        (!userSettings.h2WordArray || userSettings.h2WordArray.length === 0)
      ) {
        alert("Please configure your settings first.");
        navigate("/settings");
        return;
      }
      console.log("Sending the following settings to backend:", userSettings);
      // Start process
      setStatus("Running");
      setIsDisabled(true);
      setTimer(300);
  
      // Send the fetched settings instead of using the state
      const cycleResponse = await axios.post("http://localhost:5000/api/cycle", {
        sentences: userSettings.sentences,
        wordArray: userSettings.wordArray,
        h2WordArray: userSettings.h2WordArray,
        mobileNumber,
        password,
      });
  
      alert(cycleResponse.data.message || "Task started successfully!");
    } catch (error) {
      console.error("Error:", error.response?.data?.message || error.message);
      alert("Failed to start task.");
    }
  };
  
  const handleStop = () => {
    if (isDisabled && timer > 0) {
      alert(`You cannot stop the script until ${Math.ceil(timer / 60)} min are completed.`);
    } else {
      if (window.confirm("Are you sure you want to stop the script?")) {
        setStatus("Not Running");
        setIsDisabled(false);
        setTimer(0);
      }
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar Component */}
      <Sidebar isDisabled={isDisabled} />

      {/* Main Content */}
      <div className={styles.dashboardContent}>
        {/* Header Component */}
        <DashboardHeader
          status={status}
          handleStart={handleStart}
          handleStop={handleStop}
          isDisabled={isDisabled}
          timer={timer}
        />

        {/* Metrics Section */}
        <div className={styles.metricsSection}>
          <div className={styles.metricBox}>{metrics.totalLeadsToday} <br /><span>Total Leads Today</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsThisWeek} <br /><span>Total Leads This Week</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsToday} <br /><span>Replies Sent Today</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsToday} <br /><span>WhatsApp Messages Sent Today</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsToday} <br /><span>Emails Sent Today</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsCaptured} <br /><span>Total Emails Sent</span></div>
          <div className={styles.metricBox}>{metrics.totalLeadsCaptured} <br /><span>Total Leads Captured</span></div>
        </div>

        {/* Recent Leads Table */}
        <div className={styles.leadsSection}>
          <div className={styles.tableHeader}>Active Subscriptions</div>
          <div className={styles.tableWrapper}>
            <table className={styles.leadsTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Order ID</th>
                  <th>Payment ID</th>
                  <th>Order Amount</th>
                  <th>Subscription Start</th>
                  <th>Days Remaining</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length > 0 ? (
                  subscriptions.map((sub, index) => (
                    <tr key={index}>
                      <td>{sub.name}</td>
                      <td>{sub.email}</td>
                      <td>{sub.contact}</td>
                      <td>{sub.order_id}</td>
                      <td>{sub.payment_id}</td>
                      <td>₹{sub.order_amount}</td>
                      <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td>{calculateRemainingDays(sub.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
                      No active subscriptions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Master;
