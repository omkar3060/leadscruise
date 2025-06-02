import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import masterstyles from "./Master.module.css"; // Import CSS module
import BillingModal from "./BillingModal";
import * as XLSX from "xlsx";
import styles from "./Profile.module.css";
import { useNavigate } from "react-router-dom";
const Master = () => {
  const [isDisabled, setIsDisabled] = useState(false);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState({
    subscriptionsToday: 0,
    subscriptionsThisWeek: 0,
    pendingBilling: 0,
    expiringWithinThreeDays: 0,
    expirinedSubscriptions: 0,
    totalActiveUsers: 0,
    totalUsers: 0,
  });
  const [isMaintenance, setIsMaintenance] = useState(() => {
    const stored = localStorage.getItem("isMaintenance");
    return stored ? JSON.parse(stored) : false;
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadedInvoices, setUploadedInvoices] = useState({});
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const subscriptionMapping = {
    "one-mo": "One Month",
    "three-mo": "Three Months",
    "six-mo": "Six Months",
    "year-mo": "One Year"
  };
  const [searchTerm, setSearchTerm] = useState('');

  // Add this function to your component
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Add this function to filter the subscriptions
  // Updated filtering function with safety checks
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (sub.unique_id?.toString() || '').toLowerCase().includes(searchLower) ||
      (sub.email?.toString() || '').toLowerCase().includes(searchLower) ||
      (sub.refId?.toString() || '').toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    fetchSubscriptionMetrics();
    fetchSubscriptions();
  }, []);

  const fetchSubscriptionMetrics = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/get-subscription-metrics");
      setSubscriptionMetrics(response.data);
    } catch (error) {
      console.error("Error fetching subscription metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/get-all-subscriptions");
      setSubscriptions(response.data);
      fetchUploadedInvoices(response.data);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (subscriptions.length === 0) {
      alert("No data available to download.");
      return;
    }

    const formattedData = subscriptions.map((sub) => ({
      "Email": sub.email,
      "Contact": sub.contact,
      "Subscription Type": sub.subscription_type,
      "Order ID": sub.unique_id,
      "Order Amount (₹)": sub.order_amount / 100,
      "Subscription Start": new Date(sub.created_at).toLocaleDateString(),
      "Days Remaining": calculateRemainingDays(sub.created_at, sub.subscription_type),
      "Referral ID": sub.refId || "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");

    // Generate XLSX and trigger download
    XLSX.writeFile(workbook, "Subscriptions.xlsx");
  };

  const calculatePendingBilling = (subs, invoiceStatus) => {
    const pendingBillingCount = subs.length - Object.values(invoiceStatus).filter((url) => url !== null).length;
    setSubscriptionMetrics((prevMetrics) => ({
      ...prevMetrics,
      pendingBilling: pendingBillingCount,
    }));
  };

  const fetchUploadedInvoices = async (subs) => {
    setIsLoading(true);
    try {
      const invoiceStatus = {};
      await Promise.all(
        subs.map(async (sub) => {
          try {
            const response = await axios.get(`http://localhost:5000/api/get-invoice/${sub.unique_id}`, {
              responseType: "blob", // This is necessary to handle binary PDF data
            });

            const pdfBlob = new Blob([response.data], { type: "application/pdf" });
            const pdfUrl = URL.createObjectURL(pdfBlob); // Create a URL for the PDF file

            invoiceStatus[sub.unique_id] = pdfUrl; // Store the generated URL
          } catch (error) {
            if (error.response && error.response.status === 404) {
              console.warn(`Invoice not found for order ID: ${sub.unique_id}`);
              invoiceStatus[sub.unique_id] = null;
            } else {
              console.error(`Error fetching invoice for order ID: ${sub.unique_id}`, error);
            }
          }
        })
      );
      setUploadedInvoices(invoiceStatus);
      calculatePendingBilling(subs, invoiceStatus);
    } catch (error) {
      console.error("Error fetching uploaded invoices:", error);
    }
    finally {
      setIsLoading(false);
    }
  };

  const handleStartMaintenance = async () => {
    if (!isMaintenance) {
      try {
        // 1. Take Status Snapshot
        const snapshotResponse = await fetch("http://localhost:5000/api/take-snapshot", {
          method: "POST",
        });

        const snapshotResult = await snapshotResponse.json();
        if (!snapshotResponse.ok) throw new Error(snapshotResult.message);

        console.log("✅ Snapshots taken:", snapshotResult.message);

        // 2. Fetch all active users
        const response = await axios.get("http://localhost:5000/api/users", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const paymentResponse = await axios.get("http://localhost:5000/api/get-all-subscriptions", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const payments = paymentResponse.data;

        // ✅ Filter only users with an active subscription
        const activeUsers = response.data.filter(user => {
          const userPayment = payments.find(payment => payment.email === user.email);
          return userPayment && calculateRemainingDays(userPayment.created_at, userPayment.subscription_type);
        });

        // 3. For each active user, get latestPayment.unique_id and stop their script
        for (const user of activeUsers) {
          // Fetch latest payment
          const paymentRes = await fetch(`http://localhost:5000/api/latest-payment?email=${user.email}`);
          const payment = await paymentRes.json();

          if (!payment?.unique_id) {
            console.warn(`⚠️ Skipping ${user.email}: No valid unique_id found in payments.`);
            continue;
          }

          const stopRes = await fetch("http://localhost:5000/api/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userEmail: user.email, uniqueId: payment.unique_id }),
          });

          const stopResJson = await stopRes.json();
          console.log(`⛔ Stopped script for ${user.email}:`, stopResJson.message);
        }
        setIsMaintenance(true);
        localStorage.setItem("isMaintenance", "true");
        alert("🛠️ Maintenance completed successfully!");
      } catch (error) {
        console.error("❌ Maintenance error:", error);
        alert(`Maintenance failed: ${error.message}`);
        setIsMaintenance(false);
        localStorage.setItem("isMaintenance", "false");
      }
    }
    else {
      try {
        const restartRes = await fetch("http://localhost:5000/api/restart-running", {
          method: "POST",
        });
        const restartResJson = await restartRes.json();
        console.log("Restarted scripts:", restartResJson.message);

        setIsMaintenance(false);
        localStorage.setItem("isMaintenance", "false");
        alert("Maintenance stopped and scripts restarted!");
      } catch (err) {
        console.error("Error restarting scripts:", err);
        alert("Failed to stop maintenance");
      }
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedData = [...subscriptions].sort((a, b) => {
      let valueA, valueB;

      if (key === "order_amount") {
        valueA = a[key] / 100;
        valueB = b[key] / 100;
      } else if (key === "created_at") {
        valueA = new Date(a[key]);
        valueB = new Date(b[key]);
      } else if (key === "days_remaining") {
        valueA = calculateRemainingDays(a.created_at, a.subscription_type);
        valueB = calculateRemainingDays(b.created_at, b.subscription_type);
        if (valueA === "Expired") valueA = -1;
        if (valueB === "Expired") valueB = -1;
      } else {
        valueA = a[key].toString().toLowerCase();
        valueB = b[key].toString().toLowerCase();
      }

      if (valueA < valueB) return direction === "asc" ? -1 : 1;
      if (valueA > valueB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setSubscriptions(sortedData);
  };


  const handleOpenModal = (email, id) => {
    setIsLoading(true);
    setSelectedUserEmail(email);
    setSelectedOrderId(id);
    setSelectedInvoiceUrl(uploadedInvoices[id] || null);
    setIsModalOpen(true);
    setIsLoading(false);
  };

  const calculateRemainingDays = (createdAt, subscriptionType) => {
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate);

    const SUBSCRIPTION_DURATIONS = {
      "one-mo": 30,
      "six-mo": 180,
      "year-mo": 365,
      "three-mo": 90,
    };

    const duration = SUBSCRIPTION_DURATIONS[subscriptionType] || 30;
    expiryDate.setDate(expiryDate.getDate() + duration);

    const today = new Date();
    const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    return remainingDays > 0 ? remainingDays : "Expired";
  };

  // Loading Screen Component
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

  const handleViewTodaySubscriptions = () => {
    navigate('/master/subscriptions-today');
  }

  const handleViewWeekSubscriptions = () => {
    navigate('/master/subscriptions-week');
  }

  const handleViewAllUsers = () => {
    navigate('/master/users');
  };

  const handleViewActiveUsers = () => {
    navigate('/master/active-users');
  };

  const handleViewPendingBilling = () => {
    navigate('/master/pending');
  }

  const handleViewExpiringSoon = () => {
    navigate('/master/expiring-soon');
  }

  const handleViewExpiredSubscriptions = () => {
    navigate('/master/expired');
  }

  const handleSupportClick = () => {
    navigate("/master/support");
};

  return (
    <div className={masterstyles.dashboardContainer}>
      {isLoading && <LoadingScreen />}
      {/* Sidebar Component */}
      <Sidebar isDisabled={isDisabled} />

      {/* Main Content */}
      <div className={masterstyles.dashboardContent}>
        {/* Metrics Section */}
        <div className={masterstyles.metricsSection}>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewTodaySubscriptions}
          >
            {subscriptionMetrics.subscriptionsToday}
            <br />
            <p>Subscriptions Today</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewWeekSubscriptions}
          >
            {subscriptionMetrics.subscriptionsThisWeek}
            <br />
            <p>Subscriptions This Week</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewPendingBilling}
          >
            {subscriptionMetrics.pendingBilling}
            <br />
            <p>Pending Billing</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewExpiringSoon}
          >
            {subscriptionMetrics.expiringWithinThreeDays}
            <br />
            <p>Expiring Within 3 Days</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewExpiredSubscriptions}
          >
            {subscriptionMetrics.expiredSubscriptions}
            <br />
            <p>Expired</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewActiveUsers}
          >
            {subscriptionMetrics.totalActiveUsers}
            <br />
            <p>Active Users</p>
          </div>
          <div
            className={`${masterstyles.metricBox} ${masterstyles.clickableMetric}`}
            onClick={handleViewAllUsers}
          >
            {subscriptionMetrics.totalUsers - 1}
            <br />
            <p>Total Users</p>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className={masterstyles.leadsSection}>
          <div className={masterstyles.tableHeader}>
            <span>Active Subscriptions</span>
          </div>

          <div className={masterstyles.downBox}>
            <div className={masterstyles.searchContainer}>
              <input
                type="text"
                placeholder="Search by Order ID, Email, or Referral ID..."
                value={searchTerm}
                onChange={handleSearch}
                className={masterstyles.searchInput}
              />
            </div>

            <div className={masterstyles.tableActions}>
              <button
              className={masterstyles.downloadButton}
              onClick={handleSupportClick}
              title="Support Team Details"
            >
              <span className={masterstyles.icon}>🧑‍💻</span>
     </button>
              <button
                className={masterstyles.downloadButton}
                onClick={() => navigate('/master/user-status')}
                title="Go to User Status"
              >
                <span className={masterstyles.icon}>👤</span>
              </button>

              <button
                className={masterstyles.downloadButton}
                onClick={handleDownloadExcel}
                title="Download as Excel"
              >
                <span className={masterstyles.icon}>📥</span>
              </button>

              <button
                className={masterstyles.editButton}
                onClick={handleStartMaintenance}
                title={isMaintenance ? "Stop Maintenance" : "Start Maintenance"}
              >
                <span className={masterstyles.icon}>{isMaintenance ? "✅" : "🛠"}</span>
              </button>
            </div>

          </div>

          <div className={masterstyles.tableWrapper}>
            <table className={masterstyles.leadsTable}>
              <thead>
                <tr>
                  {[
                    { label: "Email", key: "email" },
                    { label: "Contact", key: "contact" },
                    { label: "Subscription Type", key: "subscription_type" },
                    { label: "Order ID", key: "unique_id" },
                    { label: "Order Amount", key: "order_amount" },
                    { label: "Subscription Start", key: "created_at" },
                    { label: "Days Remaining", key: "days_remaining" },
                    { label: "Referral Id", key: "refId" },
                  ].map(({ label, key }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      style={{ cursor: "pointer" }}
                    >
                      {label}{" "}
                      {sortConfig.key === key
                        ? sortConfig.direction === "asc"
                          ? "🔼"
                          : "🔽"
                        : ""}
                    </th>
                  ))}
                  <th>Billing</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.length > 0 ? (
                  filteredSubscriptions.map((sub, index) => (
                    <tr key={index}>
                      <td>{sub.email}</td>
                      <td>{sub.contact}</td>
                      <td>{subscriptionMapping[sub.subscription_type]}</td>
                      <td>{sub.unique_id}</td>
                      <td>₹{sub.order_amount / 100}</td>

                      <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td>
                        {calculateRemainingDays(
                          sub.created_at,
                          sub.subscription_type
                        )}
                      </td>
                      <td>{sub.refId}</td>
                      <td>
                        {uploadedInvoices[sub.unique_id] !== undefined ? (
                          uploadedInvoices[sub.unique_id] ? (
                            <div className={masterstyles.actionBtns}>
                              <button
                                className={masterstyles.editButton}
                                onClick={() =>
                                  handleOpenModal(sub.email, sub.unique_id)
                                }
                              >
                                🖉
                              </button>
                              <a
                                href={uploadedInvoices[sub.unique_id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={masterstyles.downloadButton}
                                download={`invoice_${sub.unique_id}.pdf`}
                              >
                                ⤓
                              </a>
                            </div>
                          ) : (
                            <>
                              <button
                                className={masterstyles.uploadButton}
                                onClick={() =>
                                  handleOpenModal(sub.email, sub.unique_id)
                                }
                              >
                                Upload Invoice
                              </button>
                            </>
                          )
                        ) : (
                          <span className={masterstyles.loadingText}>
                            Loading...
                          </span>
                        )}
                      </td>
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

        {/* Billing Modal */}
        <BillingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userEmail={selectedUserEmail}
          unique_id={selectedOrderId}
          invoiceUrl={selectedInvoiceUrl}
        />
      </div>
    </div>
  );
};

export default Master;
