import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";

// Import styles for loading screen (adjust this if you're using a different approach)
import styles from "./Dashboard.module.css"; // This should match what you use in Dashboard

const LoadingScreen = () => (
  <div className={styles["loading-overlay"]}>
    <div className={styles["loading-container"]}>
      <div className={styles["loading-spinner"]}></div>
      <p className={styles["loading-text"]}>Loading...</p>
      <div className={styles["loading-progress-dots"]}>
        <div className={styles["loading-dot"]}></div>
        <div className={styles["loading-dot"]}></div>
        <div className={styles["loading-dot"]}></div>
      </div>
    </div>
  </div>
);

const SettingsForm = () => {
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
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/get-settings/${userEmail}`);
        if (response.data && response.data.sentences) {
          setSettings(response.data);
        } else {
          setSettings({ sentences: [], wordArray: [], h2WordArray: [] });
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
        const listItems = document.querySelectorAll('.modal-content li');
        if (listItems.length > 0) {
          const lastItem = listItems[listItems.length - 1];
          lastItem.classList.add('item-added');

          setTimeout(() => {
            lastItem.classList.remove('item-added');
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
  const saveChanges = () => {
    setSettings((prev) => ({
      ...prev,
      [modalType]: modalData,
    }));
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
      alert("User email not found!");
      return;
    }

    if (window.confirm("Are you sure you want to revert all settings?")) {
      setIsLoading(true); // Start loading
      try {
        await axios.delete(`https://api.leadscruise.com/api/delete-settings/${userEmail}`);
        setSettings({ sentences: [], wordArray: [], h2WordArray: [] });
        alert("Settings reverted successfully!");
      } catch (error) {
        console.error("Error reverting settings:", error);
        alert("Failed to revert settings.");
      } finally {
        setIsLoading(false); // End loading
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
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
        style={windowWidth <= 768 ? { 
          left: 0, 
          width: '100%',
          marginLeft: 0,
          padding: '15px'
        } : {}}
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
              <button type="button" className="edit-button" onClick={() => openModal("sentences")}>
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
              <button type="button" className="edit-button" onClick={() => openModal("wordArray")}>
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
              <button type="button" className="edit-button" onClick={() => openModal("h2WordArray")}>
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
        <div className="modal-overlay" onClick={(e) => {
          if (e.target.className === 'modal-overlay') closeModal();
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit {modalType.replace("wordArray", "Accepted Categories").replace("h2WordArray", "Rejected Leads")}</h2>
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
                <li key={index}>
                  <span>{item}</span>
                  <button className="delete-button" onClick={() => deleteItemInModal(index)}>Delete</button>
                </li>
              ))}
            </ul>
            <div className="add-keyword-container">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Enter new item"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItemInModal();
                  }
                }}
              />
              <button type="button" className="add-button" onClick={addItemInModal}>Add</button>
            </div>
            <div className="modal-buttons">
              <button className="save-button" onClick={saveChanges}>Save Changes</button>
              <button className="settings-close-button" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsForm;