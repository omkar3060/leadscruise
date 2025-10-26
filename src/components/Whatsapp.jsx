import React, { useState, useEffect, useRef } from "react";
import Dither from "./Dither.tsx";
import "./SettingsForm.css";
import ProfileCredentials from "./ProfileCredentials";
import Sidebar from "./Sidebar";
import axios from "axios";
import DashboardHeader from "./DashboardHeader";
import "./Whatsapp.css";

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
  const [isLoading, setIsLoading] = useState(() => {
    const savedLoadingState = localStorage.getItem(
      "whatsappVerificationLoading"
    );
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
  const [messages, setMessages] = useState([{ id: Date.now(), text: "" }]);
  const [verificationCode, setVerificationCode] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [newNumber, setNewNumber] = useState('');

  const extractPhoneNumbers = (messages) => {
    if (messages.length === 0) return [];

    const firstMessage = messages[0].text;

    // Extract the part between "You can contact" and "or send a mail"
    const match = firstMessage.match(/You can contact(.*?)or send a mail/i);
    if (!match) return [];

    // Extract only phone numbers (10-digit or +91XXXXXXXXXX)
    const numbers = match[1]
      .split(',')
      .map(num => num.trim())
      .filter(num => /^(\+91\d{10}|\d{10})$/.test(num)); // ✅ Validation

    return numbers;
  };

  const handleEditClick = () => {
    const extractedNumbers = extractPhoneNumbers(messages);
    setPhoneNumbers(extractedNumbers.map((num, index) => ({ id: index, number: num })));
    setShowPopup(true);
  };

  const handleAddNumber = () => {
    if (newNumber.trim()) {
      const trimmedNumber = newNumber.trim();

      // ✅ Validate number: allow 10-digit or +91XXXXXXXXXX
      const isValid = /^(\+91\d{10}|\d{10})$/.test(trimmedNumber);
      if (!isValid) {
        alert("Please enter a valid phone number (10 digits or +91XXXXXXXXXX).");
        return;
      }

      // Prevent adding duplicates
      if (phoneNumbers.some(p => p.number === trimmedNumber)) {
        alert("This number is already added.");
        return;
      }

      const newId = phoneNumbers.length > 0 ? Math.max(...phoneNumbers.map(p => p.id)) + 1 : 1;
      setPhoneNumbers([...phoneNumbers, { id: newId, number: trimmedNumber }]);
      setNewNumber('');
    }
  };

  const handleDeleteNumber = (id) => {
    setPhoneNumbers(phoneNumbers.filter(phone => phone.id !== id));
  };

  const handleEditNumber = (id, newValue) => {
    setPhoneNumbers(phoneNumbers.map(phone =>
      phone.id === id ? { ...phone, number: newValue } : phone
    ));
  };

  const handleSave = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    try {
      if (messages.length === 0) {
        alert("No messages to update");
        return;
      }

      // Join all phone numbers into a comma-separated string
      const newNumbersString = phoneNumbers.map(p => p.number).join(", ");

      // Replace numbers inside each message where applicable
      const updatedMessages = messages.map(m => {
        return {
          ...m,
          text: m.text.replace(
            /(You can contact)(.*?)(or send a mail)/i,
            `$1 ${newNumbersString} $3`
          )
        };
      });

      const response = await fetch('https://api.leadscruise.com/api/whatsapp-settings/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobileNumber,
          messages: updatedMessages.map(m => m.text)
        })
      });

      if (response.ok) {
        alert('Phone numbers and messages updated successfully!');
        setShowPopup(false);
        window.location.reload();
      } else {
        alert('Failed to update settings');
      }
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error);
      alert('Error saving WhatsApp settings');
    }
  };

  const updateLoadingState = (newLoadingState) => {
    setIsLoading(newLoadingState);
    localStorage.setItem(
      "whatsappVerificationLoading",
      newLoadingState.toString()
    );
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
          // console.log("Loading state timed out after 10 minutes");
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

    if (mobileNumber === "9999999999") {
      const demoMessages = [
        { id: Date.now(), text: "Hello! Thanks for reaching out to us." },
        { id: Date.now() + 1, text: "Our team will contact you shortly." },
        { id: Date.now() + 2, text: "For urgent inquiries, call us at +91-9999999999." }
      ];

      setWhatsappNumber("9999999999");
      setNewWhatsappNumber("9999999999");
      setMessages(demoMessages);
      localStorage.setItem("whatsappMessagesLength", demoMessages.length);
      return;
    }

    try {
      const res = await fetch(
        `https://api.leadscruise.com/api/whatsapp-settings/get?mobileNumber=${mobileNumber}`
      );
      const data = await res.json();

      if (res.ok) {
        setWhatsappNumber(data.data.whatsappNumber);
        setNewWhatsappNumber(data.data.whatsappNumber);
        setVerificationCode(data.data.verificationCode || "");

        // Updated to access messages correctly from data.data
        if (data.data.messages && data.data.messages.length > 0) {
          // console.log("Fetched messages:", data.data.messages);
          setMessages(
            data.data.messages.map((text, index) => ({
              id: Date.now() + index,
              text,
            }))
          );
          localStorage.setItem(
            "whatsappMessagesLength",
            data.data.messages.length
          );
        } else {
          // Default empty message
          setMessages([{ id: Date.now(), text: "" }]);
          localStorage.setItem("whatsappMessagesLength", 0);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchVerificationCode = async () => {
    const mobileNumber = localStorage.getItem("mobileNumber");
    if (!mobileNumber) {
      // console.log("No mobile number found in localStorage");
      return;
    }

    try {
      // console.log("Fetching verification code for:", mobileNumber);

      // Using native fetch API
      const response = await fetch(
        `https://api.leadscruise.com/api/whatsapp-settings/verification-code/${mobileNumber}`
      );

      if (!response.ok) {
        console.error(`Error response: ${response.status}`);
        return;
      }

      const data = await response.json();
      // console.log("API Response:", data);

      // Check if the response contains a verification code
      if (data && data.verificationCode) {
        const code = data.verificationCode;
        // console.log("Received verification code:", code);

        // Update state with the verification code
        setVerificationCode(code);

        // Update loading state if we got a code
        if (code) {
          setIsLoading(false);
          localStorage.setItem("whatsappVerificationLoading", "false");
        }
      } else {
        // console.log("No verification code in response data:", data);
      }
    } catch (error) {
      console.error("Error fetching verification code:", error);
    }
  };

  useEffect(() => {
    // console.log(
    //   "Component updated with isLoading:",
    //   isLoading,
    //   "verificationCode:",
    //   verificationCode
    // );
  }, [isLoading, verificationCode]);

  // Simplified polling with fewer dependencies
  // useEffect(() => {
  //   // Initial fetch
  //   fetchVerificationCode();

  //   // Set up polling interval
  //   const interval = setInterval(() => {
  //     fetchVerificationCode();
  //   }, 3000);

  //   // Clean up on unmount or when isLoading changes
  //   return () => clearInterval(interval);
  // }, []); // Only depend on isLoading // Add dependencies to re-establish interval if these change

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const savedLock = localStorage.getItem("editLockedUntil");
    if (savedLock) {
      setEditLockedUntil(Number(savedLock));
    }
  }, []);

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
  setError(null);
  
  try {
    const mobileNumber = localStorage.getItem("mobileNumber");

    const res = await fetch(
      "https://api.leadscruise.com/api/whatsapp-settings/update-whatsapp-number",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, newWhatsappNumber }),
      }
    );
    
    const data = await res.json();
    
    if (res.ok) {
      alert("WhatsApp number linked successfully!");
      setWhatsappNumber(newWhatsappNumber);
      setIsEditingWhatsapp(false);
      // Set verification code to "111" to indicate successful linking
      setVerificationCode("111");
    } else {
      alert(data.error || "Failed to update WhatsApp number.");
      setError("Failed to update WhatsApp number");
    }
  } catch (error) {
    console.error("Update error:", error);
    alert("Server error during update.");
    setError("Failed to update WhatsApp number");
  } finally {
    setIsLoading(false);
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

  // useEffect(() => {
  //   if (editLockedUntil && Date.now() < editLockedUntil) {
  //     const timeout = setTimeout(() => {
  //       setEditLockedUntil(null);
  //       localStorage.removeItem("editLockedUntil");
  //     }, editLockedUntil - Date.now());

  //     return () => clearTimeout(timeout);
  //   }
  // }, [editLockedUntil]);

  useEffect(() => {
    // Find all auto-expanding textareas and set their height
    const textareas = document.querySelectorAll(".auto-expanding-input");
    textareas.forEach((textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  }, [messages]);

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
      {(windowWidth > 768 || sidebarOpen) && <Sidebar status={status} />}
      <DashboardHeader
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
              <button
                type="button"
                className="edit-button"
                style={{
                  backgroundColor: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "#ccc" : "",
                  cursor: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "not-allowed" : "pointer",
                  color: localStorage.getItem("userEmail") === "demo@leadscruise.com" ? "#666" : ""
                }}
                onClick={handleEditClick}
              >
                Edit
              </button>
            </div>
          </div>

          <ProfileCredentials
            isProfilePage={true}
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
            error={error}
          />
        </div>
      </div>
      {showPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '500px',
            maxHeight: '70vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>
              Edit Phone Numbers
            </h3>

            {/* Existing phone numbers */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#555', marginBottom: '10px' }}>
                Extracted Phone Numbers:
              </h4>
              {phoneNumbers.length > 0 ? (
                phoneNumbers.map((phone) => (
                  <div key={phone.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px'
                  }}>
                    <input
                      type="text"
                      value={phone.number}
                      onChange={(e) => handleEditNumber(phone.id, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        marginRight: '10px'
                      }}
                    />
                    <button
                      onClick={() => handleDeleteNumber(phone.id)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        width: 'fit-content',
                        marginBottom: '0'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>
                  No phone numbers found in messages
                </p>
              )}
            </div>

            {/* Add new phone number */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#555', marginBottom: '10px' }}>
                Add New Phone Number:
              </h4>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="Enter phone number"
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginRight: '10px'
                  }}
                />
                <button
                  onClick={handleAddNumber}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: 'fit-content',
                    marginBottom: '0'
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginBottom: '0'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginBottom: '0'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="support-info support-info-width">
        <h3 className="support-info__title">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="support-info__title-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Need Help?
        </h3>
        <div className="support-info__content">
          <p className="support-info__paragraph">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="support-info__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            If you encounter any issues, contact our support team at &nbsp;{" "}
            <a
              href="mailto:support@leadscruise.com"
              className="support-info__link"
            >
              support@leadscruise.com
            </a>
          </p>
          <p className="support-info__paragraph">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="support-info__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            For FAQs, visit our&nbsp;{" "}
            <a
              href="https://leadscruise.com"
              className="support-info__link support-info__link--with-icon"
            >
              Landing Page
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="support-info__external-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </p>
          <p className="support-info__paragraph">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="support-info__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="2.18"
                ry="2.18"
              ></rect>
              <line x1="10" y1="15" x2="10" y2="9"></line>
              <line x1="14" y1="15" x2="14" y2="9"></line>
              <line x1="7" y1="12" x2="17" y2="12"></line>
            </svg>
            Watch our&nbsp;{" "}
            <a
              href="https://www.youtube.com/watch?v=yQgrVTUYlvk"
              className="support-info__link support-info__link--with-icon"
            >
              Demo Video
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="support-info__external-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
    </>
  );
};

export default Whatsapp;
