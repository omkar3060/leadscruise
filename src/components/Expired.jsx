import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css'; // Reusing the same styles
import Sidebar from './Sidebar';
import * as XLSX from 'xlsx';
import { Subscriptions } from '@mui/icons-material';
import masterstyles from "./Master.module.css";

const ExpiredSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const navigate = useNavigate();
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadedInvoices, setUploadedInvoices] = useState({});
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState(null);
    const subscriptionMapping = {
    "7-days": "7 Days",
    "3-days": "3 Days",
    "one-mo": "One Month",
    "three-mo": "Three Months",
    "six-mo": "Six Months",
    "year-mo": "One Year"
  };
  useEffect(() => {
    fetchSubscriptions();
  }, []);

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
      "7-days": 7,
      "3-days": 3,
      "One Month": 30,
      "6 Months": 180,
      "year-mo": 365,
    };

    const duration = SUBSCRIPTION_DURATIONS[subscriptionType] || 30;
    expiryDate.setDate(expiryDate.getDate() + duration);

    const today = new Date();
    const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    return remainingDays > 0 ? remainingDays : "Expired";
  };

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
        const response = await axios.get("https://api.leadscruise.com/api/get-all-subscriptions", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });

        // Filter subscriptions expiring in 3 days
        const expiringSoonSubscriptions = response.data.filter(sub => {
            const remainingDays = calculateRemainingDays(sub.created_at, sub.subscription_type);
            return remainingDays === "Expired" ;
        });

        setSubscriptions(expiringSoonSubscriptions);
        fetchUploadedInvoices(expiringSoonSubscriptions);
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch subscriptions');
    } finally {
        setIsLoading(false);
    }
};

  const fetchUploadedInvoices = async (subs) => {
    try {
      const invoiceStatus = {};
      await Promise.all(
        subs.map(async (sub) => {
          try {
            const response = await axios.get(`https://api.leadscruise.com/api/get-invoice/${sub.unique_id}`, {
              responseType: "blob",
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            });

            const pdfBlob = new Blob([response.data], { type: "application/pdf" });
            const pdfUrl = URL.createObjectURL(pdfBlob);
            invoiceStatus[sub.unique_id] = pdfUrl;
          } catch (error) {
            if (error.response && error.response.status === 404) {
              invoiceStatus[sub.unique_id] = null;
            }
          }
        })
      );
      setUploadedInvoices(invoiceStatus);
    } catch (error) {
      console.error("Error fetching uploaded invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredSubscriptions = sortedSubscriptions.filter(sub =>
    sub.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.refId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.unique_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const downloadExcel = () => {
    if (filteredSubscriptions.length === 0) {
      alert("No subscription data available to download.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      filteredSubscriptions.map(sub => ({
      "Email": sub.email,
      "Contact": sub.contact,
      "Subscription Type": sub.subscription_type,
      "Order ID": sub.unique_id,
      "Order Amount (₹)": sub.order_amount / 100,
      "Subscription Start": new Date(sub.created_at).toLocaleDateString(),
      "Days Remaining": calculateRemainingDays(sub.created_at, sub.subscription_type),
      "Reference ID": sub.refId || "N/A",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expired_subscriptions');

    XLSX.writeFile(workbook, 'Expired_subscriptions.xlsx');
  };

  const viewInvoice = (invoiceUrl) => {
    if (invoiceUrl) {
      window.open(invoiceUrl, '_blank');
    }
  };

  if (error) return <div className={styles.errorMessage}>Error: {error}</div>;

  return (
    <div className={styles.usersListContainer}>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-container">
            <div className="spinner">
              <div className="double-bounce1"></div>
              <div className="double-bounce2"></div>
            </div>
            <div className="loading-text">
              <h3>loading...</h3>
              <div className="loading-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
            <p className="loading-message">Please wait</p>
          </div>
        </div>
      )}
      <Sidebar isDisabled={isDisabled} />
      <div className={styles.header}>
        <h1>Expired Subs</h1>
        <div className={styles.headerButtons}>
          <button
            className={styles.downloadButton}
            onClick={downloadExcel}
            disabled={loading}
          >
            Download as Excel
          </button>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search by email, contact, reference ID, or order ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th onClick={() => handleSort('email')}>
                Email {getSortIndicator('email')}
              </th>
              <th onClick={() => handleSort('contact')}>
                Contact {getSortIndicator('contact')}
              </th>
              <th onClick={() => handleSort('plan')}>
                Subscription Type {getSortIndicator('plan')}
              </th>
              <th onClick={() => handleSort('unique_id')}>
                Order ID {getSortIndicator('unique_id')}
              </th>
              <th onClick={() => handleSort('amount')}>
                Order Amount {getSortIndicator('amount')}
              </th>
              <th onClick={() => handleSort('subscriptionStart')}>
                Subscription Start {getSortIndicator('subscriptionStart')}
              </th>
              <th onClick={() => handleSort('daysRemaining')}>
                Days Remaining {getSortIndicator('daysRemaining')}
              </th>
              <th onClick={() => handleSort('refId')}>
                Reference ID {getSortIndicator('refId')}
              </th>
              <th onClick={() => handleSort('billingStatus')}>
                Billing {getSortIndicator('billingStatus')}
              </th>
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
                  <td>{calculateRemainingDays(sub.created_at, sub.subscription_type)}</td>
                  <td>{sub.refId}</td>
                  <td>
                    {uploadedInvoices[sub.unique_id] !== undefined ? (
                      uploadedInvoices[sub.unique_id] ? (
                        <div className={masterstyles.actionBtns}>
                          <button
                            className={masterstyles.editButton}
                            onClick={() => handleOpenModal(sub.email, sub.unique_id)}
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
                <td colSpan="10" className={styles.noResults}>
                  No subscriptions expired as of now!!!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpiredSubscriptions;