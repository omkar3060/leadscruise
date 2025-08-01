import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./styles.css";
import "./Plans.css";
import "@fontsource/norwester"; // Defaults to weight 400
import "@fontsource/norwester/400.css"; // Specify weight
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";

const Plans = () => {
  const [selected, setSelected] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(localStorage.getItem("selectedPlan") || "three-mo");
  const navigate = useNavigate();
  const [paymentError, setPaymentError] = useState("");

  const [showModal, setShowModal] = useState(false);


  useEffect(() => {
    localStorage.setItem("selectedPlan", selectedPlan);
  }, [selectedPlan]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      console.log("Razorpay script loaded successfully");
    };
    script.onerror = () => {
      console.error("Failed to load Razorpay script");
    };
    document.body.appendChild(script);
  }, []);



  const handlePlanSelect = (plan, price) => {
    setSelectedPlan(plan);
    localStorage.setItem("selectedPrice", price);
    localStorage.setItem("selectedPlan", plan); // Store subscription type
  };

  // Razorpay Payment Integration
  const amount = localStorage.getItem("selectedPrice") * 100;
  const currency = "INR";
  const receiptId = "qwsaq1";

  const savePaymentDetails = async (paymentData) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
      const selectedPlan = localStorage.getItem("selectedPlan");
      const email = localStorage.getItem("userEmail");
      const contact = localStorage.getItem("mobileNumber");

      await axios.post("https://api.leadscruise.com/api/save-payment", {
        unique_id: await getNextPaymentId(),
        email,
        contact,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature,
        order_amount: amount,
        subscription_type: selectedPlan,
      });

      // Check if the user has previous payments
      const response = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);
      const hasPreviousPayments = response.data.length > 1; // More than one payment means user already subscribed

      // Redirect based on payment history
      if (hasPreviousPayments) {
        alert("Subscription successful!!!");
        navigate("/dashboard");
      } else {
        navigate("/execute-task");
      }
    } catch (error) {
      console.error("Error saving payment details:", error);
      setPaymentError("Payment unsuccessful. Please try again.");
      setTimeout(() => navigate("/check-number"), 2000);
    }
  };

  const getNextPaymentId = async () => {
    const response = await axios.get("https://api.leadscruise.com/api/get-latest-id");
    localStorage.setItem("unique_id", response.data.latestId);
    return response.data.latestId;
  };

  const paymentHandler = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("https://api.leadscruise.com/order", {
        method: "POST",
        body: JSON.stringify({ amount, currency, receipt: receiptId }),
        headers: { "Content-Type": "application/json" },
      });

      const order = await response.json();

      var options = {
        key: "rzp_live_febmpQBBFIuphK",
        amount,
        currency,
        name: "Focus Engineering",
        description: "Test Transaction",
        image: "https://example.com/your_logo",
        order_id: order.id,
        prefill: {
          email: localStorage.getItem("userEmail"),
          contact: localStorage.getItem("mobileNumber"),
        },
        handler: async function (response) {
          const validationResult = await validateRes(response);
          if (validationResult && validationResult.success) {
            await savePaymentDetails(response);
          } else {
            console.error("Payment validation failed:", validationResult);
            setPaymentError("Payment validation failed. Please try again.");
          }
        },
        theme: { color: "#3399cc" },
      };

      var rzp1 = new window.Razorpay(options);

      rzp1.on("payment.failed", function () {
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
      const body = { ...response };
      const validateResponse = await fetch(
        "https://api.leadscruise.com/order/validate",
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      );

      const jsonRes = await validateResponse.json();
      return jsonRes;
    } catch (error) {
      console.error("Error validating payment:", error);
      return null;
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

  const handleNextClick = () => {
    if (!selectedPlan) {
      alert("Please select a plan first!");
      return;
    }
    setShowModal(true); // you can later show your coupon popup here
  };


  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          <div className="plans">
            <div
              className={`one-mo common first-one ${selectedPlan === "3-days" ? "selected" : ""
                }`}
              onClick={() => handlePlanSelect("3-days", 299)}
            >
              <div className="part-1">
                <div className="heading-row">
                  <h2>Three Days Subscription</h2>
                  <div className="coupon-text">(COUPON : EARLY62)</div>
                </div>

                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag-1"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 999</p>
                  <p className="prices-p">70% OFF</p>
                  <h3 className="prices-h3">₹ 299</h3>
                </div>
              </div>
            </div>
            <div
              className={`one-mo common first-one ${selectedPlan === "one-mo" ? "selected" : ""
                }`}
              onClick={() => handlePlanSelect("one-mo", 2999)}
            >
              <div className="part-1">
                <div className="heading-row">
                  <h2>One Month Subscription</h2>
                  <div className="coupon-text">(COUPON : EARLY62)</div>
                </div>

                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag-1"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 7999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 2999</h3>
                </div>
              </div>
            </div>

            <div
              className={`one-mo common second-one ${selectedPlan === "three-mo" ? "selected" : ""
                }`}
              onClick={() => handlePlanSelect("three-mo", 7999)}
            >
              <div className="part-1">

                <div className="heading-row">
                  <h2>3 Months Subscription</h2>
                  <div className="coupon-text">(COUPON : EARLY62)</div>
                </div>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag-2"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 24999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 7999</h3>
                </div>
              </div>
            </div>

            <div
              className={`six-mo common third-one ${selectedPlan === "six-mo" ? "selected" : ""
                }`}
              onClick={() => handlePlanSelect("six-mo", 14999)}
            >
              <div className="part-1">
                <div className="heading-row">
                  <h2>6 Months Subscription</h2>
                  <div className="coupon-text">(COUPON : EARLY62)</div>
                </div>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag-3"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 47999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 14999</h3>
                </div>
              </div>
            </div>

            <div
              className={`year-mo common fourth-one ${selectedPlan === "year-mo" ? "selected" : ""
                }`}
              onClick={() => handlePlanSelect("year-mo", 29999)}
            >
              <div className="part-1">
                <div className="heading-row">
                  <h2>One Year Subscription</h2>
                  <div className="coupon-text">(COUPON : EARLY62)</div>
                </div>
                <p className="first-p">Unlimited AI Leads Capture</p>
                <p>AI Business monitoring</p>
                <p>AI Encryption & Authentication system</p>
              </div>
              <div className="part-2">
                <div className="tag-4"></div>
                <div className="prices">
                  <p className="overline prices-p">₹ 95999</p>
                  <p className="prices-p">62.50% OFF</p>
                  <h3 className="prices-h3">₹ 29999</h3>
                </div>
              </div>
            </div>
          </div>

          <button className="next-button" onClick={handleNextClick}>
            Next
          </button>

          <div className="end-block">
            <p className="gback" onClick={() => window.history.back()}>
              Go Back
            </p>
            <p className="logout-link">
              Wish to <span onClick={handleLogout}>Logout</span>?
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Your Plan</h2>

            <div className="plan-summary">
              <p><strong>Plan:</strong> {
                selectedPlan === "3-days" ? "3 Days" :
                selectedPlan === "one-mo" ? "1 Month" :
                  selectedPlan === "three-mo" ? "3 Months" :
                    selectedPlan === "six-mo" ? "6 Months" :
                      "12 Months"
              }</p>
              <p><strong>Price:</strong> ₹{selectedPlan === "3-days" ? 299 :
                selectedPlan === "one-mo" ? 2999 :
                selectedPlan === "three-mo" ? 7999 :
                  selectedPlan === "six-mo" ? 14999 :
                    29999}</p>
            </div>

            <div className="coupon-section">
              <label htmlFor="couponInput"><strong>Coupon Code:</strong></label>
              <input
                id="couponInput"
                type="text"
                value="EARLY62"
                readOnly
                className="coupon-input"
              />
              <p className="coupon-note">(Auto-applied at checkout)</p>
            </div>

            <div className="modal-actions" style={{ display: 'flex' }}>
              <button className="proceed-button" onClick={paymentHandler}>
                Proceed to Pay
              </button>
              <button className="cancel-button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Plans;
