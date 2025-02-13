import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./PaginationSlider.css";
import "./Signin.css";
import { auth, provider, signInWithPopup } from "./firebase";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/dashboard");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      alert("Google sign-in failed!");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/login", {
        email,
        password,
      });

      alert(res.data.message);
      localStorage.setItem("userEmail", email);

      // Check if a payment exists for the user
      const paymentRes = await axios.get(`http://localhost:5000/api/payments?email=${email}`);

      if (paymentRes.status === 200 && paymentRes.data.length > 0) {
        // If payment exists but mobileNumber and savedPassword are missing, redirect to execute-task
        if (!res.data.user.mobileNumber || !res.data.user.savedPassword) {
          localStorage.setItem("mobileNumber", paymentRes.data[0].contact);
          navigate("/execute-task");
          return;
        }
      } 

      // If mobileNumber and savedPassword exist, proceed to dashboard
      if (res.data.user.mobileNumber && res.data.user.savedPassword) {
        localStorage.setItem("mobileNumber", res.data.user.mobileNumber);
        localStorage.setItem("password", res.data.user.savedPassword);
        navigate("/dashboard");
      }else {
        navigate("/check-number");
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to sign in. Please try again.");
      navigate("/signup");
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
            <div className="smart-scan">
              {/* <img
                src="https://previews.123rf.com/images/fokaspokas/fokaspokas1809/fokaspokas180900207/108562561-scanning-qr-code-technology-icon-white-icon-with-shadow-on-transparent-background.jpg"
                alt=""
                className="scan-icon"
              /> */}
              <span>Try smart sign-in</span>
            </div>
          </div>
          <h2 className="signin-tag">Sign in</h2>
          <p className="signin-descriptor">to access Zoho Home</p>
          <input
            type="email"
            placeholder="Email address or mobile number"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Enter Your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button onClick={handleSignIn}>Next</button>

          <div className="alt-signins">
            <p>Sign in using</p>
            <div className="alt-btns" onClick={handleGoogleSignIn}>
              <p className="goo">Google</p>
              <div className="google sp-btns">
                <img
                  src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
                  alt=""
                />
              </div>
            </div>
          </div>
          <p className="signup-link">
            Don't have a Zoho account?
            <span onClick={() => navigate("/signup")}>Sign up now</span>
          </p>
        </div>

        <div className="signin-right">
          <div className="banner-container">
            {/* First Banner */}
            <div
              className={`banner overlapBanner ${selected === 0 ? "active" : ""
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

export default SignIn;
