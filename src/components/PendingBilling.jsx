import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css'; // Reusing the same styles
import Sidebar from './Sidebar';
import * as XLSX from 'xlsx';
import { Subscriptions } from '@mui/icons-material';

const PendingBilling = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [uploadedInvoices, setUploadedInvoices] = useState({});
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
        const response = await axios.get("http://localhost:5000/api/get-all-subscriptions", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });

        const allSubscriptions = response.data;

        // Fetch uploaded invoices and filter only subscriptions without invoices
        const subscriptionsWithoutInvoices = await fetchUploadedInvoices(allSubscriptions);

        setSubscriptions(subscriptionsWithoutInvoices);
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
                    const response = await axios.get(`http://localhost:5000/api/get-invoice/${sub.unique_id}`, {
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
                        invoiceStatus[sub.unique_id] = null; // No invoice uploaded
                    }
                }
            })
        );

        // Return subscriptions where invoice is missing
        return subs.filter(sub => invoiceStatus[sub.unique_id] === null);
    } catch (error) {
        console.error("Error fetching uploaded invoices:", error);
        return [];
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
        'Email': sub.email || 'N/A',
        'Contact': sub.contact || sub.phoneNumber || 'N/A',
        'Subscription Type': sub.plan || sub.subscriptionType || 'N/A',
        'Order ID': sub.unique_id || sub.orderId || 'N/A',
        'Order Amount': sub.amount ? `₹${sub.amount}` : 'N/A',
        'Subscription Start': sub.subscriptionStart ? new Date(sub.subscriptionStart).toLocaleDateString() : 'N/A',
        'Days Remaining': sub.daysRemaining || 'N/A',
        'Reference ID': sub.refId || 'N/A',
        'Billing Status': sub.billingStatus || 'N/A'
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Today\'s Subscriptions');
    
    XLSX.writeFile(workbook, 'todays_subscriptions.xlsx');
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
        <h1>Pending Bills</h1>
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
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscriptions.length > 0 ? (
              filteredSubscriptions.map(sub => (
                <tr key={sub._id || sub.unique_id}>
                  <td>{sub.email || 'N/A'}</td>
                  <td>{sub.contact || sub.phoneNumber || 'N/A'}</td>
                  <td>{sub.plan || sub.subscriptionType || 'N/A'}</td>
                  <td>{sub.unique_id || sub.orderId || 'N/A'}</td>
                  <td>{sub.amount ? `₹${sub.amount}` : 'N/A'}</td>
                  <td>{sub.subscriptionStart ? new Date(sub.subscriptionStart).toLocaleDateString() : 'N/A'}</td>
                  <td>{sub.daysRemaining || 'N/A'}</td>
                  <td>{sub.refId || 'N/A'}</td>
                  <td>{sub.billingStatus || 'N/A'}</td>
                  <td>
                    {uploadedInvoices[sub.unique_id] ? (
                      <button 
                        className={styles.viewButton}
                        onClick={() => viewInvoice(uploadedInvoices[sub.unique_id])}
                      >
                        View
                      </button>
                    ) : sub.invoiceBase64 ? (
                      <button 
                        className={styles.viewButton}
                        onClick={() => window.open(sub.invoiceBase64, '_blank')}
                      >
                        View
                      </button>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className={styles.noResults}>
                  No Bills Pending
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingBilling;