import React, { useState, useEffect } from 'react';
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

  const handlePlanSelect = (plan, price, planName) => {
    setSelectedPlan(plan);
    localStorage.setItem("selectedPrice", price);
    localStorage.setItem("selectedPlan", plan); // Store subscription type
    setSelectedPlanDetails({ name: planName, price: price });
  };

  // Razorpay Payment Integration
  const baseAmount = parseInt(localStorage.getItem("selectedPrice") || "2999", 10);
  const amountInPaisa = baseAmount * 100;  // Convert to paisa
  const gstAmount = Math.round(amountInPaisa * 0.18);  // 18% GST
  const amount = amountInPaisa + gstAmount;  // Total amount in paisa
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
    const email = localStorage.getItem("userEmail");
    const contact = localStorage.getItem("mobileNumber");
    const selectedPlan = localStorage.getItem("selectedPlan");

    if (!referralId.trim()) {
      alert("Please enter a Referral ID.");
      return;
    }

    // ✅ REPLACE THIS ENTIRE SECTION - Handle 7-day demo with ₹1 authorization
    if (selectedPlan === "1-day" || selectedPlan === "7-days") { // Handle both for safety
      try {
        // Check if already used demo
        const res = await axios.get(`https://api.leadscruise.com/api/has-used-demo?contact=${contact}`);

        if (res.data.used) {
          alert(res.data.message || "You have already used the 7-day demo subscription.");
          setShowModal(false);
          return;
        }

        // ✅ Create ₹1 authorization order
        const orderResponse = await axios.post("https://api.leadscruise.com/api/create-demo-order", {
          email,
          contact,
          referralId: referralId.trim()
        });

        if (!orderResponse.data.success) {
          throw new Error("Failed to create authorization order");
        }

        // ✅ Open Razorpay checkout for ₹1 authorization
        const options = {
          key: "rzp_live_febmpQBBFIuphK",
          amount: 100, // ₹1 in paisa
          currency: "INR",
          name: "LeadsCruise",
          description: "7-Day FREE Demo - Payment Authorization (₹1 will be refunded immediately)",
          order_id: orderResponse.data.order_id,
          prefill: {
            email: email,
            contact: contact
          },
          handler: async function (response) {
            try {
              // ✅ After successful ₹1 payment, activate demo subscription
              const activateResponse = await axios.post(
                "https://api.leadscruise.com/api/activate-demo-after-auth",
                {
                  email,
                  contact,
                  referralId: referralId.trim(),
                  payment_id: response.razorpay_payment_id,
                  order_id: response.razorpay_order_id,
                  signature: response.razorpay_signature
                }
              );

              if (activateResponse.data.success) {
                alert(
                  `🎉 7-Day FREE Demo Activated!\n\n +
                ✅ ₹1 authorization amount refunded\n
                ✅ No charges for 7 days\n
                💳 Autopay starts: ${new Date(activateResponse.data.trial_end_date).toLocaleDateString('en-IN')}\n
                💰 Amount after trial: ₹3999+GST/month`
                );
                navigate("/execute-task");
              }
            } catch (error) {
              console.error("Error activating demo:", error);
              alert("Failed to activate demo. Please contact support.");
              setPaymentError("Failed to activate demo subscription");
            }
          },
          theme: {
            color: "#3399cc"
          },
          notes: {
            type: "demo_authorization",
            referral_id: referralId.trim()
          }
        };

        const rzp = new window.Razorpay(options);

        rzp.on("payment.failed", function (response) {
          alert("Payment authorization failed. Please try again with a valid payment method.");
          setPaymentError("Authorization failed");
        });

        rzp.open();
        return; // ✅ Important: Stop execution here for demo

      } catch (error) {
        console.error("Error with demo subscription:", error);
        alert("Unable to start demo. Please try again.");
        setPaymentError(error.message || "Demo activation failed");
        return;
      }
    }

    // 🛒 REST OF YOUR EXISTING CODE FOR PAID PLANS (keep as is)
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

    if (!isConfirmed) return; // Stop if user cancels

    const userEmail = localStorage.getItem("userEmail");

    try {
      await axios.post("https://api.leadscruise.com/api/logout", {
        email: userEmail,
      });

      localStorage.clear();
      sessionStorage.clear(); // Clear session storage as well
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
  const handleGoBack = () => {
    navigate(-1); // Goes back to previous page
    // OR if you want to go to a specific route:
    // navigate('/specific-route');
  };
  const handleDemoClick = () => {
    handlePlanSelect("7-days", "0", "Demo Plan");
    setShowModal(true);
  };

  return (
    <div className="plans-container">
      <div className="plans-content">
        <div className="plans-header">
          <h2>Select Plan for subscription</h2>
        </div>

        <div className="plans-grid">
          {/* One Month Plan - Now First */}
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
                <span>Unlimited AI WhatsApp Reply Automation</span>
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

          {/* Three Month Plan - Now Second */}
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
                <span>Unlimited AI WhatsApp Reply Automation</span>
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
                <span>Unlimited AI WhatsApp Reply Automation</span>
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
            <div className="popular-badge">POPULAR</div>
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
        <button className="logout-link" onClick={handleGoBack}>Go Back</button>
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
  );
};

export default Plans;