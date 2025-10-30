import React, { useState, useEffect } from 'react';
import Dither from "./Dither.tsx"
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Plans.css';

const Plans = () => {
  const [selected, setSelected] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(localStorage.getItem("selectedPlan") || "three-mo");
  const navigate = useNavigate();
  const [paymentError, setPaymentError] = useState("");
  const [referralId, setReferralId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState({ name: "", price: "" });

  useEffect(() => {
    localStorage.setItem("selectedPlan", selectedPlan);
  }, [selectedPlan]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000);

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

  const handlePlanSelect = (plan, price, planName) => {
    setSelectedPlan(plan);
    localStorage.setItem("selectedPrice", price);
    localStorage.setItem("selectedPlan", plan);
    setSelectedPlanDetails({ name: planName, price: price });
  };

  const baseAmount = parseInt(localStorage.getItem("selectedPrice") || "2999", 10);
  const amountInPaisa = baseAmount * 100;
  const gstAmount = Math.round(amountInPaisa * 0.18);
  const amount = amountInPaisa + gstAmount;
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

      const response = await axios.get(`https://api.leadscruise.com/api/payments?email=${email}`);
      const hasPreviousPayments = response.data.length > 1;

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
  const email = localStorage.getItem("userEmail");
  const contact = localStorage.getItem("mobileNumber");
  const selectedPlan = localStorage.getItem("selectedPlan");
  
  if (!referralId.trim()) {
    alert("Please enter a Referral ID.");
    return;
  }
  
  try {
    const res = await axios.get(`https://api.leadscruise.com/api/referrals/check-referral/${referralId.trim()}`);
    if (!res.data.success) {
      alert("Invalid Referral ID.");
      return;
    }
  } catch (err) {
    console.error("Error validating referral:", err);
    alert("Unable to verify Referral ID. Please try again.");
    return;
  }
  
  // ✅ Block if user already used demo
  if (selectedPlan === "7-days") {
    try {
      const res = await axios.get(`https://api.leadscruise.com/api/has-used-demo?contact=${contact}`);
      
      if (res.data.used) {
        alert(res.data.message || "You have already used the demo subscription. Please choose another plan.");
        setShowModal(false);
        return;
      }
    } catch (err) {
      console.error("Error checking demo usage:", err);
      alert("Unable to validate demo subscription. Please try again.");
      setShowModal(false);
      return;
    }
    
    // ✅ Directly create a free demo subscription without payment
    try {
      const timestamp = Date.now();
      await axios.post("https://api.leadscruise.com/api/save-payment", {
        unique_id: await getNextPaymentId(),
        email,
        contact,
        order_id: `FREE-DEMO-${timestamp}`,
        payment_id: `FREE-DEMO-${timestamp}`,
        signature: "FREE",
        order_amount: 0,
        subscription_type: "7-days",
      });
      alert("Demo subscription activated successfully!");
      navigate("/execute-task");
      return;
    } catch (error) {
      console.error("Error activating demo subscription:", error);
      setPaymentError("Unable to activate demo. Please try again.");
      return;
    }
  }
  
  // 🛒 For paid plans, proceed with Razorpay flow
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
      prefill: { email, contact },
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

    if (!isConfirmed) return;

    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      sessionStorage.clear();
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
    setShowModal(true);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleDemoClick = () => {
    handlePlanSelect("7-days", "0", "Demo Plan");
    setShowModal(true);
  };

  return (
    <>
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
          colorNum={5}
          waveAmplitude={0.25}
          waveFrequency={2.5}
          waveSpeed={0.03}
          pixelSize={2.5}
        />
      </div>
      <div className="plans-container">
        <div className="plans-content">
          <div className="plans-header">
            <h2>Select Plan for subscription</h2>
            <button className="go-back-btn" onClick={handleGoBack}>Go Back</button>
          </div>

          <div className="plans-grid">
            {/* One Month Plan */}
            <div className="plan-card">
              <div className="plan-header">
                <h3>One Month Plan</h3>
                <p className="plan-subtitle">Features :</p>
                <p className="plan-description">Dive into one month plan comes with everything your business needs</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited Automatic AI Lead Captures</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Lead reply automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Business Automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Full Encryption & Authenticated System</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Free Updates for AI</span>
                </div>
              </div>

              <div className="coupon-section">
                <p className="coupon-text">Coupon Auto Applied at Checkout</p>
              </div>

              <div className="price-section">
                <span className="discounted-price">2999</span>
                <div className="price-details">
                  <span>EXCL of GST</span>
                  <span>PER / Month</span>
                </div>
              </div>

              <button
                className="select-plan-btn"
                onClick={() => {
                  handlePlanSelect("one-mo", "2999", "One Month Plan");
                  handleNextClick();
                }}
              >
                <span>→</span>
              </button>
            </div>

            {/* Three Month Plan */}
            <div className="plan-card">
              <div className="plan-header">
                <h3>Three Month Plan</h3>
                <p className="plan-subtitle">Features :</p>
                <p className="plan-description">Perfect for getting started with comprehensive AI automation</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited Automatic AI Lead Captures</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Lead reply automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Business Automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Full Encryption & Authenticated System</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Free Updates for AI</span>
                </div>
              </div>

              <div className="coupon-section">
                <p className="coupon-text">Coupon Auto Applied at Checkout</p>
              </div>

              <div className="price-section">
                <span className="discounted-price">7999</span>
                <div className="price-details">
                  <span>EXCL of GST</span>
                  <span>FOR 3 Months</span>
                </div>
              </div>

              <button
                className="select-plan-btn"
                onClick={() => {
                  handlePlanSelect("three-mo", "7999", "Three Month Plan");
                  handleNextClick();
                }}
              >
                <span>→</span>
              </button>
            </div>

            {/* Six Month Plan */}
            <div className="plan-card">
              <div className="plan-header">
                <h3>Six Month Plan</h3>
                <p className="plan-subtitle">Features :</p>
                <p className="plan-description">Get the best value with our six month plan - perfect for growing businesses</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited Automatic AI Lead Captures</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Lead reply automation</span>
                </div>
                <div className="feature-item">
  <span className="checkmark">✓</span>
  <span>Download Reports</span>
</div>

<div className="feature-item">
  <span className="checkmark">✓</span>
  <span>API Access</span>
</div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Business Automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Full Encryption & Authenticated System</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Free Updates for AI</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Priority Customer Support</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Advanced Analytics Dashboard</span>
                </div>
              </div>

              <div className="coupon-section">
                <p className="coupon-text">Coupon Auto Applied at Checkout</p>
              </div>

              <div className="price-section">
                <span className="discounted-price">14999</span>
                <div className="price-details">
                  <span>EXCL of GST</span>
                  <span>FOR 6 Months</span>
                </div>
              </div>

              <button
                className="select-plan-btn"
                onClick={() => {
                  handlePlanSelect("six-mo", "14999", "Six Month Plan");
                  handleNextClick();
                }}
              >
                <span>→</span>
              </button>
            </div>

            {/* Yearly Plan - POPULAR */}
            <div className="plan-card plan-card-popular">
              <div className="popular-badge">Includes WhatsApp Automation</div>
              <div className="plan-header">
                <h3>Yearly Plan</h3>
                <p className="plan-subtitle">Features :</p>
                <p className="plan-description">Maximum savings with our comprehensive yearly subscription for serious businesses</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited Automatic AI Lead Captures</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Lead reply automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI WhatsApp Reply Automation</span>
                </div>
                <div className="feature-item">
  <span className="checkmark">✓</span>
  <span>Download Reports</span>
</div>

<div className="feature-item">
  <span className="checkmark">✓</span>
  <span>API Access</span>
</div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Unlimited AI Business Automation</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Full Encryption & Authenticated System</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Free Updates for AI</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Priority Customer Support</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Advanced Analytics Dashboard</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Dedicated Account Manager</span>
                </div>
                <div className="feature-item">
                  <span className="checkmark">✓</span>
                  <span>Custom Integration Support</span>
                </div>
              </div>

              <div className="coupon-section">
                <p className="coupon-text">Coupon Auto Applied at Checkout</p>
              </div>

              <div className="price-section">
                <span className="discounted-price">29999</span>
                <div className="price-details">
                  <span>EXCL of GST</span>
                  <span>FOR 12 Months</span>
                </div>
              </div>

              <button
                className="select-plan-btn select-plan-btn-popular"
                onClick={() => {
                  handlePlanSelect("year-mo", "29999", "Yearly Plan");
                  handleNextClick();
                }}
              >
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bottom-section">
          <div className="demo-section">
            <button className="demo-link" onClick={handleDemoClick}>Need a&nbsp;<span className="demo-bold">Demo?</span></button>
          </div>
        </div>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Selected Plan Details</h3>
              <div className="selected-plan-info">
                <h4>{selectedPlanDetails.name}</h4>
                <p className="selected-price">
                  {selectedPlanDetails.price === "0" ? "Free Demo" : `₹${selectedPlanDetails.price} +GST`}
                </p>
              </div>
              <h3>Enter Referral ID</h3>
              <input
                type="text"
                value={referralId}
                onChange={(e) => setReferralId(e.target.value)}
                placeholder="Enter your referral ID"
                className="referral-input"
              />
              {paymentError && <p className="error-message">{paymentError}</p>}
              <div className="modal-buttons">
                <button onClick={paymentHandler} className="proceed-btn">Proceed</button>
                <button onClick={() => setShowModal(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
  );
};

export default Plans;