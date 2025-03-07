// UsersList.js - New component for displaying all users
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css';
import Sidebar from './Sidebar';
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

  if (loading) return <div className={styles.loadingContainer}><div className={styles.spinner}></div></div>;
  if (error) return <div className={styles.errorMessage}>Error: {error}</div>;

  return (
    <div className={styles.usersListContainer}>
        <Sidebar isDisabled={isDisabled} />
      <div className={styles.header}>
        <h1>All Users</h1>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          Back to Dashboard
        </button>
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
  <span >
    {user.subscriptionStatus || 'Not Active'}
  </span>
</td>
                  <td>{new Date(user.lastLogin).toLocaleString() || 'N/A'}</td>
                  
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className={styles.noResults}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersList;