import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./Signin.css";

import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import hmimg from "../images/home-img-new.png";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

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
      setSelected((prev) => (prev + 1) % 2);
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
      const response = await fetch("http://localhost:5000/api/reset-password", {
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
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        setError(data.message || "Password reset failed");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          <div className="signin-logo-class">
            <img
              src="https://www.zoho.com/sites/zweb/images/zoho_general_pages/zoho-logo-512.png"
              alt="zohologo"
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
            onChange={(e) => setNewPassword(e.target.value)}
            name="password"
            autoComplete="current-password"
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
