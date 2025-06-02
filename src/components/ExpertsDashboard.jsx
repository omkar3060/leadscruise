// import { useState, useEffect } from "react";
// import "./ExpertsDashboard.css";

// const ExpertsDashboard = () => {
//   const [experts, setExperts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [statusMessage, setStatusMessage] = useState("");
//   const [retryCount, setRetryCount] = useState(0);

//   useEffect(() => {
//     const mobileNumber = localStorage.getItem("mobileNumber");
//     const savedPassword = localStorage.getItem("savedPassword");

//     if (!mobileNumber || !savedPassword) {
//       setError("Missing credentials in local storage.");
//       return;
//     }
//     const fetchExperts = async () => {
//       try {
//         setLoading(true);
//         // Call your specific API endpoint
//         const response = await fetch(
//           "http://localhost:5000/api/support/experts",
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//               mobileNumber: mobileNumber,
//               savedPassword: savedPassword,
//             }),
//           }
//         );

//         const data = await response.json();

//         // Check if we received a loading status (202 response)
//         if (response.status === 202) {
//           setStatusMessage(
//             data.message || "Loading expert data, please wait..."
//           );

//           // Set a timer to retry after 10 seconds
//           if (retryCount < 6) {
//             // Limit to 6 retries (1 minute total)
//             setTimeout(() => {
//               setRetryCount((prev) => prev + 1);
//             }, 10000);
//           } else {
//             setError(
//               "Timed out waiting for expert data. Please refresh the page."
//             );
//             setLoading(false);
//           }
//           return;
//         }

//         // Handle normal response with notice
//         if (data.notice && data.experts) {
//           setStatusMessage(data.notice);
//           setExperts(Array.isArray(data.experts) ? data.experts : []);
//         }
//         // Handle regular response without notice
//         else if (Array.isArray(data)) {
//           setExperts(data);
//           setStatusMessage("");
//         }
//         // Handle error or unexpected format
//         else if (data.error) {
//           throw new Error(data.error);
//         } else {
//           setExperts([]);
//           setStatusMessage("");
//         }

//         setLoading(false);
//       } catch (err) {
//         setError(err.message);
//         setLoading(false);
//         console.error("Error fetching expert details:", err);
//       }
//     };

//     fetchExperts();
//   }, [retryCount]); // Dependency on retryCount to trigger refetching

//   // Default placeholder image for missing profile photos
//   const defaultProfileImg =
//     "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

//   // Function to handle manual refresh
//   const handleRefresh = () => {
//     setRetryCount((prev) => prev + 1);
//     setLoading(true);
//     setError(null);
//   };

//   return (
//     <div className="dashboard-content">
//       {/* <div className="dashboard-header">
//           <h1>IndiaMART Expert Assistance</h1>
//           <p>Connect with your dedicated support team</p>

//           {statusMessage && (
//             <div className="status-message">
//               <p>{statusMessage}</p>
//               <button onClick={handleRefresh} className="refresh-button">
//                 Refresh Data
//               </button>
//             </div>
//           )}
//         </div> */}

//       {loading ? (
//         <div className="loading-container">
//           <div className="loading-spinner"></div>
//           <p>Loading expert information...</p>
//           {retryCount > 0 && (
//             <p className="retry-info">
//               Attempt {retryCount}/6. Initial load may take up to 1 minute.
//             </p>
//           )}
//         </div>
//       ) : error ? (
//         <div className="error-message">
//           <p>{error}</p>
//           <button onClick={handleRefresh} className="refresh-button">
//             Try Again
//           </button>
//         </div>
//       ) : experts.length === 0 ? (
//         <div className="warning-message">
//           <p>No experts found. Please try again later.</p>
//           <button onClick={handleRefresh} className="refresh-button">
//             Refresh
//           </button>
//         </div>
//       ) : (
//         <>
//           <div className="head">LeadsCruise Expert Assistance</div>
//           <div className="experts-grid">
//             {experts.map((expert, index) => (
//               <div key={index} className="expert-card">
//                 <div className="expert-card-content">
//                   <div className="expert-header">
//                     <div className="expert-image-container">
//                       <img
//                         src={expert.photoUrl || defaultProfileImg}
//                         alt={`${expert.name || "Expert"} profile`}
//                         className="expert-image"
//                         onError={(e) => {
//                           e.target.src = defaultProfileImg;
//                         }}
//                       />
//                     </div>
//                     <div className="expert-info">
//                       <h3 className="expert-name">{expert.name || "N/A"}</h3>
//                       <p className="expert-role">
//                         {expert.role || "Support Specialist"}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="expert-contact">
//                     {expert.phone && (
//                       <div className="contact-item">
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           className="contact-icon"
//                           viewBox="0 0 20 20"
//                           fill="currentColor"
//                         >
//                           <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
//                         </svg>
//                         <span>{expert.phone}</span>
//                       </div>
//                     )}

//                     {expert.email && (
//                       <div className="contact-item">
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           className="contact-icon"
//                           viewBox="0 0 20 20"
//                           fill="currentColor"
//                         >
//                           <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
//                           <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
//                         </svg>
//                         <a
//                           href={`mailto:${expert.email}`}
//                           className="email-link"
//                         >
//                           {expert.email}
//                         </a>
//                       </div>
//                     )}
//                   </div>

//                   {expert.videoMeet && (
//                     <div className="video-meet-container">
//                       <button className="video-meet-button">
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           className="video-icon"
//                           viewBox="0 0 20 20"
//                           fill="currentColor"
//                         >
//                           <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
//                           <path d="M14 6a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
//                         </svg>
//                         Request Video Meeting
//                       </button>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </>
//       )}
//     </div>
//   );
// };

// export default ExpertsDashboard;
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "./UsersList.module.css";
import Sidebar from "./Sidebar";
import * as XLSX from "xlsx";

const ExpertsDashboard = () => {
  const [users, setUsers] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          "http://localhost:5000/api/support/getSupport"
        );
        setUsers(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch active users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredUsers = sortedUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? " ↑" : " ↓";
    }
    return "";
  };

  // Function to download users list as Excel file
  const downloadExcel = () => {
    // Prepare data for Excel
    const worksheet = XLSX.utils.json_to_sheet(
      filteredUsers.map((user) => ({
        Email: user.email || "",
        Status: user.status || "Stopped",
      }))
    );

    // Create workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

    // Generate Excel file and download
    XLSX.writeFile(workbook, "users_list.xlsx");
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
        <h1>All Experts Details</h1>
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
              <th onClick={() => handleSort("name")}>
                Expert's Name {getSortIndicator("name")}
              </th>
              <th onClick={() => handleSort("email")}>
                Expert's Email {getSortIndicator("email")}
              </th>
              <th onClick={() => handleSort("phoneNumber")}>
                Expert's Phone No. {getSortIndicator("phoneNumber")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email || "N/A"}</td>
                  <td>{user.phoneNumber || "Stopped"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className={styles.noResults}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpertsDashboard;
