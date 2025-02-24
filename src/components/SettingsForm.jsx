import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SettingsForm.css"; // Contains both header and form styling
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar"; // Import Sidebar component
import axios from "axios";

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

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  const [isDisabled, setIsDisabled] = useState(false); // Controls sidebar settings access
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        alert("User email not found!");
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
      }
    };

    fetchSettings();
  }, []);

  // Modal States
  const [modalType, setModalType] = useState(""); // Which modal is open? ("sentences", "wordArray", "h2WordArray")
  const [modalData, setModalData] = useState([]); // Stores the items inside the modal
  const [newItem, setNewItem] = useState(""); // Stores input for new item

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

      // Add animation class to the last item after a short delay
      setTimeout(() => {
        const listItems = document.querySelectorAll('.modal-content li');
        if (listItems.length > 0) {
          const lastItem = listItems[listItems.length - 1];
          lastItem.classList.add('item-added');

          // Remove the class after animation completes
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

    const userEmail = localStorage.getItem("userEmail"); // Ensure userEmail is stored in localStorage
    if (!userEmail) {
      alert("User email not found!");
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
    }
  };

  const handleRevert = async () => {
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      alert("User email not found!");
      return;
    }

    if (window.confirm("Are you sure you want to revert all settings?")) {
      try {
        await axios.delete(`https://api.leadscruise.com/api/delete-settings/${userEmail}`);
        setSettings({ sentences: [], wordArray: [], h2WordArray: [] });
        alert("Settings reverted successfully!");
      } catch (error) {
        console.error("Error reverting settings:", error);
        alert("Failed to revert settings.");
      }
    }
  };

  return (
    <div className="settings-page-wrapper">
      {/* Sidebar Component */}
      <Sidebar isDisabled={isDisabled} />

      {/* Fixed Dashboard Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="status-section">
            <div className="status-label" onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </div>
            <div className="start-stop-buttons">
              <button className="start-button"onClick={handleSubmit}>Save All</button>
              <button className="stop-button" onClick={handleRevert}>Revert All</button>
            </div>
          </div>
          <div className="profile-section">
            <button className="profile-button" onClick={() => navigate("/profile")}>Profile</button>
            <div>
              <p className="renewal-text">
                Subscription Status: {subscriptionDetails.status}
              </p>
              <p className="renewal-text">
                Subscription next renewal date: {subscriptionDetails.renewal_date}
              </p>
            </div>
          </div>
        </div>
      </header>

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