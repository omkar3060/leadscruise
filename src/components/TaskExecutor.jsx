import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";

import "./styles.css";
import "./TaskExecutor.css";

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
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
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

      const response = await axios.post(
        "http://localhost:5000/api/execute-task",
        {
          mobileNumber,
          password,
          email,
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
                    Enter the login Number and Password
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
                className="input-field"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />

              <p className="confirm">
                By Clicking next you confirm to connect to LeadsCruise
              </p>

              <button onClick={handleTaskExecution} className="execute-button">
                Execute
              </button>

              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
                </p>
              </div>

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
              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
                </p>
              </div>
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
              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
                </p>
              </div>
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
              <div className="end-block">
                <p className="gback" onClick={() => window.location.reload()}>
                  Go Back
                </p>
                <p className="logout-link">
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="signin-right">
          <div className="banner-container">
            {/* First Banner */}
            <div
              className={`banner overlapBanner ${
                selected === 0 ? "active" : ""
              }`}
            >
              <div className="rightbanner">
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
                <a
                  className="banner1_href"
                  href="https://zoho.to/za_signin_oa_rp"
                  target="_blank"
                  rel="noreferrer"
                >
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
                  backgroundImage:
                    "url('https://static.zohocdn.com/iam/v2/components/images/MFA_illustration.1afa6dddd07d21ad33a652ec63d146d6.svg')",
                }}
              ></div>
              <div className="banner1_heading">Keep your account secure</div>
              <div className="banner2_content">
                Zoho OneAuth is our new in-house multi-factor authentication
                app. Shield your Zoho account with OneAuth now.
              </div>
              <a
                className="banner2_href"
                href="https://zoho.to/za_signin_oa_rp"
                target="_blank"
                rel="noreferrer"
              >
                Learn more
              </a>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskExecutor;
