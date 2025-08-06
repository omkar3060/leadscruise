import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate, Link } from "react-router-dom";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import { Eye, EyeOff } from "lucide-react";
import "./styles.css";
import "./TaskExecutor.css";
import "./Plans.css";
import styles from "./Dashboard.module.css";

const TaskExecutor = () => {
  const [mobileNumber, setMobileNumber] = useState(localStorage.getItem("mobileNumber") || "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
  const [selected, setSelected] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpPopup, setShowOtpPopup] = useState(() => {
    return localStorage.getItem("showOtpPopup") === "true";
  });
  const [otpValue, setOtpValue] = useState('');
  const [otpRequestId, setOtpRequestId] = useState(null);
  const [otpType, setOtpType] = useState("login"); // Track OTP type
  const [showOtpWaitPopup, setShowOtpWaitPopup] = useState(() => {
    return localStorage.getItem("showOtpWaitPopup") === "true";
  });
  const [cancelled, setCancelled] = useState(() => {
    return localStorage.getItem("cancelled") === "true";
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleOtpSubmit = async () => {
    if (!otpValue || otpValue.length !== 4) {
      alert("Please enter a valid 4-digit OTP");
      return;
    }

    const otpTypeText = otpType === "password_change" ? "password change" : "login";
    const confirmSubmit = window.confirm(`Are you sure you want to submit OTP: ${otpValue} for ${otpTypeText}?`);
    if (!confirmSubmit) return;

    try {
      const userEmail = localStorage.getItem("userEmail");
      const uniqueId = localStorage.getItem("unique_id");

      await axios.post("https://api.leadscruise.com/api/submit-otp", {
        otp: otpValue,
        userEmail,
        uniqueId,
        requestId: otpRequestId
      });

      setShowOtpPopup(false);
      localStorage.setItem("showOtpPopup", "false");
      setOtpValue('');
      // setOtpRequestId(null);
      alert("OTP submitted successfully!");
      localStorage.setItem("cancelled", "true");
      setCancelled(true);
    } catch (error) {
      console.error("Error submitting OTP:", error);
      alert("Failed to submit OTP. Please try again.");
    }
  };

  useEffect(() => {
    const uniqueId = localStorage.getItem("unique_id");
    if (!uniqueId) return;

    const failureInterval = setInterval(async () => {
      const isCancelled = localStorage.getItem("cancelled") === "true";
      const isAlertShown = localStorage.getItem("otp_alert_shown") === "true";

      // console.log("Polling - isCancelled:", isCancelled, "isAlertShown:", isAlertShown);

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/check-otp-failure/${uniqueId}`);
        // console.log("API Response:", response.data);

        if (response.data.otpFailed) {
          // console.log("OTP Failed detected! About to show alert...");

          setCancelled(true);
          localStorage.setItem("cancelled", "true");
          localStorage.setItem("showOtpPopup", "true");
          localStorage.setItem("showOtpWaitPopup", "false");
          setShowOtpPopup(true);
          setShowOtpWaitPopup(false);

          if (!isAlertShown) {
            // console.log("Showing alert now...");
            const otpTypeText = otpType === "password_change" ? "password change" : "login";
            alert(`The ${otpTypeText} OTP you entered is incorrect. Please try again.`);
            localStorage.setItem("otp_alert_shown", "true");
          } else {
            // console.log("Alert already shown, skipping...");
          }
        }
      } catch (err) {
        console.error("API Error:", err);
      }
    }, 2000);

    return () => clearInterval(failureInterval);
  }, [showOtpPopup, otpRequestId]);

  useEffect(() => {
    const uniqueId = localStorage.getItem("unique_id");

    if (!uniqueId) return;

    const otpCheckInterval = setInterval(async () => {
      const cancelled = localStorage.getItem("cancelled") === "true"; // ✅ moved inside
      if (cancelled) return;

      try {
        const response = await axios.get(`https://api.leadscruise.com/api/check-otp-request/${uniqueId}`);
        if (response.data.otpRequired) {
          setOtpRequestId(response.data.requestId);
          setOtpType(response.data.type || "login");
          setShowOtpPopup(true);
          localStorage.setItem("showOtpPopup", "true");
          setShowOtpWaitPopup(false);
          localStorage.setItem("showOtpWaitPopup", "false");
        }
      } catch (error) {
        // Silently ignore
      }
    }, 2000);

    return () => clearInterval(otpCheckInterval);
  }, [status]);

  const handleTaskExecution = async () => {
    setCancelled(false);
    setShowOtpPopup(false);
    setOtpType("login"); // Reset to login type
    localStorage.setItem("cancelled", "false");
    localStorage.setItem("otp_alert_shown", "false");
    localStorage.setItem("showOtpPopup", "false");
    const email = localStorage.getItem("userEmail");
    const uniqueId = localStorage.getItem("unique_id");
    if (!mobileNumber || !email) {
      setMessage("All fields are required.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      // First check if the mobile number is already used by another user
      const checkResponse = await axios.post("https://api.leadscruise.com/api/check-mobile", {
        mobileNumber,
        email,
      });

      // If 409 status, someone else is using it
      if (checkResponse.status === 409) {
        setStatus("idle");
        alert("This mobile number is already used by another account.");
        return;
      }
    }
    catch (error) {
      if (error.response?.status === 409) {
        setStatus("idle");
        alert("This mobile number is already used by another account.");
        return;
      } else {
        setStatus("idle");
        alert("An error occurred while executing the task.");
        return;
      }
    }

    try {
      localStorage.setItem("savedpassword", password);

      const response = await axios.post(
        "https://api.leadscruise.com/api/execute-task",
        {
          mobileNumber,
          email,
          uniqueId,
        }
      );

      if (response.data.status === "success") {
        setStatus("success");
        setMessage("Task executed successfully! Details saved.");
      } else {
        setStatus("error");
        setMessage("Task execution failed.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred while executing the task.");
    }
  };

  const handleLogout = async () => {
    const isConfirmed = window.confirm("Are you sure you want to logout?");

    if (!isConfirmed) return; // Stop if user cancels

    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      sessionStorage.clear(); // Clear session storage as well
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://app.leadscruise.com/"
          : "http://localhost:3000";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const [tryAgainDisabled, setTryAgainDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (status === "error") {
      const cooldownStart = localStorage.getItem("tryAgainCooldownStart");
      if (!cooldownStart) {
        const now = Date.now();
        localStorage.setItem("tryAgainCooldownStart", now.toString());
      }

      // Check cooldown immediately when error occurs
      const checkCooldown = () => {
        const cooldownStartTime = localStorage.getItem("tryAgainCooldownStart");
        if (cooldownStartTime) {
          const elapsed = Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
          const remaining = 90 - elapsed;

          if (remaining > 0) {
            setTryAgainDisabled(true);
            setCooldownRemaining(remaining);

            const interval = setInterval(() => {
              const newRemaining = 90 - Math.floor((Date.now() - parseInt(cooldownStartTime)) / 1000);
              if (newRemaining <= 0) {
                setTryAgainDisabled(false);
                setCooldownRemaining(0);
                localStorage.removeItem("tryAgainCooldownStart");
                clearInterval(interval);
              } else {
                setCooldownRemaining(newRemaining);
              }
            }, 1000);

            return () => clearInterval(interval);
          } else {
            // Cooldown has expired
            setTryAgainDisabled(false);
            setCooldownRemaining(0);
            localStorage.removeItem("tryAgainCooldownStart");
          }
        }
      };

      checkCooldown();
    }
  }, [status]);

  return (
    <div className="signin-container">

      <div className="center-div">
        {/* Main Task Execution Screens */}
        <div className="signin-left">
          {status === "idle" && (
            <div className="task-input-screen">
              <h4 className="te-tis-h4">
                Connect Your LeadsProvider Account to LeadsCruise
              </h4>
              <div className="instr-wrapper">
                <div className="para">
                  <p className="te-tis-p">
                    Enter the login Number
                  </p>
                </div>
                <div className="red-divs">
                  <div className="red-cont">
                    Do Not Quit the screen from here Until you are promted to..
                  </div>
                  <div className="red-cont">
                    Once you click next this cant be Undone please input details
                    correctly !!
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="Mobile Number"
                value={mobileNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  setMobileNumber(value);
                  localStorage.setItem("mobileNumber", value); // always keep it synced
                }}
                className="input-field"
              />
              {/* <div className="password-container">
                <input
                  type={showPassword ? "text" : "password"} // Toggle type
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div> */}
              <p className="confirm">
                By Clicking next you confirm to connect to LeadsCruise
              </p>

              <button onClick={handleTaskExecution} className="execute-button">
                Next
              </button>

              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={handleLogout}>Logout</span>?
                </p>
              </div>

              {message && <p className="response-message">{message}</p>}
            </div>
          )}

          {status === "loading" && showOtpPopup && !cancelled && (
            <div className={styles['otp-popup-overlay']}>
              <div className={styles['otp-popup-container']}>
                <h3 className={styles['otp-popup-title']}>
                  {otpType === "password_change" ? "Enter Password Change OTP" : "Enter Login OTP"}
                </h3>
                <p className={styles['otp-popup-description']}>
                  {otpType === "password_change" 
                    ? "Please enter the 4-digit OTP sent to your mobile number for password change."
                    : "Please enter the 4-digit OTP sent to your mobile number for login."
                  }
                </p>
                <input
                  type="text"
                  value={otpValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setOtpValue(value);
                  }}
                  placeholder="Enter 4-digit OTP"
                  className={styles['otp-input']}
                  maxLength="4"
                  autoFocus
                />

                <div className={styles['otp-buttons']}>
                  <button
                    onClick={() => {
                      setShowOtpPopup(false);
                      localStorage.setItem("showOtpPopup", "false");
                      setShowOtpWaitPopup(false);
                      localStorage.setItem("showOtpWaitPopup", "false");
                      setOtpValue('');
                      setOtpRequestId(null);
                      setOtpType("login"); // Reset OTP type
                      setCancelled(true);
                      localStorage.setItem("cancelled", "true");
                    }}
                    className={`${styles['otp-button']} ${styles['otp-button-cancel']}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOtpSubmit}
                    disabled={otpValue.length !== 4}
                    className={`${styles['otp-button']} ${styles['otp-button-submit']}`}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="loading-screen">
              <img
                src={loadingGif}
                alt="Loading"
                className="loading-gif"
                style={{
                  width: "200px",
                  height: "200px",
                  marginTop: "40px",
                  marginBottom: "40px",
                }}
              />
              <p style={{ color: "black", fontWeight: "500", fontSize: "20px" }}>
                Please, wait while AI processes your task.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="success-screen">
              <div className="icon-cont" style={{ marginBottom: "10px" }}>
                <h2>Task Executed</h2>
                <div className="success-icon">
                  <img
                    src={successImage}
                    alt="Success"
                    style={{
                      width: "150px",
                      height: "125px",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  />
                </div>
                <p>Great! Your task was executed successfully.</p>
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="next-button"
              >
                Next
              </button>
              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={handleLogout}>Logout</span>?
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="error-screen">
              <h2>Task Execution Failed</h2>
              <div className="error-icon">
                <img
                  src={errorImage}
                  alt="Error"
                  style={{ width: "225px", height: "125px" }}
                />
              </div>
              <p
                style={{
                  marginTop: "10px",
                  fontSize: "14px",
                  marginBottom: "15px",
                }}
              >
                Oops, the task execution failed. Try again or contact support.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("tryAgainCooldownStart");
                  setStatus("idle");
                  // Don't manipulate cooldown state here - let the useEffect handle it
                }}
                disabled={tryAgainDisabled}
                className="try-again-button"
              >
                {tryAgainDisabled ? `Try Again in ${cooldownRemaining}s` : "Try Again"}
              </button>
              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={handleLogout}>Logout</span>?
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="signin-right">
          <div className="banner-container">
            {/* First Banner */}
            <div
              className={`banner overlapBanner ${selected === 0 ? "active" : ""
                }`}
            >
              <div className="rightbanner">
                <div
                  className="banner1_img"
                  style={{
                    backgroundImage: `url(${bgImage1})`,
                  }}
                ></div>
                <div className="banner1_heading">
                  Intergrate AI to your Business
                </div>
                <div className="banner1_content">
                  Let our AI do all the work even while you sleep. With
                  leadscruise all the software tasks are now automated with AI
                </div>
                <a className="banner1_href" href="https://leadscruise.com" rel="noopener noreferrer">
                  Learn more
                </a>
              </div>
            </div>

            {/* Second Banner */}
            <div
              className={`banner mfa_panel ${selected === 1 ? "active" : ""}`}
            >
              <div
                className="product_img"
                style={{
                  width: "300px",
                  height: "240px",
                  margin: "auto",
                  backgroundSize: "100%",
                  backgroundRepeat: "no-repeat",
                  backgroundImage: `url(${bgImage2})`,
                }}
              ></div>
              <div className="banner1_heading">A Rocket for your Business</div>
              <div className="banner2_content">
                Get to customers within the blink of opponent's eyes,
                LeadsCruise provides 100% uptime utilising FA cloud systems
              </div>
              <a className="banner1_href" href="https://leadscruise.com" rel="noopener noreferrer">
                Learn more
              </a>
            </div>

            <div
              className={`banner taskBanner ${selected === 2 ? "active" : ""}`}
            >
              <div className="rightbanner">
                <div
                  className="banner3_img"
                  style={{
                    backgroundImage: `url(${bgImage3})`,
                  }}
                ></div>
                <div className="banner1_heading">All tasks on time</div>
                <div className="banner1_content">
                  With leadscruise all the tasks are now automated so that you
                  no more need to do them manually
                </div>
                <a className="banner1_href" href="https://leadscruise.com" rel="noopener noreferrer">
                  Learn more
                </a>
              </div>
            </div>

            {/* Pagination Dots */}
            <div className="pagination-container">
              <div
                className={`pagination-dot ${selected === 0 ? "selected" : ""}`}
              >
                <div className="progress-fill"></div>
              </div>
              <div
                className={`pagination-dot ${selected === 1 ? "selected" : ""}`}
              >
                <div className="progress-fill"></div>
              </div>
              <div
                className={`pagination-dot ${selected === 2 ? "selected" : ""}`}
              >
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskExecutor;
