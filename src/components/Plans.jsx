import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import "./Plans.css";
import "@fontsource/norwester"; // Defaults to weight 400
import "@fontsource/norwester/400.css"; // Specify weight

const Plans = () => {
  const [selected, setSelected] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handlePlanSelect = (plan, price) => {
    setSelectedPlan(plan);
    localStorage.setItem("selectedPrice", price); // Store price in local storage
  };

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          <div>Choose From Plans Below</div>
          <div className="plans">
            <div
              className={`one-mo common ${
                selectedPlan === "one-mo" ? "selected" : ""
              }`}
              onClick={() => handlePlanSelect("one-mo", 2999)}
            >
              <div className="part-1">
                <h2>One Month Subscription</h2>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 7999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 2999</h3>
                </div>
              </div>
            </div>
            <div
              className={`six-mo common ${
                selectedPlan === "six-mo" ? "selected" : ""
              }`}
              onClick={() => handlePlanSelect("six-mo", 14999)}
            >
              <div className="part-1">
                <h2>6 Months Subscription</h2>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 47999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 14999</h3>
                </div>
              </div>
            </div>
            <div
              className={`year-mo common ${
                selectedPlan === "year-mo" ? "selected" : ""
              }`}
              onClick={() => handlePlanSelect("year-mo", 29999)}
            >
              <div className="part-1">
                <h2>Yearly Subscription</h2>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 95999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 29999</h3>
                </div>
              </div>
            </div>
          </div>

          <button className="next-button">Next</button>
          <div className="end-block">
            <p className="gback" onClick={() => navigate("/check-number")}>
              Go Back
            </p>
            <p className="logout-link">
              Wish to <span onClick={() => navigate("/")}>Logout</span>?
            </p>
          </div>
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

export default Plans;
