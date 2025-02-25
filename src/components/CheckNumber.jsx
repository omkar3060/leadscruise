import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
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
              <div
                className="end-block"
                style={{
                  marginTop: "30px",
                  height: "30px",
                }}
              >
                <p className="gback" onClick={() => window.history.back()}>
                  Go Back
                </p>

                <p className="logout-link">
                  Wish to <span onClick={() => navigate("/")}>Logout</span>?
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Banner */}
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

export default CheckNumber;
