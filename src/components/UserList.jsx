import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css';
import Sidebar from './Sidebar';
import * as XLSX from 'xlsx';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await axios.get('https://api.leadscruise.com/api/users', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setUsers(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users');
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user and all related data?")) return;

    try {
      const res = await fetch(`https://api.leadscruise.com/api/delete-user/${userId}`, { method: "DELETE" });
      const data = await res.json();
      alert(data.message);

      // Refresh UI
      setUsers(prev => prev.filter(user => user._id !== userId));
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
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
        <h1>All Users</h1>
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
              <th>Actions</th>
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
                  <td>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      style={{
                        backgroundColor: "red",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        margin: "0",
                      }}
                    >
                      Delete
                    </button>
                  </td>
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

export default UsersList;