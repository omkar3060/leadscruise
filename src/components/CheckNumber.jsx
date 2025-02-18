import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import "./styles.css";

import "./CheckNumber.css";

const CheckNumber = () => {
  const [mobileNumber, setMobileNumber] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleCheckNumber = async () => {
    setStatus("loading");
    try {
      localStorage.setItem("mobileNumber", mobileNumber);
      const response = await axios.post(
        "http://localhost:5000/api/check-number",
        { mobileNumber }
      );
      if (response.data.exists) {
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch (error) {
      setMessage("Error occurred while checking the number.");
      setStatus("idle");
    }
  };

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          {/* Loading Screen */}
          {status === "loading" && (
            <div className="loading-screen">
              <img
                src={loadingGif}
                alt="Loading"
                className="loading-gif"
                style={{
                  width: "150px",
                  height: "125px",
                  marginBottom: "20px",
                }}
              />
              <p>Please, wait while AI searches for you.</p>
              <p className="logout-link">
                Wish to <span onClick={() => navigate("/")}>Logout?</span>
              </p>
            </div>
          )}

          {/* Success Screen */}
          {status === "success" && (
            <div className="success-screen">
              <div className="icon-cont">
                <div className="success-icon">
                  <img
                    src={successImage}
                    alt="Success"
                    style={{ width: "175px", height: "125px" }}
                  />
                </div>
                <p>Great! You are now eligible to subscribe to Leads Cruise.</p>
              </div>
              <p className="phone-number">
                Wish to proceed and connect with {mobileNumber}?
              </p>
              <button
                className="next-button"
                onClick={() => navigate("/plans")}
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

          {/* Error Screen */}
          {status === "error" && (
            <div className="error-screen">
              <h2>Check Status</h2>
              <div className="error-icon">
                <img
                  src={errorImage}
                  alt="Error"
                  style={{ width: "225px", height: "125px" }}
                />
              </div>
              <p>
                Oops, you have already subscribed from this number. Contact
                Support for more details.
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

          {/* Input Screen */}
          {status === "idle" && (
            <div className="check-number-input-screen">
              <h2>Check if your number is subscribed with us earlier</h2>
              <p>
                Enter your Leads Provider login number below and click next to
                check if you have already subscribed to us.
              </p>
              <input
                type="text"
                placeholder="Enter Your Mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="mobile-number-input"
              />
              <button onClick={handleCheckNumber} className="next-button">
                Next
              </button>
              {message && <p className="response-message">{message}</p>}
              <p className="logout-link">
                Wish to <span>Logout</span>?
              </p>
            </div>
          )}
        </div>

        {/* Right Side Banner */}
        <div className="signin-right">
          <div className="banner-container">
            {/* First Banner */}
            <div className={`banner overlapBanner ${selected === 0 ? "active" : ""}`}>
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
            <div className={`banner mfa_panel ${selected === 1 ? "active" : ""}`}>
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
              <div className={`pagination-dot ${selected === 0 ? "selected" : ""}`}>
                <div className="progress-fill"></div>
              </div>
              <div className={`pagination-dot ${selected === 1 ? "selected" : ""}`}>
                <div className="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckNumber;
