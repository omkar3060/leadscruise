import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./BillingModal.module.css";

const BillingModal = ({ isOpen, onClose, userEmail, unique_id }) => {
  const [billingDetails, setBillingDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (isOpen && userEmail) {
      axios
        .get(`http://localhost:5000/api/billing/${userEmail}`)
        .then((response) => {
          if (response.data.success) {
            setBillingDetails(response.data.data);
          } else {
            setBillingDetails(null);
          }
        })
        .catch((error) => console.error("Error fetching billing details:", error));
    } else {
      setBillingDetails(null); // Reset billing details when modal is closed
    }
  }, [isOpen, userEmail]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please attach a file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("invoice", selectedFile);

    try {
      await axios.post(`http://localhost:5000/api/upload-invoice/${unique_id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Invoice uploaded successfully!");
      handleClose(); // Reset state and close modal
    } catch (error) {
      alert("Failed to upload invoice.");
    }
  };

  const handleClose = () => {
    setBillingDetails(null); // Reset billing details when modal is closed
    setSelectedFile(null); // Reset file input
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* Close Button (Top Right) */}
        <button className={styles.closeIcon} onClick={handleClose}>
          &times;
        </button>

        <h2 className={styles.header}>Customer Billing Details</h2>

        {billingDetails ? (
          <>
            <div className={styles.billingDetails}>
              <p>
                Billing Phone Number: <span>{billingDetails.phone}</span>
              </p>
              <p>
                Billing GST Number: <span>{billingDetails.gst}</span>
              </p>
              <p>
                PAN No: <span>{billingDetails.pan}</span>
              </p>
            </div>

            <p><strong>Company Name:</strong> {billingDetails.name}</p>
            <p><strong>Address:</strong> {billingDetails.address}</p>
            <p><strong>Billing Email ID:</strong> {billingDetails.email}</p>

            {/* File Upload Section */}
            <div className={styles.fileUploadSection}>
              <label htmlFor="fileUpload" className={styles.attachBillLabel}>
                Attach Bill
              </label>
              <input id="fileUpload" type="file" accept="application/pdf" onChange={handleFileChange} />
              {selectedFile && <span className={styles.uploadedFileName}>📎 {selectedFile.name}</span>}
            </div>

            {/* Buttons */}
            <div className={styles.buttonGroup}>
              <button onClick={handleUpload} className={styles.uploadButton}>Save & Upload</button>
              <button onClick={handleClose} className={styles.closeButton}>Close</button>
            </div>
          </>
        ) : (
          <p>No billing details found.</p>
        )}
      </div>
    </div>
  );
};

export default BillingModal;
