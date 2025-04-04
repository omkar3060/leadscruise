import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./Signin.css";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import logo from "../images/logo_front.png";

const EnterEmail = () => {
  const [status, setStatus] = useState("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 3);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(
        "https://api.leadscruise.com/api/check-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      if (!data.exists) {
        alert("Email is not registered.");
        return;
      }

      const resetResponse = await fetch(
        "https://api.leadscruise.com/api/send-reset-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const resetData = await resetResponse.json();
      if (resetData.success) {
        setStatus("success");
      } else {
        alert("Failed to send reset email. Please try again.");
      }
    } catch (error) {
      alert("Error sending reset email: " + error.message);
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
      window.location.href =
        window.location.hostname === "app.leadscruise.com"
          ? "https://app.leadscruise.com/"
          : "http://localhost:3000";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
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
                Please, wait while we send you a Mail.
              </p>
            </div>
          )}
          {status === "success" && (
            <div className="success-screen">
              <div className="icon-cont">
                <h2>Email Sent</h2>
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
                <p>An email has been sent to your provided email id.</p>
              </div>
              <p
                className="instruction"
                style={{
                  color: "black",
                  fontWeight: "500",
                  fontSize: "18px",
                  textAlign: "center",
                }}
              >
                Use the link to reset the password.
              </p>
              <button className="next-button" onClick={() => navigate("/")}>
                Sign In
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
              <h2>Check Status</h2>
              <div className="error-icon">
                <img
                  src={errorImage}
                  alt="Error"
                  style={{ width: "225px", height: "125px" }}
                />
              </div>
              <p>
                Oops! There was a Problem Updating Your Password, Try Again to
                Update Your Password.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="try-again-button"
              >
                Try Again
              </button>
              <p className="logout-link">
                Wish to <span onClick={handleLogout}>Logout?</span>
              </p>
            </div>
          )}

          {status === "idle" && (
            <div>
              <div className="signin-logo-class">
                <img
                  src={logo} // Use the imported image
                  alt="LeadsCruise Logo"
                  onClick={() => navigate("/")} // Navigate to home when clicked
                  // Add styling if needed
                />
                <div className="smart-scan" onClick={() => navigate("/")}>
                  {/* <img
                src="https://previews.123rf.com/images/fokaspokas/fokaspokas1809/fokaspokas180900207/108562561-scanning-qr-code-technology-icon-white-icon-with-shadow-on-transparent-background.jpg"
                alt=""
                className="scan-icon"
              /> */}
                  <img
                    src="https://icons.veryicon.com/png/o/miscellaneous/esgcc-basic-icon-library/1-login.png"
                    alt=""
                  />
                  <span>Sign In</span>
                </div>
              </div>
              <h2 className="signin-tag">Enter your Email id</h2>
              <p
                style={{
                  color: "black",
                  fontSize: "18px",
                  fontWeight: "500",
                  marginTop: "40px",
                  marginBottom: "40px",
                }}
              >
                If you have forgotten email id then feel free to contact our
                Support Team.
              </p>
              <input
                type="email"
                placeholder="Enter Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                name="email"
                autoComplete="email"
              />

              <button onClick={handleForgotPassword}>Next</button>

              <div
                className="end-block"
                style={{
                  marginTop: "40px",
                }}
              >
                <p className="gback" onClick={() => window.history.back()}>
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

export default EnterEmail;
