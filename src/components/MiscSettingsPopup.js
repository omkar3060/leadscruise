import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];
const MiscSettingsPopup = ({ 
  userEmail, 
  automationStatus, 
  isOpen, 
  onClose 
}) => {
  // Lead Types state
  const [leadTypes, setLeadTypes] = useState([]);
  const [tempLeadTypes, setTempLeadTypes] = useState([]);

  // States state
  const [selectedStates, setSelectedStates] = useState([]);
  const [tempStates, setTempStates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Min Order state
  const [minOrder, setMinOrder] = useState(0);
  const [tempMin, setTempMin] = useState(0);

  const isEditDisabled = automationStatus === "Running";

  // Fetch Lead Types
  const fetchLeadTypes = useCallback(async () => {
    try {
      const response = await axios.get(
        `https://api.leadscruise.com/api/get-lead-types?userEmail=${userEmail}`
      );

      if (response.data.leadTypes) {
        setLeadTypes(response.data.leadTypes);
        setTempLeadTypes(response.data.leadTypes);
      }
    } catch (error) {
      console.error("Failed to fetch lead types:", error);
    }
  }, [userEmail]);

  // Fetch States
  const fetchStates = useCallback(async () => {
    try {
      const response = await axios.get(
        `https://api.leadscruise.com/api/get-states?userEmail=${userEmail}`
      );
      
      if (response.data && response.data.states) {
        setSelectedStates(response.data.states);
        setTempStates(response.data.states);
      }
    } catch (error) {
      console.error("Failed to fetch selected states:", error);
    }
  }, [userEmail]);

  // Fetch Min Order
  const fetchMinOrder = useCallback(async () => {
    try {
      const response = await axios.get(
        `https://api.leadscruise.com/api/get-min-order?userEmail=${userEmail}`
      );

      if (response.data) {
        setMinOrder(response.data.minOrder || 0);
        setTempMin(response.data.minOrder || 0);
      }
    } catch (error) {
      console.error("Failed to fetch minimum order:", error);
    }
  }, [userEmail]);

  // Fetch all settings when popup opens
  useEffect(() => {
    if (userEmail && isOpen) {
      fetchLeadTypes();
      fetchStates();
      fetchMinOrder();
    }
  }, [userEmail, isOpen, fetchLeadTypes, fetchStates, fetchMinOrder]);

  // Save Lead Types
  const handleSaveLeadTypes = async () => {
    try {
      if (JSON.stringify(leadTypes.sort()) === JSON.stringify(tempLeadTypes.sort())) {
        return { success: true, unchanged: true };
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-lead-types", {
        userEmail,
        leadTypes: tempLeadTypes,
      });

      setLeadTypes(tempLeadTypes);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error("Error updating lead types:", error);
      return { 
        success: false, 
        message: "Failed to update lead types. Please try again." 
      };
    }
  };

  // Save States
  const handleSaveStates = async () => {
    try {
      if (JSON.stringify(selectedStates.sort()) === JSON.stringify(tempStates.sort())) {
        return { success: true, unchanged: true };
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-states", {
        userEmail,
        states: tempStates,
      });

      setSelectedStates(tempStates);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error("Error updating states:", error);
      return { 
        success: false, 
        message: "Failed to update states. Please try again." 
      };
    }
  };

  // Save Min Order
  const handleSaveMinOrder = async () => {
    try {
      if (tempMin === minOrder) {
        return { success: true, unchanged: true };
      }

      const response = await axios.post("https://api.leadscruise.com/api/update-min-order", {
        userEmail,
        minOrder: tempMin,
      });

      setMinOrder(tempMin);
      return { success: true, message: response.data.message };
    } catch (error) {
      if (error.response?.status === 403) {
        return { 
          success: false, 
          message: error.response.data.message 
        };
      }
      console.error("Failed to update minimum order:", error);
      return { 
        success: false, 
        message: error.response?.data?.message || "Error updating minimum order. Try again." 
      };
    }
  };

  // Save all settings
  const handleSaveAll = async () => {
    try {
      const results = {
        leadTypes: null,
        states: null,
        minOrder: null
      };

      // Save Lead Types
      results.leadTypes = await handleSaveLeadTypes();
      
      // Save States
      results.states = await handleSaveStates();
      
      // Save Min Order
      results.minOrder = await handleSaveMinOrder();

      // Check if any updates failed
      const failures = [];
      if (!results.leadTypes.success) failures.push("Lead Types");
      if (!results.states.success) failures.push("States");
      if (!results.minOrder.success) failures.push("Minimum Order");

      if (failures.length > 0) {
        alert(`Failed to update: ${failures.join(", ")}`);
        return;
      }

      // Check if anything was actually changed
      const anyChanges = 
        !results.leadTypes.unchanged || 
        !results.states.unchanged || 
        !results.minOrder.unchanged;

      if (!anyChanges) {
        alert("No changes were made to settings.");
        onClose();
        return;
      }

      alert("Settings updated successfully!");
      onClose();
    } catch (error) {
      console.error("Error updating settings:", error);
      alert("Failed to update settings. Please try again.");
    }
  };

  // Lead Types handlers
  const handleLeadTypeChange = (type, isChecked) => {
    if (isChecked) {
      setTempLeadTypes([...tempLeadTypes, type]);
    } else {
      setTempLeadTypes(tempLeadTypes.filter((t) => t !== type));
    }
  };

  // States handlers
  const handleStateChange = (state, isChecked) => {
    if (isChecked) {
      setTempStates(prev => [...prev, state]);
    } else {
      setTempStates(prev => prev.filter(s => s !== state));
    }
  };

  const handleAllIndiaChange = (isChecked) => {
    setTempStates(isChecked ? [...indianStates] : []);
  };

  // Cancel handler - reset all temp values
  const handleCancel = () => {
    setTempLeadTypes(leadTypes);
    setTempStates(selectedStates);
    setTempMin(minOrder);
    setSearchTerm("");
    onClose();
  };

  const filteredStates = indianStates.filter(state =>
    state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="misc-settings-overlay" onClick={handleCancel}>
      <div className="misc-settings-popup" onClick={(e) => e.stopPropagation()}>
        <div className="misc-popup-header">
          <h2>Miscellaneous Settings</h2>
          <button className="close-btn" onClick={handleCancel}>
            <FaTimes />
          </button>
        </div>

        <div className="misc-popup-content">
          
          {/* States Section */}
          <div className="settings-section">
            <h3 className="section-title">States</h3>
            <input
              type="text"
              placeholder="Search for a state..."
              className="dropdown-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="states-list">
              <label className="checkbox-label styled-checkbox">
                <input
                  type="checkbox"
                  checked={tempStates.length === indianStates.length}
                  onChange={(e) => handleAllIndiaChange(e.target.checked)}
                  disabled={isEditDisabled}
                />
                <span className="misc-checkmark" />
                <strong>ALL INDIA</strong>
              </label>
              {filteredStates.map(state => (
                <label key={state} className="checkbox-label styled-checkbox">
                  <input
                    type="checkbox"
                    checked={tempStates.includes(state)}
                    onChange={(e) => handleStateChange(state, e.target.checked)}
                    disabled={isEditDisabled}
                  />
                  <span className="misc-checkmark" />
                  {state}
                </label>
              ))}
            </div>
            <p className="selected-info">
              Selected: {
                tempStates.length === 0 ? "None" :
                tempStates.length === indianStates.length ? "ALL INDIA" :
                tempStates.length <= 3 ? tempStates.join(", ") :
                `${tempStates.length} states`
              }
            </p>
          </div>

          {/* Lead Types Section */}
          <div className="settings-section">
            <h3 className="section-title">Lead Types</h3>
            <div className="lead-types-checkboxes">
              {["bulk", "business", "gst"].map((type) => (
                <label 
                  key={type} 
                  className="checkbox-label styled-checkbox" 
                  title={`Enable ${type.toUpperCase()} leads`}
                >
                  <input
                    type="checkbox"
                    checked={tempLeadTypes.includes(type)}
                    onChange={(e) => handleLeadTypeChange(type, e.target.checked)}
                    disabled={isEditDisabled}
                  />
                  <span className="misc-checkmark" />
                  {type.toUpperCase()}
                </label>
              ))}
            </div>
            <p className="selected-info">
              Selected: {tempLeadTypes.length === 0 ? "None" : tempLeadTypes.join(", ").toUpperCase()}
            </p>
          </div>

          {/* Min Order Section */}
          <div className="settings-section">
            <h3 className="section-title">Minimum Order Value</h3>
            <div className="min-order-input-group">
              <label>VALUE (INR):</label>
              <input
                type="number"
                className="max-captures-input min-order"
                value={tempMin}
                onChange={(e) => setTempMin(Number(e.target.value))}
                min="1"
                disabled={isEditDisabled}
              />
            </div>
          </div>
        </div>

        <div className="popup-footer">
          <button 
            className="cancel-btn" 
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="save-all-btn"
            onClick={handleSaveAll}
            disabled={isEditDisabled}
            style={{
              backgroundColor: isEditDisabled ? "#ccc" : "",
              cursor: isEditDisabled ? "not-allowed" : "pointer",
            }}
          >
            Save All Changes
          </button>
        </div>

        {isEditDisabled && (
          <p className="warning-text">
            Cannot edit settings while automation is running
          </p>
        )}
      </div>
    </div>
  );
};

export default MiscSettingsPopup;
