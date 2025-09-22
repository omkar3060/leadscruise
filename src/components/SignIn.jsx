import React, { useState, useEffect, useRef } from "react";
import { useNavigate} from "react-router-dom";
import axios from "axios";
import "./styles.css";
import "./PaginationSlider.css";
import "./Signin.css";
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";
import logo from "../images/logo_front.png";
import loginBg from "../images/login-background.jpg";
import { FaGoogle, FaFacebookF, FaUserPlus } from "react-icons/fa";
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

// Custom hook for dynamic separator
const useDynamicSeparator = () => {
  useEffect(() => {
    const updateSeparatorHeight = () => {
      const loginBox = document.querySelector('.login-box');
      
      // Only apply on larger screens where separator is visible
      if (loginBox && window.innerWidth > 1200) {
        const boxHeight = loginBox.offsetHeight;
        
        // Set CSS custom property for separator height
        document.documentElement.style.setProperty('--separator-height', boxHeight + 'px');
      } else {
        // Reset the custom property on smaller screens
        document.documentElement.style.removeProperty('--separator-height');
      }
    };
    
    // Update on mount
    updateSeparatorHeight();
    
    // Update on window resize
    const handleResize = () => {
      updateSeparatorHeight();
    };
    
    // Update when login box content changes
    const handleMutation = () => {
      setTimeout(updateSeparatorHeight, 100); // Small delay to ensure DOM is updated
    };
    
    // Set up event listeners
    window.addEventListener('resize', handleResize);
    
    // Use MutationObserver to detect changes in login box content
    const observer = new MutationObserver(handleMutation);
    const loginBox = document.querySelector('.login-box');
    
    if (loginBox) {
      observer.observe(loginBox, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);
};

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
        setTimeout(() => setIsDeleting(true), 1000); // Pause before deleting
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

  // Add the dynamic separator hook
  useDynamicSeparator();

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
    let email = "";
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      email = user.email;
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
      localStorage.setItem("sessionId", res.data.sessionId);
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
      } else if (error.response.status === 403 && error.response.data.activeSession) {
        // Handle active session error
        const confirmLogout = window.confirm("You're already logged in on another device. Would you like to log out from all other devices and continue?");

        if (confirmLogout) {
          try {
            // Request to force logout from other devices
            console.log("email", email);
            await axios.post("https://api.leadscruise.com/api/force-logout", { email });

            // Retry Google login
            handleGoogleSignIn();
          } catch (logoutError) {
            alert("Failed to log out from other devices. Please try again.");
          }
        }
      }

      else {
        alert(error.response?.data?.message || "Google sign-in failed. Please try again.");
      }
    }
  };

  const handleGitHubSignIn = async () => {
    let email = "";
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;
      email = user.email;
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
      } else if (error.response.status === 403 && error.response.data.activeSession) {
        // Handle active session error
        const confirmLogout = window.confirm("You're already logged in on another device. Would you like to log out from all other devices and continue?");

        if (confirmLogout) {
          try {
            // Request to force logout from other devices
            console.log("email", email);
            await axios.post("https://api.leadscruise.com/api/force-logout", { email });

            // Retry Google login
            handleGoogleSignIn();
          } catch (logoutError) {
            alert("Failed to log out from other devices. Please try again.");
          }
        }
      }
      else {
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

  const handleSignIn = async (e) => {
    e.preventDefault();
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

      localStorage.setItem("userEmail", email);
      localStorage.setItem("password", password);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("sessionId", res.data.sessionId);
      localStorage.setItem("role", res.data.user.role);
      
      // Clear the login alert flag when user successfully logs in
      sessionStorage.removeItem("loginAlertShown");

      if (email === "demo@leadscruise.com" && (password === "Demo@5477" || password === "6daa726eda58b3c3c061c3ef0024ffaa")) {
        // Check if a payment exists for the demo user
        try {
          const paymentRes = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);
          if (paymentRes.status === 200 && Array.isArray(paymentRes.data) && paymentRes.data.length > 0) {
            localStorage.setItem("mobileNumber", paymentRes.data[0].contact);
            localStorage.setItem("unique_id", paymentRes.data[0].unique_id);
          }
        } catch (paymentError) {
          console.warn("Demo user payment API error:", paymentError.message);
        }
        navigate("/dashboard");
        return;
      }

      if (email === "support@leadscruise.com" && (password === "Focus@8073" || password === "6daa726eda58b3c3c061c3ef0024ffaa")) {
        navigate("/master");
        return;
      }

      if (res.data.user.mobileNumber && res.data.user.savedPassword) {
        localStorage.setItem("mobileNumber", res.data.user.mobileNumber);
        localStorage.setItem("savedPassword", res.data.user.savedPassword);
        navigate("/dashboard");
        return;
      } else {
        console.warn("User does not have mobileNumber, checking payments");
      }

      // Check if a payment exists for the user (only if they don't have mobileNumber)
          try {
          console.warn("Calling payment API for email:", email);
          const paymentRes = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);
          console.warn("Payment API response status:", paymentRes.status);
          console.warn("Payment API response data:", paymentRes.data);
          console.warn("Payment data length:", paymentRes.data.length);

          // If user doesn't have mobileNumber, check if they have payments
          if (paymentRes.status === 200 && Array.isArray(paymentRes.data) && paymentRes.data.length > 0) {
            console.warn("User has payments, going to execute-task");
            // User has payments but no mobileNumber in profile, use payment contact
            localStorage.setItem("mobileNumber", paymentRes.data[0].contact);
            localStorage.setItem("unique_id", paymentRes.data[0].unique_id);
            navigate("/execute-task");
            return;
          } else {
            console.warn("No payments found or payment data is empty");
            console.warn("Payment data type:", typeof paymentRes.data);
            console.warn("Payment data:", paymentRes.data);
          }
        } catch (paymentError) {
          // If payment API fails (e.g., user has no mobileNumber), continue to check-number
          console.warn("Payment API error:", paymentError.message);
          console.warn("Payment API error response:", paymentError.response?.data);
        }

      // User has no mobileNumber and no payments, redirect to check-number
      navigate("/check-number");
    } catch (error) {
      setIsLoading(false);
      if (error.response) {
        if (error.response.status === 400) {
          if (error.response.data.message === "User not found. Please Signup!!!") {
            alert("Email not registered. Please sign up!");
          } else {
            alert(error.response.data.message || "Invalid credentials!");
          }
        } else if (error.response.status === 403 && error.response.data.activeSession) {
          // Handle active session error
          const confirmLogout = window.confirm("You're already logged in on another device. Would you like to log out from all other devices and continue?");

          if (confirmLogout) {
            // Make a request to force logout from other devices
            try {
              await axios.post("https://api.leadscruise.com/api/force-logout", { email });
              // Retry login
              handleSignIn();
            } catch (logoutError) {
              alert("Failed to log out from other devices. Please try again.");
            }
          }
        } else {
          alert("Failed to sign in. Please try again.");
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
    <div className="login-page-container" style={{ backgroundImage: `url(${loginBg})` }}>
      

{isLoading && (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">Please wait<span className="loading-dots"></span></div>
      <div className="loading-message">Processing your request</div>
    </div>
  </div>
)}


{isLoading && (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">Sending reset email<span className="loading-dots"></span></div>
      <div className="loading-message">Please check your inbox in a moment</div>
    </div>
  </div>
)}


{isLoading && (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">Signing you in<span className="loading-dots"></span></div>
      <div className="loading-message">This may take a few seconds</div>
    </div>
  </div>
)}


{isLoading && (
  <div className="loading-overlay">
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">Connecting<span className="loading-dots"></span></div>
      <div className="loading-message">Authenticating with your account</div>
    </div>
  </div>
)}
      <div className="login-form-wrapper">
        <div className="login-box">
        <div className="login-form-container">
          <h1 className="login-title">Login</h1>

          
          <button className="social-button" onClick={handleGoogleSignIn}>
              Continue with Google
          </button>

          <button className="social-button">
              Continue with Facebook
          </button>

          <div className="divider-container">
            <div className="divider-line"></div>
            <span className="divider-text">OR</span>
            <div className="divider-line"></div>
          </div>

          <form onSubmit={handleSignIn}>
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
              <div className="password-label-group">
                <label htmlFor="password">Password</label>
                <a className="forgot-password-link" onClick={handleForgotPassword}>Forgot Password?</a>
              </div>
              <div className="password-input-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="show-password-button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button type="submit" className="login-button" >Login</button>
          </form>
          
          <p className="signup-prompt">
            Don't have an account? 
              <a href="#" onClick={() => navigate('/signup')} className="signup-now-link">Sign up</a>
              <span> Now!</span>
          </p>
        </div>
        </div>
      </div>

      <div className="login-info-panel" >
        <div className="info-box">
          <TypingAnimation />
          <button className="arrow-button" aria-label="More info">↑</button>
        </div>
        <button className="contact-support-button">Contact Support</button>
      </div>
    </div>
  );
};

export default SignIn;