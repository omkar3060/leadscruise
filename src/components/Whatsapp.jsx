import React, { useState, useEffect, useRef } from "react";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import './Whatsapp.css';

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

const Whatsapp = () => {
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    renewal_date: "Loading...",
    status: "Loading...",
  });
  const status = localStorage.getItem("status");
  //   console.log("Status in Sidebar:", status);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    const savedLoadingState = localStorage.getItem("whatsappVerificationLoading");
    // Parse the string "true" to boolean true, or default to false
    return savedLoadingState === "true";
  });
  const [editLockedUntil, setEditLockedUntil] = useState(() => {
    const stored = localStorage.getItem("editLockedUntil");
    return stored ? parseInt(stored, 10) : null;
  });
  const [justUpdated, setJustUpdated] = useState(false);
  const [error, setError] = useState(null);
  const [newWhatsappNumber, setNewWhatsappNumber] = useState("");
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [messages, setMessages] = useState([{ id: Date.now(), text: '' }]);
  const [verificationCode, setVerificationCode] = useState('');
  const addMessage = () => {
    setMessages([...messages, { id: Date.now(), text: '' }]);
  };

  const updateLoadingState = (newLoadingState) => {
    setIsLoading(newLoadingState);
    localStorage.setItem("whatsappVerificationLoading", newLoadingState.toString());
  };

  const removeMessage = (id) => {
    if (messages.length >= 1) {
      setMessages(messages.filter(msg => msg.id !== id));
    }
  };

  const handleMessageChange = (id, text) => {
    setMessages(messages.map(msg => msg.id === id ? { ...msg, text } : msg));
  };

  useEffect(() => {
    // Add a timestamp when loading starts to detect stale loading states
    if (isLoading) {
      localStorage.setItem("whatsappLoadingStartTime", Date.now().toString());
    }

    return () => {
      // This cleanup function won't run on page reload, only on component unmount
      // We leave the logic here in case the user navigates away from the page
      if (isLoading) {
        // Don't clear loading state on normal unmount - we want it to persist
      }
    };
  }, [isLoading]);

  // 7. Add a timeout check to prevent indefinite loading states
  useEffect(() => {
    if (isLoading) {
      const loadingStartTime = localStorage.getItem("whatsappLoadingStartTime");
      if (loadingStartTime) {
        const startTime = parseInt(loadingStartTime, 10);
        const currentTime = Date.now();
        const loadingDuration = currentTime - startTime;

        // If it's been loading for more than 10 minutes (600000ms), reset it
        // Adjust this timeout as needed based on your verification process
        if (loadingDuration > 600000) {
          console.log("Loading state timed out after 10 minutes");
          updateLoadingState(false);
          setIsLoading(false);
          localStorage.removeItem("whatsappLoadingStartTime");
        }
      }
    }
  }, [isLoading]);

  const fetchSettings = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) return;

    try {
      const res = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/get?mobileNumber=${mobileNumber}`);
      const data = await res.json();

      if (res.ok) {
        setWhatsappNumber(data.data.whatsappNumber);
        setNewWhatsappNumber(data.data.whatsappNumber);
        setVerificationCode(data.data.verificationCode || '');

        // Updated to access messages correctly from data.data
        if (data.data.messages && data.data.messages.length > 0) {
          setMessages(data.data.messages.map((text, index) => ({
            id: Date.now() + index,
            text
          })));
        } else {
          // Default empty message
          setMessages([{ id: Date.now(), text: '' }]);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchVerificationCode = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) {
      console.log("No mobile number found in localStorage");
      return;
    }

    try {
      console.log("Fetching verification code for:", mobileNumber);

      // Using native fetch API
      const response = await fetch(`https://api.leadscruise.com/api/whatsapp-settings/verification-code/${mobileNumber}`);

      if (!response.ok) {
        console.error(`Error response: ${response.status}`);
        return;
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Check if the response contains a verification code
      if (data && data.verificationCode) {
        const code = data.verificationCode;
        console.log("Received verification code:", code);

        // Update state with the verification code
        setVerificationCode(code);

        // Update loading state if we got a code
        if (code) {
          setIsLoading(false);
          localStorage.setItem("whatsappVerificationLoading", "false");
        }
      } else {
        console.log("No verification code in response data:", data);
      }
    } catch (error) {
      console.error("Error fetching verification code:", error);
    }
  };

  useEffect(() => {
    console.log("Component updated with isLoading:", isLoading, "verificationCode:", verificationCode);
  }, [isLoading, verificationCode]);

  // Use a ref to store the interval ID so we can clear it from within fetchVerificationCode
  const intervalRef = useRef(null);

  // Simplified polling with fewer dependencies
  useEffect(() => {

    // Initial fetch
    fetchVerificationCode();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchVerificationCode();
    }, 3000);

    // Clean up on unmount or when isLoading changes
    return () => clearInterval(interval);
  }, []); // Only depend on isLoading // Add dependencies to re-establish interval if these change

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const savedLock = localStorage.getItem("editLockedUntil");
    if (savedLock) {
      setEditLockedUntil(Number(savedLock));
    }
  }, []); 

  const handleSubmit = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");

    if (!mobileNumber || !whatsappNumber || messages.length === 0 || messages.some(msg => !msg.text)) {
      return alert("All fields are required and you need at least one message!");
    }

    const formData = new FormData();
    formData.append("mobileNumber", mobileNumber);
    formData.append("whatsappNumber", whatsappNumber);
    formData.append("messages", JSON.stringify(messages.map(msg => msg.text)));

    try {
      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/save", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert("Settings saved successfully!");
        // Refresh settings to get updated file list
        fetchSettings();
      } else {
        alert(data.error || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while saving settings.");
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedSubscription = localStorage.getItem("subscriptionDetails");
    if (storedSubscription) {
      setSubscriptionDetails(JSON.parse(storedSubscription));
    }
  }, []);

  const updateWhatsappNumber = async () => {
    if (!newWhatsappNumber) {
      alert("WhatsApp number cannot be empty!");
      return;
    }
    updateLoadingState(true);
    setIsLoading(true);
    setVerificationCode("");
    setError(null);
    setJustUpdated(true);
    try {
      const mobileNumber = localStorage.getItem("mobileNumber");

      const res = await fetch("https://api.leadscruise.com/api/whatsapp-settings/update-whatsapp-number", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, newWhatsappNumber }),
      });
      const lockUntil = Date.now() + 15 * 60 * 1000;
      localStorage.setItem("editLockedUntil", lockUntil);
      setEditLockedUntil(lockUntil);
      const data = await res.json();
      if (res.ok) {
        alert("WhatsApp number updated successfully! Please wait a few minutes for a verification code. Enter it in WhatsApp to enable messaging buyers.");
        setWhatsappNumber(newWhatsappNumber);
        setIsEditingWhatsapp(false);
      } else {
        alert(data.error || "Failed to update WhatsApp number.");
        setError("Failed to update WhatsApp number");
        setIsLoading(false);
        updateLoadingState(false);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Server error during update.");
      setError("Failed to update WhatsApp number");
      setIsLoading(false);
      setEditLockedUntil(null);
      localStorage.removeItem("editLockedUntil");
      updateLoadingState(false);
    }
  };

  useEffect(() => {
    if (justUpdated && verificationCode && verificationCode !== "111") {
      // Allow editing again after verification received
      setEditLockedUntil(null);
      localStorage.removeItem("editLockedUntil");
    }
  }, [verificationCode, justUpdated]);

  useEffect(() => {
    if (editLockedUntil && Date.now() < editLockedUntil) {
      const timeout = setTimeout(() => {
        setEditLockedUntil(null);
        localStorage.removeItem("editLockedUntil");
      }, editLockedUntil - Date.now());
  
      return () => clearTimeout(timeout);
    }
  }, [editLockedUntil]);  

  useEffect(() => {
    // Find all auto-expanding textareas and set their height
    const textareas = document.querySelectorAll('.auto-expanding-input');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  }, [messages]);

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
      textarea.style.height = 'auto';
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
    setModalData(messages.map((msg) => msg.text));
    setModalType(type);
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
  const saveChanges = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) {
      alert("Mobile number not found!");
      return;
    }

    try {
      await axios.post("https://api.leadscruise.com/api/whatsapp-settings/save", {
        mobileNumber,
        whatsappNumber: newWhatsappNumber,
        verificationCode,
        messages: modalData, // Save new message list
      });

      // Update local state
      setMessages(modalData.map((text, index) => ({
        id: Date.now() + index,
        text,
      })));

      alert("Messages saved successfully!");
    } catch (err) {
      console.error("Error saving messages:", err);
      alert("Failed to save messages.");
    }

    closeModal();
  };

  return (
    <div className="settings-page-wrapper" style={windowWidth <= 768 ? { marginLeft: 0 } : {}}>
      {(windowWidth > 768 || sidebarOpen) && <Sidebar status={status} />}
      <DashboardHeader
        style={windowWidth <= 768 ? {
          left: 0,
          width: "100%",
          marginLeft: 0,
          padding: "15px"
        } : {}}
      />
      <div className="settings-scroll-container">
        <div className="sheets-container">
          {/* WhatsApp Settings Section */}
          <div className="table-container whatsapp-settings-table">
            <h2>WhatsApp Settings</h2>
            {messages.length > 0 ? (
              <ul>
                {messages.map((msg) => (
                  <li key={msg.id}>{msg.text}</li>
                ))}
              </ul>
            ) : (
              <p>No messages added.</p>
            )}
            <div className="edit-button-container">
              <button type="button" className="edit-button" onClick={() => openModal("sentences")}>
                Edit
              </button>
            </div>
          </div>

          {/* Modal Popup */}
          {modalType === "sentences" && (
            <div
              className="modal-overlay"
              onClick={(e) => {
                if (e.target.className === "modal-overlay") closeModal();
              }}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h2>Edit Messages to send as replies</h2>
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
                      <button className="delete-button" onClick={() => deleteItemInModal(index)}>
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="add-keyword-container">
                  <textarea
                    ref={textareaRef}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Enter new message"
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
                  <button type="button" className="add-button" onClick={addItemInModal}>
                    Add
                  </button>
                </div>
                <div className="modal-buttons">
                  <button className="save-button" onClick={() => saveChanges(modalType, modalData)}>
                    Save Changes
                  </button>
                  <button className="settings-close-button" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}


          <ProfileCredentials isProfilePage={true}
            newWhatsappNumber={newWhatsappNumber}
            setNewWhatsappNumber={setNewWhatsappNumber}
            isEditingWhatsapp={isEditingWhatsapp}
            setIsEditingWhatsapp={setIsEditingWhatsapp}
            updateWhatsappNumber={updateWhatsappNumber}
            verificationCode={verificationCode}
            setVerificationCode={setVerificationCode}
            isLoading={isLoading}
            editLockedUntil={editLockedUntil}
            setEditLockedUntil={setEditLockedUntil}
            justUpdated={justUpdated}
            setJustUpdated={setJustUpdated}
            error={error} />
        </div>
      </div>
      <div className="support-info">
        <h3 className="support-info__title">
          <svg xmlns="http://www.w3.org/2000/svg" className="support-info__title-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Need Help?
        </h3>
        <div className="support-info__content">
          <p className="support-info__paragraph">
            <svg xmlns="http://www.w3.org/2000/svg" className="support-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            If you encounter any issues, contact our support team at &nbsp;{' '}
            <a href="mailto:support@leadscruise.com" className="support-info__link">
              support@leadscruise.com
            </a>
          </p>
          <p className="support-info__paragraph">
            <svg xmlns="http://www.w3.org/2000/svg" className="support-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            For FAQs, visit our&nbsp;{' '}
            <a href="https://leadscruise.com" className="support-info__link support-info__link--with-icon">
              Landing Page
              <svg xmlns="http://www.w3.org/2000/svg" className="support-info__external-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </p>
          <p className="support-info__paragraph">
      <svg xmlns="http://www.w3.org/2000/svg" className="support-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="10" y1="15" x2="10" y2="9"></line>
        <line x1="14" y1="15" x2="14" y2="9"></line>
        <line x1="7" y1="12" x2="17" y2="12"></line>
      </svg>
      Watch our&nbsp;{' '}
      <a href="https://www.youtube.com/watch?v=yQgrVTUYlvk" className="support-info__link support-info__link--with-icon">
        Demo Video
        <svg xmlns="http://www.w3.org/2000/svg" className="support-info__external-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
      &nbsp;for a quick tutorial on how to use our whatsapp feature.
    </p>
        </div>
      </div>

    </div>
  );
};

export default Whatsapp;
