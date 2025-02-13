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
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setSelected((prev) => (prev + 1) % 2);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
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

      const userDetails = {
        email: localStorage.getItem("userEmail"),
        contact: localStorage.getItem("mobileNumber"),
      };
  
      await axios.post("http://localhost:5000/api/save-payment", {
        unique_id: await getNextPaymentId(),
        email: userDetails.email,
        contact: userDetails.contact,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature,
        order_amount: amount,
        subscription_type: selectedPlan, // Include subscription type
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
        body: JSON.stringify({ amount, currency, receipt: receiptId }),
        headers: { "Content-Type": "application/json" },
      });

      const order = await response.json();

      var options = {
        key: "rzp_test_WK0GdfgogeZ8Cy",
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
        "http://localhost:5000/order/validate",
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

  return (
    <div className="signin-container">
      <div className="center-div">
        <div className="signin-left">
          <div>Choose From Plans Below</div>
          <div className="plans">
            {[
              { name: "One Month", price: 2999, original: 7999 },
              { name: "6 Months", price: 14999, original: 47999 },
              { name: "Yearly", price: 29999, original: 95999 },
            ].map((plan, index) => (
              <div
                key={index}
                className={`common ${selectedPlan === plan.name ? "selected" : ""}`}
                onClick={() => handlePlanSelect(plan.name, plan.price)}
              >
                <div className="part-1">
                  <h2>{plan.name} Subscription</h2>
                  <p className="first-p">Unlimited AI Leads Capture</p>
                  <p>AI Business Monitoring</p>
                  <p>AI Encryption & Authentication System</p>
                </div>
                <div className="part-2">
                  <div className="tag"></div>
                  <div className="prices">
                    <p className="overline prices-p">₹ {plan.original}</p>
                    <p className="prices-p">62.50% OFF</p>
                    <h3 className="prices-h3">₹ {plan.price}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="next-button" onClick={paymentHandler}>
            Next
          </button>

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
            <div className={`banner overlapBanner ${selected === 0 ? "active" : ""}`}>
              <div className="rightbanner">
                <div
                  className="banner1_img"
                  style={{
                    backgroundImage: "url('https://static.zohocdn.com/iam/v2/components/images/Passwordless_illustration.svg')",
                  }}
                ></div>
                <div className="banner1_heading">Passwordless Sign-in</div>
                <div className="banner1_content">Move away from risky passwords and experience one-tap access to Zoho.</div>
              </div>
            </div>

            <div className={`banner mfa_panel ${selected === 1 ? "active" : ""}`}>
              <div className="product_img"></div>
              <div className="banner1_heading">Keep Your Account Secure</div>
              <div className="banner2_content">Shield your Zoho account with OneAuth now.</div>
            </div>

            <div className="pagination-container">
              {[0, 1].map((num) => (
                <div key={num} className={`pagination-dot ${selected === num ? "selected" : ""}`}>
                  <div className="progress-fill"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plans;
