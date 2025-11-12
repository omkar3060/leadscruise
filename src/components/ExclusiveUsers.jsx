import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UsersList.module.css';
import Sidebar from './Sidebar';

const ExclusiveUsers = () => {
  const [exclusiveUsers, setExclusiveUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [exclusiveRes, allUsersRes] = await Promise.all([
        fetch('https://api.leadscruise.com/api/exclusive-users', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('https://api.leadscruise.com/api/users', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);
      
      // Check if responses are ok
      if (!exclusiveRes.ok) {
        throw new Error(`Exclusive users API failed: ${exclusiveRes.status}`);
      }
      if (!allUsersRes.ok) {
        throw new Error(`Users API failed: ${allUsersRes.status}`);
      }

      // Check content type before parsing
      const exclusiveContentType = exclusiveRes.headers.get('content-type');
      const allUsersContentType = allUsersRes.headers.get('content-type');

      if (!exclusiveContentType?.includes('application/json')) {
        throw new Error('Exclusive users API did not return JSON');
      }
      if (!allUsersContentType?.includes('application/json')) {
        throw new Error('Users API did not return JSON');
      }
      
      const exclusiveData = await exclusiveRes.json();
      const allUsersData = await allUsersRes.json();
      
      setExclusiveUsers(exclusiveData || []);
      setAllUsers(allUsersData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load users');
      setExclusiveUsers([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExclusiveUser = async (userEmail) => {
    try {
      const response = await fetch('https://api.leadscruise.com/api/exclusive-users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail })
      });
      
      if (!response.ok) throw new Error('Failed to add user');
      
      alert('✅ User added to exclusive list successfully!');
      setShowAddModal(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error('Error adding exclusive user:', error);
      alert('❌ Failed to add user to exclusive list');
    }
  };

  const handleRemoveExclusiveUser = async (userEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${userEmail} from exclusive list?`)) {
      return;
    }

    try {
      const response = await fetch('https://api.leadscruise.com/api/exclusive-users/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail })
      });
      
      if (!response.ok) throw new Error('Failed to remove user');
      
      alert('✅ User removed from exclusive list successfully!');
      fetchData();
    } catch (error) {
      console.error('Error removing exclusive user:', error);
      alert('❌ Failed to remove user from exclusive list');
    }
  };

  const filteredExclusiveUsers = exclusiveUsers.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.mobileNumber?.includes(searchTerm)
  );

  const availableUsers = allUsers.filter(user => 
    !exclusiveUsers.some(eu => eu.email === user.email) &&
    user.email !== 'demo@leadscruise.com'
  );

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
        <h1>Exclusive Users</h1>
        <div className={styles.headerButtons}>
          <button
            className={styles.downloadButton}
            onClick={() => setShowAddModal(true)}
            disabled={loading}
          >
            Add User
          </button>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        margin: '20px 0',
        padding: '0 20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            {exclusiveUsers.length}
          </div>
          <div style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
            Total Exclusive Users
          </div>
        </div>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#764ba2' }}>
            {availableUsers.length}
          </div>
          <div style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
            Available to Add
          </div>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search by email, name, or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Exclusive Users Cards */}
      <div style={{ padding: '0 20px' }}>
        {filteredExclusiveUsers.length === 0 ? (
          <div className={styles.noResults} style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⭐</div>
            <p style={{ fontSize: '16px', margin: 0, color: '#999' }}>
              {searchTerm ? 'No users found matching your search' : 'No exclusive users added yet'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {filteredExclusiveUsers.map((user) => (
              <div
                key={user.email}
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '2px solid #e0e0e0',
                  transition: 'all 0.3s ease',
                  flexWrap: 'wrap',
                  gap: '15px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '24px' }}>⭐</span>
                  <div>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px', 
                      color: '#333',
                      marginBottom: '4px'
                    }}>
                      {user.username || 'N/A'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {user.email}
                    </div>
                    {user.mobileNumber && (
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '2px' }}>
                        📱 {user.mobileNumber}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveExclusiveUser(user.email)}
                  style={{
                    background: '#ff4757',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#ee5a6f';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#ff4757';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span>🗑️</span>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowAddModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '25px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>Add Exclusive User</h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px',
                  fontSize: '24px',
                  lineHeight: 1,
                  color: '#999'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '25px' }}>
              {availableUsers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#999'
                }}>
                  <p>All users have been added to the exclusive list</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {availableUsers.map((user) => (
                    <div
                      key={user.email}
                      onClick={() => setSelectedUser(user)}
                      style={{
                        padding: '15px',
                        borderRadius: '8px',
                        border: `2px solid ${selectedUser?.email === user.email ? '#667eea' : '#e0e0e0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        background: selectedUser?.email === user.email ? 'rgba(102, 126, 234, 0.05)' : 'white'
                      }}
                      onMouseOver={(e) => {
                        if (selectedUser?.email !== user.email) {
                          e.currentTarget.style.borderColor = '#667eea';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedUser?.email !== user.email) {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                        }
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {user.username || 'N/A'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {user.email}
                      </div>
                      {user.mobileNumber && (
                        <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
                          📱 {user.mobileNumber}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedUser && (
              <div style={{
                padding: '20px 25px',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setShowAddModal(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '2px solid #e0e0e0',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#666'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddExclusiveUser(selectedUser.email)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  Add to Exclusive List
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExclusiveUsers;