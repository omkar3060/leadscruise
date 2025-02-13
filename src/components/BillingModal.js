import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./BillingModal.module.css";

const BillingModal = ({ isOpen, onClose, userEmail, unique_id, invoiceUrl }) => {
  const [billingDetails, setBillingDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (isOpen && userEmail) {
      axios
        .get(`http://localhost:5000/api/billing/${userEmail}`)
        .then((response) => {
          console.log("API Response:", response.data); // Debugging log
          if (response.data.success) {
            setBillingDetails(response.data.data);
          } else {
            console.error("Error: No billing details found");
            setBillingDetails(null);
          }
        })
        .catch((error) => console.error("Error fetching billing details:", error));
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
      onClose(); // Close modal after upload
    } catch (error) {
      console.error("Error uploading invoice:", error);
      alert("Failed to upload invoice.");
    }
  };

  console.log("Billing Details State:", billingDetails); // Debugging log

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <h2>Customer Billing Details</h2>
        
        {billingDetails && billingDetails.phone ? (
          <>
            <p><strong>Billing Phone Number:</strong> {billingDetails.phone}</p>
            <p><strong>Billing GST Number:</strong> {billingDetails.gst}</p>
            <p><strong>PAN No:</strong> {billingDetails.pan}</p>
            <p><strong>Company Name:</strong> {billingDetails.name}</p>
            <p><strong>Address:</strong> {billingDetails.address}</p>
            <p><strong>Billing Email:</strong> {billingDetails.email}</p>

            {/* PDF Preview Section */}
            {invoiceUrl ? (
              <div className={styles.pdfContainer}>
                <h3>Invoice Preview</h3>
                
                <a 
                  href={invoiceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.downloadButton}
                  download={`invoice_${unique_id}.pdf`}
                >
                  Download Invoice
                </a>
              </div>
            ) : (
              <p>No invoice available. Please upload one.</p>
            )}

            {/* File Upload Section */}
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
            {selectedFile && <p>📎 {selectedFile.name}</p>}

            <div className={styles.buttonGroup}>
              <button onClick={handleUpload} className={styles.uploadButton}>Save & Upload</button>
              <button onClick={onClose} className={styles.closeButton}>Close</button>
            </div>
          </>
        ) : (
          <p>Loading billing details...</p>
        )}
      </div>
    </div>
  );
};

export default BillingModal;
