import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import "./Plans.css";
import "@fontsource/norwester"; // Defaults to weight 400
import "@fontsource/norwester/400.css"; // Specify weight
import bgImage1 from "../images/values-1.png";
import bgImage2 from "../images/values-2.png";
import bgImage3 from "../images/values-3.png";

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
                  backgroundImage: `url(${bgImage2})`,
                }}
              ></div>
              <div className="banner1_heading">A Rocket for your Business</div>
              <div className="banner2_content">
                Get to customers within the blink of opponent's eyes,
                LeadsCruise provides 100% uptime utilising FA cloud systems
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

export default Plans;