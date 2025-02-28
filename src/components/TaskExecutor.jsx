import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";

import "./styles.css";
import "./TaskExecutor.css";
import "./Plans.css";

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
      localStorage.setItem("savedpassword", password);

      const response = await axios.post(
        "https://api.leadscruise.com/api/execute-task",
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
                  width: "200px",
                  height: "200px",
                  marginTop: "40px",
                  marginBottom: "40px",
                }}
              />
              <p
                style={{ color: "black", fontWeight: "500", fontSize: "20px" }}
              >
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
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
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
                  backgroundImage: `url(${bgImage2})`,
                }}
              ></div>
              <div className="banner1_heading">A Rocket for your Business</div>
              <div className="banner2_content">
                Get to customers within the blink of opponent's eyes,
                LeadsCruise provides 100% uptime utilising FA cloud systems
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
