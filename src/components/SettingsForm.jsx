import React, { useState, useEffect, useRef } from "react";
import Dither from "./Dither.tsx";
import { useNavigate } from "react-router-dom";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import demoSettings from "../data/demoSettings"; // Import demo settings for testing
// Import styles for loading screen (adjust this if you're using a different approach)
import styles from "./Dashboard.module.css"; // This should match what you use in Dashboard

const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="spinner">
        <div className="double-bounce1"></div>
        <div className="double-bounce2"></div>
      </div>
      <div className="loading-text">
        <h3>Loading...</h3>
        <div className="loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
      <p className="loading-message">Please wait</p>
    </div>
  </div>
);

const SettingsForm = () => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const [settings, setSettings] = useState({
    sentences: [],
    wordArray: [],
    h2WordArray: [],
  });

  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });

  const [isDisabled, setIsDisabled] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [automationStatus, setAutomationStatus] = useState(localStorage.getItem("status") || "Stopped");
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Monitor automation status changes
  useEffect(() => {
    const checkAutomationStatus = () => {
      const status = localStorage.getItem("status");
      setAutomationStatus(status || "Stopped");
    };

    // Check status on mount
    checkAutomationStatus();

    // Set up interval to check status every second
    const interval = setInterval(checkAutomationStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true); // Start loading
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        alert("User email not found!");
        setIsLoading(false);
        return;
      }

      if (userEmail === "demo@leadscruise.com") {
        setSettings(demoSettings); // Use demo settings for testing
        setIsLoading(false); // End loading
        return;
      }

      try {
        const response = await axios.get(
          `https://api.leadscruise.com/api/get-settings/${userEmail}`
        );
        if (response.data && response.data.sentences) {
          setSettings(response.data);
          setOriginalSettings(response.data);
        } else {
          setSettings({ sentences: [], wordArray: [], h2WordArray: [] });
          setOriginalSettings({ sentences: [], wordArray: [], h2WordArray: [] });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        alert("Failed to fetch settings.");
      } finally {
        setIsLoading(false); // End loading regardless of success/failure
      }
    };

    fetchSettings();
  }, []);

  // Modal States
  const [modalType, setModalType] = useState("");
  const [modalData, setModalData] = useState([]);
  const [newItem, setNewItem] = useState("");
  const textareaRef = useRef(null);

  // Function to adjust height based on content
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set the height to match the scrollHeight
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Adjust height whenever content changes
  useEffect(() => {
    adjustHeight();
  }, [newItem]);

  // Open modal
  const openModal = (type) => {
    setModalType(type);
    setModalData([...settings[type]]);
  };

  // Close modal
  const closeModal = () => {
    setModalType("");
    setModalData([]);
    setNewItem("");
  };

  const addItemInModal = () => {
    if (newItem.trim() && !modalData.includes(newItem.trim())) {
      setModalData([...modalData, newItem.trim()]);
      setNewItem("");

      setTimeout(() => {
        const listItems = document.querySelectorAll(".modal-content li");
        if (listItems.length > 0) {
          const lastItem = listItems[listItems.length - 1];
          lastItem.classList.add("item-added");

          setTimeout(() => {
            lastItem.classList.remove("item-added");
          }, 1500);
        }
      }, 10);
    } else {
      alert("Item already exists or empty!");
    }
  };

  // Delete item inside modal
  const deleteItemInModal = (index) => {
    const updatedData = modalData.filter((_, i) => i !== index);
    setModalData(updatedData);
  };

  // Save changes from modal to main state
  const saveChanges = async (modalType, modalData) => {
    setSettings((prev) => ({
      ...prev,
      [modalType]: modalData,
    }));

    const updatedSettings = { ...settings, [modalType]: modalData }; // Ensure updated values
    console.log("Updated Settings:", updatedSettings); // Debugging log

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      alert("User email not found!");
      return;
    }

    try {
      await axios.post("https://api.leadscruise.com/api/save-settings", {
        userEmail,
        sentences: updatedSettings.sentences || [],
        wordArray: updatedSettings.wordArray || [],
        h2WordArray: updatedSettings.h2WordArray || [],
      });

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    }

    closeModal();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); // Start loading

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      alert("User email not found!");
      setIsLoading(false);
      return;
    }

    try {
      await axios.post("https://api.leadscruise.com/api/save-settings", {
        userEmail,
        sentences: settings.sentences,
        wordArray: settings.wordArray,
        h2WordArray: settings.h2WordArray,
      });

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const handleRevert = async () => {
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      return alert("User email not found!");
    }

    if (window.confirm("Are you sure you want to revert? This will permanently restore your settings to the state they were in when your account was first created.")) {
      setIsLoading(true);
      try {
        const response = await axios.post("https://api.leadscruise.com/api/restore-initial-settings", {
          userEmail,
        });

        // Update the local state with the restored settings from the server
        setSettings(response.data.settings);
        setOriginalSettings(response.data.settings); // Also update the temporary backup

        alert(response.data.message);
      } catch (error) {
        console.error("Error reverting settings:", error);
        alert(error.response?.data?.message || "Failed to revert settings.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const startEditing = (index, value) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  const updateItemInModal = () => {
    if (editingValue.trim() === "")
      return alert("Updated value can't be empty!");

    const updated = [...modalData];
    updated[editingIndex] = editingValue.trim();
    setModalData(updated);
    setEditingIndex(null);
    setEditingValue("");
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  // Helper function to check if editing should be disabled
  const isEditDisabled = () => {
    return localStorage.getItem("userEmail") === "demo@leadscruise.com" || automationStatus === "Running";
  };

  // Helper function to handle edit button click
  const handleEditClick = (type) => {
    if (localStorage.getItem("userEmail") === "demo@leadscruise.com") {
      alert("You cannot edit in demo account");
      return;
    }
    if (automationStatus === "Running") {
      alert("You cannot edit settings while automation is running");
      return;
    }
    openModal(type);
  };

  return (
    <>
    {/* Dither Background */}
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      zIndex: 0
    }}>
      <Dither
        waveColor={[51/255, 102/255, 128/255]}
        disableAnimation={false}
        enableMouseInteraction={true}
        mouseRadius={0.3}
        colorNum={5}
        waveAmplitude={0.25}
        waveFrequency={2.5}
        waveSpeed={0.03}
        pixelSize={2.5}
      />
    </div>
    <div
      className="settings-page-wrapper"
      style={windowWidth <= 768 ? { marginLeft: 0 } : {}}
    >
      {/* Loading Screen */}
      {isLoading && <LoadingScreen />}

      {/* Conditional Sidebar Component */}
      {(windowWidth > 768 || sidebarOpen) && (
        <Sidebar isDisabled={isDisabled} />
      )}

      {/* Fixed Dashboard Header */}
      <DashboardHeader
        handleSubmit={handleSubmit}
        handleRevert={handleRevert}
        style={
          windowWidth <= 768
            ? {
              left: 0,
              width: "100%",
              marginLeft: 0,
              padding: "15px",
            }
            : {}
        }
      />

      {/* Scrollable Settings Container */}
      <div className="settings-scroll-container">
        <form className="settings-form">
          {/* Sentences Section */}
          <div className="table-container">
            <h2>Messages to send as replies</h2>
            {settings.sentences.length > 0 ? (
              <ul>
                {settings.sentences.map((sentence, index) => (
                  <li key={index}>{sentence}</li>
                ))}
              </ul>
            ) : (
              <p>No sentences added.</p>
            )}
            <div className="edit-button-container">
              <button
                type="button"
                className="edit-button"
                style={{
                  backgroundColor: isEditDisabled() ? "#ccc" : "",
                  cursor: isEditDisabled() ? "not-allowed" : "pointer",
                  color: isEditDisabled() ? "#666" : ""
                }}
                onClick={() => handleEditClick("sentences")}
              >
                Edit
              </button>
            </div>
          </div>

          {/* Word Array Section */}
          <div className="table-container">
            <h2>Accepted Categories</h2>
            {settings.wordArray.length > 0 ? (
              <ul>
                {settings.wordArray.map((category, index) => (
                  <li key={index}>{category}</li>
                ))}
              </ul>
            ) : (
              <p>No categories added.</p>
            )}
            <div className="edit-button-container">
              <button
                type="button"
                className="edit-button"
                style={{
                  backgroundColor: isEditDisabled() ? "#ccc" : "",
                  cursor: isEditDisabled() ? "not-allowed" : "pointer",
                  color: isEditDisabled() ? "#666" : ""
                }}
                onClick={() => handleEditClick("wordArray")}
              >
                Edit
              </button>
            </div>
          </div>

          {/* H2 Word Array Section */}
          <div className="table-container">
            <h2>Leads to be rejected</h2>
            {settings.h2WordArray.length > 0 ? (
              <ul>
                {settings.h2WordArray.map((lead, index) => (
                  <li key={index}>{lead}</li>
                ))}
              </ul>
            ) : (
              <p>No rejected leads added.</p>
            )}
            <div className="edit-button-container">
              <button
                type="button"
                className="edit-button"
                style={{
                  backgroundColor: isEditDisabled() ? "#ccc" : "",
                  cursor: isEditDisabled() ? "not-allowed" : "pointer",
                  color: isEditDisabled() ? "#666" : ""
                }}
                onClick={() => handleEditClick("h2WordArray")}
              >
                Edit
              </button>
            </div>
          </div>

          {/* Profile Section */}
          <ProfileCredentials />
        </form>
      </div>

      {/* Modal Popup */}
      {modalType && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.className === "modal-overlay") closeModal();
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                Edit{" "}
                {modalType
                  .replace("wordArray", "Accepted Categories")
                  .replace("h2WordArray", "Rejected Leads")}
              </h2>
              <button
                className="modal-close-icon"
                onClick={closeModal}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <ul>
              {modalData.map((item, index) => (
                <li
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                  }}
                >
                  {editingIndex === index ? (
                    <>
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="editing-input"
                        style={{ flex: 1, marginRight: "10px" }}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="save-button"
                          onClick={() => updateItemInModal(index)}
                        >
                          Save
                        </button>
                        <button
                          className="cancel-button"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1 }}>{item}</span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="edit-button"
                          onClick={() => startEditing(index, item)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => deleteItemInModal(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="add-keyword-container">
              <textarea
                ref={textareaRef}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder={
                  modalType === "sentences"
                    ? "Enter new message"
                    : "Enter new item"
                }
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addItemInModal();
                  }
                }}
                className="adaptable-textarea"
                rows={1}
                style={{
                  resize: "none",
                  overflow: "hidden",
                  minHeight: "38px",
                  width: "100%",
                  maxWidth: "100%",
                  padding: "8px 12px",
                  boxSizing: "border-box",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "1.5",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              />
              <button
                type="button"
                className="add-button"
                onClick={addItemInModal}
              >
                Add
              </button>
            </div>
            <div className="modal-buttons">
              <button
                className="save-button save-changes-button"
                onClick={() => saveChanges(modalType, modalData)}
              >
                Save Changes
              </button>
              <button className="settings-close-button" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default SettingsForm;