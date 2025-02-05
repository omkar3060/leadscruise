
import React, { useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";

import axios from "axios";
import "./SignUp.css";
import "./styles.css";
import "./PaginationSlider.css";



const SignUp = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleSignUp = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/signup", {
        username,
        email,
        password,
      });
      alert(res.data.message);
      navigate("/"); // Redirect to SignIn page after successful signup
    } catch (error) {
      alert(error.response.data.message || "Failed to sign up. Please try again.");
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-left">
        <h2>Create Your Account</h2>
        <p>Sign up to enjoy all the features we provide for your experience.</p>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input className="password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleSignUp}>Sign Up</button>
        <div className="signup-link">
          Already have an account? <span onClick={() => navigate("/")}>Sign In</span>
        </div>
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
                  <a
                    className="banner1_href"
                    href="https://zoho.to/za_signin_oa_rp"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Learn more
                  </a>
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
              <a
                className="banner2_href"
                href="https://zoho.to/za_signin_oa_rp"
                target="_blank"
                rel="noreferrer"
              >
                Learn more
              </a>
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
  );
};

export default SignUp;