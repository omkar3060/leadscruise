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

  const [newSentence, setNewSentence] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newH2Keyword, setNewH2Keyword] = useState("");
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
        const response = await axios.get(`http://localhost:5000/api/get-settings/${userEmail}`);
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

  const addItem = (type, valueSetter, value) => {
    if (value.trim()) {
      setSettings((prev) => ({
        ...prev,
        [type]: [...prev[type], value.trim()],
      }));
      valueSetter("");
    }
  };

  const deleteItem = (type, index) => {
    setSettings((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const userEmail = localStorage.getItem("userEmail"); // Ensure userEmail is stored in localStorage
    if (!userEmail) {
      alert("User email not found!");
      return;
    }
  
    try {
      await axios.post("http://localhost:5000/api/save-settings", {
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
        await axios.delete(`http://localhost:5000/api/delete-settings/${userEmail}`);
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
              <button className="start-button" onClick={handleSubmit}>Save All</button>
              <button className="stop-button" onClick={handleRevert}>Revert All</button>
            </div>
          </div>
          <div className="profile-section">
            <button className="profile-button">Profile</button>
            <div>
              <p className="renewal-text">Subscription Status: ACTIVE</p>
              <p className="renewal-text">Subscription next renewal date: 11/01/2025</p>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Settings Container */}
      <div className="settings-scroll-container">
        <form onSubmit={handleSubmit} className="settings-form">
          {/* Sentences Section */}
          <div className="table-container">
            <h2>Messages to send as replies</h2>
            <table className="keyword-table">
              <thead>
                <tr>
                  <th>Sentence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.sentences.length > 0 ? (
                  settings.sentences.map((sentence, index) => (
                    <tr key={index}>
                      <td>{sentence}</td>
                      <td>
                        <button className="delete-button" onClick={() => deleteItem("sentences", index)}>Delete</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2">No sentences added.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="add-keyword-container">
              <input type="text" value={newSentence} onChange={(e) => setNewSentence(e.target.value)} placeholder="Enter a sentence" />
              <button type="button" className="add-button" onClick={() => addItem("sentences", setNewSentence, newSentence)}>Add Sentence</button>
            </div>
          </div>

          {/* Word Array Section */}
          <div className="table-container">
            <h2>Accepted Categories</h2>
            <table className="keyword-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.wordArray.map((word, index) => (
                  <tr key={index}>
                    <td>{word}</td>
                    <td>
                      <button className="delete-button" onClick={() => deleteItem("wordArray", index)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="add-keyword-container">
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Enter keyword" />
              <button type="button" className="add-button" onClick={() => addItem("wordArray", setNewKeyword, newKeyword)}>Add Keyword</button>
            </div>
          </div>

          {/* H2 Word Array Section */}
          <div className="table-container">
            <h2>Leads to be rejected</h2>
            <table className="keyword-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.h2WordArray.map((word, index) => (
                  <tr key={index}>
                    <td>{word}</td>
                    <td>
                      <button className="delete-button" onClick={() => deleteItem("h2WordArray", index)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="add-keyword-container">
              <input type="text" value={newH2Keyword} onChange={(e) => setNewH2Keyword(e.target.value)} placeholder="Enter H2 keyword" />
              <button type="button" className="add-button" onClick={() => addItem("h2WordArray", setNewH2Keyword, newH2Keyword)}>Add Keyword</button>
            </div>
          </div>

          {/* Profile Section */}
          <ProfileCredentials />
        </form>
      </div>
    </div>
  );
};

export default SettingsForm;
