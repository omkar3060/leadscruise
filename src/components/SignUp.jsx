import React, { useState, useEffect } from "react";
import Dither from "./Dither.tsx"; // Add this line
import { useNavigate, Link } from "react-router-dom";
import logo from "../images/logo_front.png";
import axios from "axios";
import "./styles.css";
import "./PaginationSlider.css";
import "./Signin.css";
import "./SignUp.css";
import { Eye, EyeOff } from "lucide-react";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
//import loginBg from "../images/login-background.jpg";

// Add the typing animation component
const TypingAnimation = () => {
  const messages = [
    "working 24×7 !",
    "capturing leads automatically !",
    "sending messages on WhatsApp !"
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(50);

  useEffect(() => {
    const handleTyping = () => {
      const currentMessage = messages[currentMessageIndex];

      if (isDeleting) {
        setCurrentText(currentMessage.substring(0, currentText.length - 1));
        setTypingSpeed(25);
      } else {
        setCurrentText(currentMessage.substring(0, currentText.length + 1));
        setTypingSpeed(50);
      }

      if (!isDeleting && currentText === currentMessage) {
        setTimeout(() => setIsDeleting(true), 1000);
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentMessageIndex, typingSpeed, messages]);

  return (
    <div className="typing-container">
      <span className="static-text">Your LeadsCruise AI is </span>
      <span className="typing-text">
        {currentText}
        <span className="cursor">|</span>
      </span>
    </div>
  );
};

const SignUp = () => {
  const [refId, setRefId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfPassword, setShowConfPassword] = useState(false);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");

  const strongPasswordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (error) {
      setShowError(true);
      setIsLoading(false);
      return;
    }

    if (!mobileNumber) {
      alert("Please enter a valid Mobile Number.");
      setIsLoading(false);
      return;
    }

    if (!refId) {
      alert("Please enter a valid Referral ID.");
      setIsLoading(false);
      return;
    }

    if (refId) {
      try {
        await axios.get(`https://api.leadscruise.com/api/referrals/${refId}`);
      } catch (error) {
        setIsLoading(false);
        alert(error.response?.data?.message + " -- " + "Invalid Referral ID.");
        return;
      }
    }

    try {
      const res = await axios.post("https://api.leadscruise.com/api/signup", {
        refId,
        email,
        mobileNumber,
        password,
        confPassword,
      });
      setIsLoading(false);
      alert(res.data.message);
      navigate("/");
    } catch (error) {
      setIsLoading(false);
      alert(
        error.response.data.message || "Failed to sign up. Please try again."
      );
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

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

  return (
    <div className="login-page-container signup-form-compact" style={{ position: 'relative', overflow: 'hidden' }}>
  {/* Dither Background */}
  <div style={{ 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100%', 
    height: '100%', 
    zIndex: 0 
  }}>
    <Dither
      waveColor={[51/255, 102/255, 128/255]}
      disableAnimation={false}
      enableMouseInteraction={true}
      mouseRadius={0.3}
      colorNum={4}
      waveAmplitude={0.3}
      waveFrequency={3}
      waveSpeed={0.05}
      pixelSize={2}
    />
  </div>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-container">
            <div className="spinner">
              <div className="double-bounce1"></div>
              <div className="double-bounce2"></div>
            </div>
            <div className="loading-text">
              <h3>Creating Account</h3>
              <div className="loading-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
            <p className="loading-message">
              Please wait while we securely sign you up
            </p>
          </div>
        </div>
      )}

      <div className="login-form-wrapper">
        <div className="login-box">
          <div className="login-form-container">
            <h1 className="login-title">Sign Up</h1>

            <form onSubmit={handleSignUp}>
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="mobile">Mobile Number</label>
                <input
                  type="text"
                  id="mobile"
                  placeholder="Mobile Number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Password"
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={() => setShowError(true)}
                    onBlur={() => setShowError(false)}
                    required
                  />
                  <button
                    type="button"
                    className="show-password-button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {showError && error && (
                  <div className="password-error">
                    {error}
                  </div>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfPassword ? "text" : "password"}
                    id="confirmPassword"
                    placeholder="Confirm Password"
                    value={confPassword}
                    onChange={(e) => setConfPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="show-password-button"
                    onClick={() => setShowConfPassword(!showConfPassword)}
                  >
                    {showConfPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="refId">Referral ID</label>
                <input
                  type="text"
                  id="refId"
                  placeholder="Referral ID"
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  required
                />
              </div>

              <div className="terms-checkbox">
                <input
                  type="checkbox"
                  id="terms"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                />
                <label htmlFor="terms" className="terms-label">
                  I agree to{" "}
                  <a
                    href="/terms-and-conditions.pdf"
                    download="LeadsCruise-Terms-and-Conditions.pdf"
                    className="terms-link"
                  >
                    Terms & Conditions
                  </a>
                </label>
              </div>

              <button
                type="submit"
                className={`login-button ${!isChecked ? "dimmed" : ""}`}
                disabled={!isChecked}
              >
                Sign Up
              </button>
            </form>

            <p className="signup-prompt">
              Already have an account? {" "}
              <a
                //href="/login"
  onClick={(e) => { e.preventDefault(); navigate('/'); }}
  className="signup-now-link"
>
  Login Now!
</a>
            </p>
          </div>
        </div>
      </div>

      <div className="login-info-panel">
        <div className="info-box">
          <TypingAnimation />
          <button className="arrow-button" aria-label="More info">↑</button>
        </div>
        <button className="contact-support-button">Contact Support</button>
      </div>
    </div>
  );
};

export default SignUp;