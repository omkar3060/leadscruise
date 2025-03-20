import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./BillingModal.module.css";
import io from "socket.io-client";

const BillingModal = ({ isOpen, onClose, userEmail, unique_id }) => {
  const [billingDetails, setBillingDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [apiKey, setApiKey] = useState(""); // Store API key
  const [sheetsId, setSheetsId] = useState(""); // New state for Sheets ID
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const socket = io("http://localhost:5001");

  
  useEffect(() => {
    // Listen for errors
    socket.on("error", (data) => {
      setErrorMessage(data.error);
      alert(`Error from AI: ${data.error}`);
    });

    return () => {
      socket.off("error"); // Cleanup on unmount
    };
  }, []);

  useEffect(() => {
    if (userEmail) {
      const interval = setInterval(() => {
        axios
          .post("https://api.leadscruise.com/api/check-script-status", { email: userEmail })
          .then((response) => {
            if (response.data.success) {
              setIsRunning(response.data.isRunning);
            }
          })
          .catch((error) => console.error("Error checking script status:", error));
      }, 3000); // Polling every 3 seconds

      return () => clearInterval(interval); // Cleanup when component unmounts
    }
  }, [isOpen, userEmail]);

  useEffect(() => {
    if (isOpen && userEmail) {
      axios.get(`https://api.leadscruise.com/api/billing/${userEmail}`)
        .then((response) => {
          if (response.data.success) {
            setBillingDetails(response.data.data);
          } else {
            setBillingDetails(null);
          }
        })
        .catch((error) => console.error("Error fetching billing details:", error));

      axios.get(`https://api.leadscruise.com/api/get-api-key/${userEmail}`)
        .then((response) => {
          if (response.data.success) {
            setApiKey(response.data.user.apiKey || "Not Available");
            setSheetsId(response.data.user.sheetsId || ""); // Fetch existing Sheets ID
          } else {
            setApiKey("Not Available");
          }
        })
        .catch((error) => console.error("Error fetching API Key:", error));
    } else {
      setBillingDetails(null);
      setApiKey("");
      setSheetsId("");
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
      await axios.post(`https://api.leadscruise.com/api/upload-invoice/${unique_id}`, formData, {
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

  const handleUpdate = async () => {
    setLoading(true); // Start spinner until update completes
    const throughUpdate = 1;
    try {
      const response = await axios.post("https://api.leadscruise.com/api/update-sheets-id", {
        email: userEmail,
        apiKey,
        sheetsId,
        throughUpdate,
      });

      if (response.data.success) {
        alert("Updated successfully! Starting AI...");
        setLoading(false);
        setIsRunning(true);
        
      } else {
        setLoading(false);
        alert(`Error:\n${response.data.error || "Failed to update."}`);
        
      }
    } catch (error) {
      console.log("Error updating Sheets ID:", error.response);
      const errorMessage =
        error.response?.data?.error || "Error updating details.";
      setLoading(false);
      alert(errorMessage);
      
    } finally {
      setLoading(false); // Stop spinner once update is complete
    }
  };

  const handleStop = async () => {
    try {
      const response = await axios.post("https://api.leadscruise.com/api/stop-api-script", {
        email: userEmail,
      });

      if (response.data.success) {
        alert("AI stopped successfully!");
        setIsRunning(false);
        
      } else {
        alert("Failed to stop AI.");
      }
    } catch (error) {
      console.error("Error stopping script:", error);
      alert("Error stopping AI.");
    }
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

            {/* Display API Key */}
            <p><strong>API Key:</strong> {apiKey}</p>

            {/* New Sheets ID Input Field */}
            <div className={styles.inputGroup}>
              <strong>
                <label htmlFor="sheetsId">Google Sheets ID:</label>
              </strong>
              <input
                type="text"
                id="sheetsId"
                value={sheetsId}
                onChange={(e) => setSheetsId(e.target.value)}
                placeholder="Enter Google Sheets ID"
              />
              <button
                onClick={isRunning ? handleStop : handleUpdate}
                className={`${styles.attachBillLabel} ${isRunning ? styles.running : ""}`}
                disabled={loading}
                title={isRunning ? "AI already started, click to stop" : ""}
              >
                {loading ? (
                  <div className={styles.spinner}></div>
                ) : isRunning ? (
                  "Stop"
                ) : (
                  "Update"
                )}
              </button>
            </div>
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
