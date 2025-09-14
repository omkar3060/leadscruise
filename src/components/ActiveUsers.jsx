import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css';
import Sidebar from './Sidebar';
import * as XLSX from 'xlsx';

const ActiveUsers = () => {
  const [users, setUsers] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const navigate = useNavigate();

  useEffect(() => {
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

      return remainingDays > 0; // Returns true if subscription is active
    };

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get("https://api.leadscruise.com/api/users", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const paymentResponse = await axios.get("https://api.leadscruise.com/api/get-all-subscriptions", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const payments = paymentResponse.data;

        // ✅ Filter only users with an active subscription
        const activeUsers = response.data.filter(user => {
          const userPayments = payments
            .filter(payment => payment.email === user.email)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Latest first

          if (userPayments.length === 0) return false;

          const latestPayment = userPayments[0];
          return calculateRemainingDays(latestPayment.created_at, latestPayment.subscription_type);

        });

        setUsers(activeUsers);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch active users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredUsers = sortedUsers.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  // Function to download users list as Excel file
  const downloadExcel = () => {
    // Prepare data for Excel
    const worksheet = XLSX.utils.json_to_sheet(
      filteredUsers.map(user => ({
        Email: user.email || '',
        'Referral ID': user.refId || 'N/A',
        'Phone Number': user.phoneNumber || 'N/A',
        'IndiaMart Phone Number': user.mobileNumber || 'N/A',
        'Subscription Status': user.subscriptionStatus || 'Not Active',
        'Last Login': user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'
      }))
    );

    // Create workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate Excel file and download
    XLSX.writeFile(workbook, 'users_list.xlsx');
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
        <h1>Active Users</h1>
        <div className={styles.headerButtons}>
          <button
            className={styles.downloadButton}
            onClick={downloadExcel}
            disabled={loading || filteredUsers.length === 0}
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
          placeholder="Search by email..."
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
              <th onClick={() => handleSort('refId')}>
                Referral Id {getSortIndicator('refId')}
              </th>
              <th onClick={() => handleSort('phoneNumber')}>
                Phone No. {getSortIndicator('phoneNumber')}
              </th>
              <th onClick={() => handleSort('mobileNumber')}>
                InidaMart Phone No. {getSortIndicator('mobileNumber')}
              </th>
              <th onClick={() => handleSort('subscriptionStatus')}>
                Subscription Status {getSortIndicator('subscriptionStatus')}
              </th>
              <th onClick={() => handleSort('lastLogin')}>
                Last Login {getSortIndicator('lastLogin')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <tr key={user._id}>
                  <td>{user.email}</td>
                  <td>{user.refId || 'N/A'}</td>
                  <td>{user.phoneNumber || 'N/A'}</td>
                  <td>{user.mobileNumber || 'N/A'}</td>
                  <td>
                    <span>
                      {user.subscriptionStatus || 'Not Active'}
                    </span>
                  </td>
                  <td>{new Date(user.lastLogin).toLocaleString() || 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className={styles.noResults}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveUsers;