import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import masterstyles from "./Master.module.css"; // Import CSS module
import BillingModal from "./BillingModal";
import * as XLSX from "xlsx";

const Master = () => {
  const [isDisabled, setIsDisabled] = useState(false);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState({
    subscriptionsToday: 0,
    subscriptionsThisWeek: 0,
    pendingBilling: 0,
    expiringWithinThreeDays: 0,
    expiringToday: 0,
    totalActiveUsers: 0,
    totalUsers: 0,
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadedInvoices, setUploadedInvoices] = useState({});
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    fetchSubscriptionMetrics();
    fetchSubscriptions();
  }, []);

  const fetchSubscriptionMetrics = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/get-subscription-metrics");
      setSubscriptionMetrics(response.data);
    } catch (error) {
      console.error("Error fetching subscription metrics:", error);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/get-all-subscriptions");
      setSubscriptions(response.data);
      fetchUploadedInvoices(response.data);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
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
      "Reference ID": sub.refId || "N/A",
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
    setSelectedUserEmail(email);
    setSelectedOrderId(id);
    setSelectedInvoiceUrl(uploadedInvoices[id] || null);
    setIsModalOpen(true);
  };

  const calculateRemainingDays = (createdAt, subscriptionType) => {
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate);

    const SUBSCRIPTION_DURATIONS = {
      "One Month": 30,
      "6 Months": 180,
      "Yearly": 365,
    };

    const duration = SUBSCRIPTION_DURATIONS[subscriptionType] || 30;
    expiryDate.setDate(expiryDate.getDate() + duration);

    const today = new Date();
    const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    return remainingDays > 0 ? remainingDays : "Expired";
  };

  return (
    <div className={masterstyles.dashboardContainer}>
      {/* Sidebar Component */}
      <Sidebar isDisabled={isDisabled} />

      {/* Main Content */}
      <div className={masterstyles.dashboardContent}>
        {/* Metrics Section */}
        <div className={masterstyles.metricsSection}>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.subscriptionsToday} <br /><p>Subscriptions Today</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.subscriptionsThisWeek} <br /><p>Subscriptions This Week</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.pendingBilling} <br /><p>Pending Billing</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.expiringWithinThreeDays} <br /><p>Expiring Within 3 Days</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.expiringToday} <br /><p>Expiring Today</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.totalActiveUsers} <br /><p>Total Active Users</p></div>
          <div className={masterstyles.metricBox}>{subscriptionMetrics.totalUsers} <br /><p>Total Users</p></div>
        </div>

        {/* Subscriptions Table */}
        <div className={masterstyles.leadsSection}>
          <div className={masterstyles.tableHeader}><span>Active Subscriptions</span>
            <button
              className={masterstyles.downloadExcelButton}
              onClick={handleDownloadExcel}
            >
              📥 Download as Excel
            </button>
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
                    { label: "Reference Id", key: "refId" },
                  ].map(({ label, key }) => (
                    <th key={key} onClick={() => handleSort(key)} style={{ cursor: "pointer" }}>
                      {label} {sortConfig.key === key ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                  <th>Billing</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length > 0 ? (
                  subscriptions.map((sub, index) => (
                    <tr key={index}>
                      <td>{sub.email}</td>
                      <td>{sub.contact}</td>
                      <td>{sub.subscription_type}</td>
                      <td>{sub.unique_id}</td>
                      <td>₹{sub.order_amount / 100}</td>

                      <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td>{calculateRemainingDays(sub.created_at, sub.subscription_type)}</td>
                      <td>{sub.refId}</td>
                      <td>
                        {uploadedInvoices[sub.unique_id] !== undefined ? (
                          uploadedInvoices[sub.unique_id] ? (
                            <div>
                              <button
                                className={masterstyles.uploadButton}
                                onClick={() => handleOpenModal(sub.email, sub.unique_id)}
                              >
                                Click here to edit
                              </button>
                              <a
                                href={uploadedInvoices[sub.unique_id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={masterstyles.downloadButton}
                                download={`invoice_${sub.unique_id}.pdf`}
                              >
                                Download Invoice
                              </a>
                            </div>
                          ) : (
                            <>
                              <button
                                className={masterstyles.uploadButton}
                                onClick={() => handleOpenModal(sub.email, sub.unique_id)}
                              >
                                Upload Invoice
                              </button>
                            </>
                          )
                        ) : (
                          <span className={masterstyles.loadingText}>Loading...</span>
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
