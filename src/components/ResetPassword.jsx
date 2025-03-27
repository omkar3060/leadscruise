import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./Signin.css";
import logo from "../images/logo_front.png";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [showError, setShowError] = useState(false);
  const [selected, setSelected] = useState(0);

  const token = searchParams.get("token");
  var email = searchParams.get("email");

  email = decodeURIComponent(email);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
      setTimeout(() => navigate("/signin"), 3000);
    }
  }, [token, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 3);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    console.log({ token, newPassword, email });

    try {
      const response = await fetch("https://api.leadscruise.com/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setStatus("success");
      } else {
        setError(data.message || "Password reset failed");
        setStatus("error");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };
  const strongPasswordRegex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setNewPassword(newPassword);

    if (!strongPasswordRegex.test(newPassword)) {
      setShowError(true);
      setError(
        "Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character."
      );
    } else {
      setError("");
      setShowError(false);
    }
  };

  const handleLogout = async () => {
    const userEmail = localStorage.getItem("userEmail");
  
    try {
      await axios.post("https://api.leadscruise.com/api/logout", { email: userEmail });
  
      localStorage.clear();
      if (window.location.hostname === "app.leadscruise.com") {
        window.location.href = "https://leadscruise.com"; // Replace with actual landing page URL
      } else {
        window.location.href = "http://localhost:3000"; // Local development
      }
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
                  width: "150px",
                  height: "125px",
                  marginBottom: "20px",
                }}
              />
              <p>Please, wait....</p>
              <p className="logout-link">
                Wish to <span onClick={handleLogout}>Logout?</span>
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="success-screen">
              <div className="icon-cont">
                <h2>Password Changed</h2>
                <div className="success-icon">
                  <img
                    src={successImage}
                    alt="Success"
                    style={{ width: "175px", height: "125px" }}
                  />
                </div>
                <p>Great!! Password Succesfully Updated.</p>
              </div>
              <p
                className="instruction"
                style={{
                  color: "black",
                  fontWeight: "500",
                  fontSize: "17px",
                  textAlign: "center",
                }}
              >
                You can now signin with new password clicking next.
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
              <h2 className="signin-tag">Reset Your Password</h2>
              <p className="signin-descriptor">to access Leads Cruise Home</p>
              <input
                type="email"
                placeholder="Enter Your Email Address"
                value={email}
                name="email"
                autoComplete="email"
                readOnly
              />

              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={handlePasswordChange}
                name="password"
                autoComplete="current-password"
                
              onFocus={() => setShowError(true)}
              onBlur={() => setShowError(false)}
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                name="confirmpassword"
                autoComplete="current-password"
              />

              <button onClick={handleResetPassword}>Next</button>
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

export default ResetPassword;
