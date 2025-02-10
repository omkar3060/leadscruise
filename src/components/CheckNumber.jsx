import React, { useState, useEffect } from "react";
import axios from "axios";
import successImage from "../images/success.png";
import errorImage from "../images/error.png";
import loadingGif from "../images/loading.gif";
import { useNavigate } from "react-router-dom";
import "./styles.css";

import "./CheckNumber.css";

const CheckNumber = () => {
  const [mobileNumber, setMobileNumber] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle', 'loading', 'success', or 'error'
  const [message, setMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
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

  // Razorpay handlers
  const amount = 500;
  const currency = "INR";
  const receiptId = "qwsaq1";

  const savePaymentDetails = async (paymentData) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        paymentData;
      const userDetails = {
        name: "Shashidhar",
        email: "shashidharangadi14@gmail.com",
        contact: "7676577935",
      };

      await axios.post("http://localhost:5000/api/save-payment", {
        unique_id: await getNextPaymentId(), // Fetch the next unique ID
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.contact,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature,
        order_amount: amount,
      });

      navigate("/execute-task");
    } catch (error) {
      console.error("Error saving payment details:", error);
      setPaymentError("Payment unsuccessful. Please try again.");
      setTimeout(() => navigate("/check-number"), 2000);
    }
  };

  const getNextPaymentId = async () => {
    const response = await axios.get("http://localhost:5000/api/get-latest-id");
    return response.data.latestId;
  };

  const paymentHandler = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/order", {
        method: "POST",
        body: JSON.stringify({
          amount,
          currency,
          receipt: receiptId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const order = await response.json();
      console.log(order);

      var options = {
        key: "rzp_test_WK0GdfgogeZ8Cy",
        amount,
        currency,
        name: "Focus Engineering",
        description: "Test Transaction",
        image: "https://example.com/your_logo",
        order_id: order.id,
        prefill: {
          name: "Shashidhar",
          email: "shashidharangadi14@gmail.com",
          contact: "7676577935",
        },
        handler: async function (response) {
          const validationResult = await validateRes(response);
          console.log(validationResult);
          console.log(validationResult.success);
          if (validationResult && validationResult.success) {
            await savePaymentDetails(response);
          } else {
            console.error("Payment validation failed:", validationResult);
            setPaymentError("Payment validation failed. Please try again.");
          }
        },

        theme: {
          color: "#3399cc",
        },
      };
      var rzp1 = new window.Razorpay(options);

      rzp1.on("payment.failed", function (response) {
        setPaymentError("Payment unsuccessful. Please try again.");
        setTimeout(() => navigate("/check-number"), 2000);
      });

      rzp1.open();
    } catch (error) {
      console.error("Error during payment process:", error);
      setPaymentError("Payment unsuccessful. Please try again.");
      setTimeout(() => navigate("/check-number"), 2000);
    }
  };

  const validateRes = async (response) => {
    try {
      const body = {
        ...response,
      };
      const validateResponse = await fetch(
        "http://localhost:5000/order/validate",
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const jsonRes = await validateResponse.json();
      console.log("Validation Response:", jsonRes);

      return jsonRes;
    } catch (error) {
      console.error("Error validating payment:", error);
      return null;
    }
  };

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          {/* Main screens */}
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
              {paymentError && <p className="error-message">{paymentError}</p>}
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
              <p className="logout-link">
                Wish to <span>Logout</span>?
              </p>
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

export default CheckNumber;
