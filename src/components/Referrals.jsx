import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "./UsersList.module.css";
import Sidebar from "./Sidebar";
import * as XLSX from "xlsx";

const Referrals = () => {
  const [referrals, setReferrals] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "email",
    direction: "asc",
  });
  const [isAddingReferral, setIsAddingReferral] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [newReferral, setNewReferral] = useState({
    email: "",
    referralId: "",
    indiaMartPhoneNumber: "",
    validityMonths: 12,
  });
  const navigate = useNavigate();

  // Fetch referrals
  useEffect(() => {
    const fetchReferrals = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          "https://api.leadscruise.com/api/referrals",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        setReferrals(response.data.referrals);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch referrals");
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, []);

  // Sorting and Filtering
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedReferrals = [...referrals].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredReferrals = sortedReferrals.filter(
    (referral) =>
      referral.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? " ↑" : " ↓";
    }
    return "";
  };

  // Excel Download
  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredReferrals.map((referral) => ({
        "Referral ID": referral.referralId || "N/A",
        Email: referral.email || "",
        "Phone Number": referral.phoneNumber || "N/A",
        "IndiaMart Phone Number": referral.indiaMartPhoneNumber || "N/A",
        "Referral Date": referral.referralDate
          ? new Date(referral.referralDate).toLocaleString()
          : "N/A",
        "Validity (Months)": referral.validityMonths || "N/A",
        "Expiry Date": referral.expiryDate
          ? new Date(referral.expiryDate).toLocaleString()
          : "N/A",
        Active: referral.isActive ? "Yes" : "No",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Referrals");
    XLSX.writeFile(workbook, "referrals_list.xlsx");
  };

  // Handle New/Edit Referral Changes
  const handleReferralChange = (e) => {
    const { name, value } = e.target;
    setNewReferral((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Save New Referral
  const handleSaveNewReferral = async () => {
    setLoading(true);
    console.log(newReferral);
    try {
      const response = await axios.post(
        "https://api.leadscruise.com/api/referrals",
        newReferral,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      setReferrals((prev) => [...prev, response.data.referral]);

      setIsAddingReferral(false);
      setNewReferral({
        email: "",
        referralId: "",
        indiaMartPhoneNumber: "",
        validityMonths: 12,
      });
    } catch (err) {
      console.error("Full Axios Error:", err);

      // More detailed error handling
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0] ||
        "Failed to add referral";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Edit Referral
  const handleEditReferral = (referral) => {
    setEditingReferral(referral);
    setNewReferral({
      email: referral.email,
      referralId: referral.referralId || "",
      indiaMartPhoneNumber: referral.indiaMartPhoneNumber || "",
      validityMonths: referral.validityMonths || 12,
    });
    setIsAddingReferral(true);
  };

  // Update Referral
  const handleUpdateReferral = async () => {
    setLoading(true);
    try {
      const response = await axios.put(
        `https://api.leadscruise.com/api/referrals/${editingReferral._id}`,
        newReferral,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      setReferrals((prev) =>
        prev.map((referral) =>
          referral._id === editingReferral._id
            ? response.data.referral
            : referral
        )
      );

      setIsAddingReferral(false);
      setEditingReferral(null);
      setNewReferral({
        email: "",
        referralId: "",
        indiaMartPhoneNumber: "",
        validityMonths: 12,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update referral");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelNewReferral = () => {
    setIsAddingReferral(false);
    setNewReferral({
      email: "",
      referralId: "",
      indiaMartPhoneNumber: "",
      validityMonths: 12,
    });
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingReferral(null);
    setIsAddingReferral(false);
    setNewReferral({
      email: "",
      referralId: "",
      indiaMartPhoneNumber: "",
      validityMonths: 12,
    });
  };

  // Delete Referral (Soft Delete)
  const handleDeleteReferral = async (referralId) => {
    if (!window.confirm("Are you sure you want to deactivate this referral?"))
      return;

    setLoading(true);
    try {
      await axios.delete(`https://api.leadscruise.com/api/referrals/${referralId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setReferrals((prev) =>
        prev.filter((referral) => referral._id !== referralId)
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to deactivate referral");
    } finally {
      setLoading(false);
    }
  };

  // Plus Button Handler
  const handlePlusClick = () => {
    setIsAddingReferral(true);
    setEditingReferral(null);
    setNewReferral({
      email: "",
      referralId: "",
      indiaMartPhoneNumber: "",
      validityMonths: 12,
    });
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
        <h1>Referrals Management</h1>
        <div className={styles.headerButtons}>
          <button
            className={styles.downloadButton}
            onClick={downloadExcel}
            disabled={loading || filteredReferrals.length === 0}
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
          placeholder="Search by email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`${styles.searchInput} ${styles.refsearchInput}`}
        />
      </div>

      <div className={styles.pluscont}>
        <div className={styles.tableContainer}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th onClick={() => handleSort("email")}>
                  Email {getSortIndicator("email")}
                </th>
                <th>Referral ID</th>
                <th onClick={() => handleSort("indiaMartPhoneNumber")}>
                  Phone No. {getSortIndicator("indiaMartPhoneNumber")}
                </th>
                <th onClick={() => handleSort("referralDate")}>
                  Referral Date {getSortIndicator("referralDate")}
                </th>
                <th onClick={() => handleSort("validityMonths")}>
                  Validity (in Mo) {getSortIndicator("validityMonths")}
                </th>
                <th onClick={() => handleSort("expiryDate")}>
                  Expiry Date {getSortIndicator("expiryDate")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isAddingReferral && (
                <tr className={styles.addUserRow}>
                  <td>
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter email"
                      value={newReferral.email}
                      onChange={handleReferralChange}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="tel"
                      name="referralId"
                      placeholder="Referral Id"
                      value={newReferral.referralId}
                      onChange={handleReferralChange}
                    />
                  </td>
                  <td>
                    <input
                      type="tel"
                      name="indiaMartPhoneNumber"
                      placeholder="Phone No."
                      value={newReferral.indiaMartPhoneNumber}
                      onChange={handleReferralChange}
                    />
                  </td>
                  <td>
                    {isAddingReferral
                      ? new Date().toLocaleString()
                      : newReferral.referralDate
                      ? new Date(newReferral.referralDate).toLocaleString()
                      : "N/A"}
                  </td>
                  <td>
                    <input
                      type="number"
                      name="validityMonths"
                      min="1"
                      max="36"
                      value={newReferral.validityMonths}
                      onChange={handleReferralChange}
                    />
                  </td>
                  <td>N/A</td>
                  <td>
                    <div className={styles.editActionButtons}>
                      <button
                        onClick={
                          editingReferral
                            ? handleUpdateReferral
                            : handleSaveNewReferral
                        }
                        disabled={!newReferral.email}
                        className={styles.saveButton}
                      >
                        {editingReferral ? "Update" : "Save"}
                      </button>
                      <button
                        onClick={
                          editingReferral
                            ? handleCancelEdit
                            : handleCancelNewReferral
                        }
                        className={styles.cancelButton}
                      >
                        ✖️
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filteredReferrals
                .filter((referral) => referral._id !== editingReferral?._id)
                .map((referral) => (
                  <tr key={referral._id}>
                    <td>{referral.email}</td>
                    <td>{referral.referralId}</td>
                    <td>{referral.indiaMartPhoneNumber || "N/A"}</td>
                    <td>
                      {referral.referralDate
                        ? new Date(referral.referralDate).toLocaleString()
                        : "N/A"}
                    </td>
                    <td>{referral.validityMonths || "N/A"}</td>
                    <td>
                      {referral.expiryDate
                        ? new Date(referral.expiryDate).toLocaleString()
                        : "N/A"}
                    </td>

                    <td className={styles.actionIcons}>
                      <button
                        onClick={() => handleEditReferral(referral)}
                        className={styles.editIcon}
                        title="Edit Referral"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteReferral(referral._id)}
                        className={styles.deleteIcon}
                        title="Deactivate Referral"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              {filteredReferrals.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.noResults}>
                    No referrals found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          className={styles.plusbtn}
          onClick={handlePlusClick}
          disabled={isAddingReferral}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Referrals;
