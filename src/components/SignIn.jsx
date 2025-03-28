import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./PaginationSlider.css";
import "./Signin.css";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import logo from "../images/logo_front.png";
import { FaUserPlus } from "react-icons/fa";
import { Eye, EyeOff } from "lucide-react";
import {
  auth,
  provider,
  signInWithPopup,
  githubProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  GithubAuthProvider,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
} from "./firebase";

import { getAuth } from "firebase/auth";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef(null);
  const timeoutRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("savedCredentials");
    if (saved) {
      setSavedCredentials(JSON.parse(saved));
    }
  }, []);

  // Load last used credentials if they exist
  useEffect(() => {
    const lastUsed = localStorage.getItem("lastUsedCredentials");
    if (lastUsed) {
      const { email: savedEmail, password: savedPassword } =
        JSON.parse(lastUsed);
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const saveCredentials = (email, password) => {
    const credentials = {
      email,
      password,
      timestamp: new Date().toISOString(),
    };

    // Get existing credentials
    const existing = JSON.parse(
      localStorage.getItem("savedCredentials") || "[]"
    );

    // Check if email already exists
    const emailExists = existing.findIndex((cred) => cred.email === email);

    if (emailExists >= 0) {
      // Update existing entry
      existing[emailExists] = credentials;
    } else {
      // Add new entry
      existing.push(credentials);
    }

    // Keep only the last 5 entries
    const latest = existing
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    localStorage.setItem("savedCredentials", JSON.stringify(latest));
    localStorage.setItem("lastUsedCredentials", JSON.stringify(credentials));
    setSavedCredentials(latest);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const email = user.email;
      const emailVerified = result.user.emailVerified;
      const password = "NULL";
      console.log("Google Sign-In User:", user);
      console.log("Google Sign-In Email:", email);

      // Send request to backend for login/signup processing
      const res = await axios.post("https://api.leadscruise.com/api/login", { email, password, emailVerified });

      // Store user info and token
      localStorage.setItem("userEmail", email);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);

      // Check if a payment exists for the user
      const paymentRes = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);

      if (paymentRes.status === 200 && paymentRes.data.length > 0) {
        if (!res.data.user.mobileNumber || !res.data.user.savedPassword) {
          localStorage.setItem("mobileNumber", paymentRes.data[0].contact);
          navigate("/execute-task");
          return;
        }
      }

      // If mobileNumber and savedPassword exist, proceed to dashboard
      if (res.data.user.mobileNumber && res.data.user.savedPassword) {
        localStorage.setItem("mobileNumber", res.data.user.mobileNumber);
        localStorage.setItem("savedPassword", res.data.user.savedPassword);
        navigate("/dashboard");
      } else {
        navigate("/check-number");
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Google Sign-In Error:", error);


      // Handling 'auth/account-exists-with-different-credential' error for Google
      if (error.code === "auth/account-exists-with-different-credential") {
        const email = error.customData?.email;
        console.log("Conflicting email:", email);

        const shouldTryGitHub = window.confirm(
          `An account with ${email} already exists with GitHub. Would you like to sign in with GitHub and connect your Google account?`
        );

        if (shouldTryGitHub) {
          try {
            setIsLoading(true);
            // Step 1: Sign in with GitHub
            const githubResult = await signInWithPopup(auth, githubProvider);

            // Step 2: Retrieve pending Google credentials
            const pendingGoogleCred = GoogleAuthProvider.credentialFromError(error);

            if (pendingGoogleCred) {
              // Step 3: Link Google with GitHub account
              await linkWithCredential(githubResult.user, pendingGoogleCred);
              alert("Successfully connected your Google account! You can now use either method to sign in.");
            }

            localStorage.setItem("user", JSON.stringify(githubResult.user));
            navigate("/dashboard");
          } catch (githubError) {
            console.error("GitHub sign-in error:", githubError);
            setIsLoading(false);
            alert("Error signing in with GitHub: " + githubError.message);
          }
        }
      } else {
        alert(error.response?.data?.message || "Google sign-in failed. Please try again.");
      }
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;
      const email = user.email;
      const emailVerified = result.user.emailVerified;
      const password = "NULL";
      console.log("GitHub Sign-In User:", user);
      console.log("GitHub Sign-In Email:", email);

      // Send request to backend for login/signup processing
      const res = await axios.post("https://api.leadscruise.com/api/login", { email, password, emailVerified });

      // Store user info and token
      localStorage.setItem("userEmail", email);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);

      // Check if a payment exists for the user
      const paymentRes = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);

      if (paymentRes.status === 200 && paymentRes.data.length > 0) {
        if (!res.data.user.mobileNumber || !res.data.user.savedPassword) {
          localStorage.setItem("mobileNumber", paymentRes.data[0].contact);
          navigate("/execute-task");
          return;
        }
      }

      // If mobileNumber and savedPassword exist, proceed to dashboard
      if (res.data.user.mobileNumber && res.data.user.savedPassword) {
        localStorage.setItem("mobileNumber", res.data.user.mobileNumber);
        localStorage.setItem("savedPassword", res.data.user.savedPassword);
        navigate("/dashboard");
      } else {
        navigate("/check-number");
      }
    } catch (error) {
      console.error("GitHub Sign-In Error:", error);
      setIsLoading(false);

      // Handling 'auth/account-exists-with-different-credential' error
      if (error.code === "auth/account-exists-with-different-credential") {
        const email = error.customData?.email;
        console.log("Conflicting email:", email);

        const shouldTryGoogle = window.confirm(
          `An account with ${email} already exists with Google. Would you like to sign in with Google and connect your GitHub account?`
        );

        if (shouldTryGoogle) {
          try {
            setIsLoading(true);
            // Step 1: Sign in with Google
            const googleResult = await signInWithPopup(auth, provider);

            // Step 2: Retrieve pending GitHub credentials
            const pendingGithubCred = GithubAuthProvider.credentialFromError(error);

            if (pendingGithubCred) {
              // Step 3: Link GitHub with Google account
              await linkWithCredential(googleResult.user, pendingGithubCred);
              alert("Successfully connected your GitHub account! You can now use either method to sign in.");
            }

            localStorage.setItem("user", JSON.stringify(googleResult.user));
            navigate("/dashboard");
          } catch (googleError) {
            console.error("Google sign-in error:", googleError);
            setIsLoading(false);
            alert("Error signing in with Google: " + googleError.message);
          }
        }
      } else {
        alert(error.response?.data?.message || "GitHub sign-in failed. Please try again.");
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 3);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      const res = await axios.post("https://api.leadscruise.com/api/login", {
        email,
        password,
      });
      if (rememberMe) {
        saveCredentials(email, password);
      } else {
        // Clear last used credentials if remember me is not checked
        localStorage.removeItem("lastUsedCredentials");
      }
      // alert(res.data.message);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("password", password);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);
      // Check if a payment exists for the user
      const paymentRes = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);
      if (email === "support@leadscruise.com" && password === "Focus@123") {
        navigate("/master");
        return;
      }
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
        localStorage.setItem("savedPassword", res.data.user.savedPassword);
        navigate("/dashboard");
      } else {
        navigate("/check-number");
      }
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.status === 400) {
        if (
          error.response.data.message === "User not found. Please Signup!!!"
        ) {
          alert("Email not registered. Please sign up!");
        } else {
          alert(error.response.data.message || "Invalid credentials!");
        }
      } else {
        alert("Failed to sign in. Please try again.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("https://api.leadscruise.com/api/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!data.exists) {
        setIsLoading(false);
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
      setIsLoading(false);
      if (resetData.success) {
        alert("Password reset email sent! Check your inbox.");
      } else {
        alert("Failed to send reset email. Please try again.");
      }
    } catch (error) {
      setIsLoading(false);
      alert("Error sending reset email: " + error.message);
    }
  };

  const handleCredentialSelect = (credential) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setEmail(credential.email);
    setPassword(credential.password);
    setShowSuggestions(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="signin-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-container">
            <div className="spinner">
              <div className="double-bounce1"></div>
              <div className="double-bounce2"></div>
            </div>
            <div className="loading-text">
              <h3>Authenticating</h3>
              <div className="loading-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
            <p className="loading-message">Please wait while we securely log you in</p>
          </div>
        </div>
      )}

      <div className="center-div">
        <div className="signin-left">
          <div className="signin-logo-class">
            <img
              src={logo} // Use the imported image
              alt="LeadsCruise Logo"
              onClick={() => navigate("/")} // Navigate to home when clicked
            // Add styling if needed
            />
            <div className="smart-scan" onClick={() => navigate("/signup")}>
              <FaUserPlus className="scan-icon" />
              <span>Sign Up</span>
            </div>
          </div>
          <h2 className="signin-tag">Sign in</h2>
          <p className="signin-descriptor">to access Leads Cruise Home</p>
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter Your Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Use setTimeout to allow suggestion clicks to register
                timeoutRef.current = setTimeout(() => {
                  setShowSuggestions(false);
                }, 200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setShowSuggestions(false);
                  passwordInputRef.current?.focus();
                }
              }}
              name="email"
              autoComplete="email"
            />

            {showSuggestions && savedCredentials.length > 0 && (
              <div className="suggestions-dropdown">
                {savedCredentials.map((cred, index) => (
                  <div
                    key={index}
                    className="suggestion-item"
                    onClick={() => handleCredentialSelect(cred)}
                  >
                    <span className="suggestion-icon">👤</span>
                    <span>{cred.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              ref={passwordInputRef}
              placeholder="Enter Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSignIn(); // Trigger sign-in when Enter is pressed
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="fp-cont">
            <div className="cb-cont">
              <input
                type="checkbox"
                className="cb"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember Me
            </div>
            <div className="fp" onClick={() => navigate("/enter-email")}>
              Forgot Password?
            </div>
          </div>

          <button onClick={handleSignIn}>Next</button>

          <div className="or-cont">
            <div className="hr"></div>
            <p>or</p>
            <div className="hr"></div>
          </div>

          <div className="alt-signins">
            {/* <p>Sign in using</p> */}
            <div className="alt-btns" onClick={handleGoogleSignIn}>
              <p className="goo">Google</p>
              <div className="google sp-btns">
                <img
                  src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
                  alt=""
                />
              </div>
            </div>

            <div className="alt-btns" onClick={handleGitHubSignIn}>
              <p className="goo">GitHub</p>
              <div className="google sp-btns">
                <img
                  src="https://e7.pngegg.com/pngimages/678/920/png-clipart-github-computer-icons-gitlab-github-cdr-white.png"
                  alt=""
                />
              </div>
            </div>
          </div>

          <div className="pri-cont">
            <p className="priv-p">
              By creating this account, you agree to our{" "}
              <span>Privacy Policy</span> & <span>Cookie Policy</span>.
            </p>
          </div>
          {/* <p className="signup-link">
            Don't have a Zoho account?
            <span onClick={() => navigate("/signup")}>Sign up now</span>
          </p> */}
          <div className="end-block">
            <p className="gback" onClick={() => (window.location.href = "https://leadscruise.com")}>
              Go Back
            </p>
          </div>
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
                <Link className="banner1_href" to="/notfound">
                  Learn more
                </Link>
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
              <Link className="banner1_href" to="/notfound">
                Learn more
              </Link>
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
                <Link className="banner1_href" to="/notfound">
                  Learn more
                </Link>
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

export default SignIn;