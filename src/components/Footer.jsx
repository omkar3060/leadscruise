// Footer.jsx
import React from 'react';
import './Footer.css';

const Footer = () => {
  const supportEmail = "support@focusengineering.com";
  
  const handleEmailClick = () => {
    window.location.href = `mailto:${supportEmail}`;
  };

  const [isPopupOpen, setIsPopupOpen] = React.useState(false);

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="copyright">
          © 2025, Focus Engineering Products Pvt. Ltd. All Rights Reserved.
        </div>
        
        <button 
          className="support-button"
          onClick={() => setIsPopupOpen(true)}
        >
          <svg 
            className="mail-icon" 
            viewBox="0 0 24 24" 
            width="16" 
            height="16"
          >
            <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" 
            stroke="currentColor" 
            fill="none" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          </svg>
          Contact Support
        </button>
      </div>

      {isPopupOpen && (
        <div className="popup-overlay" onClick={() => setIsPopupOpen(false)}>
          <div className="popup-content" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h2>Contact Support</h2>
              <button 
                className="close-button"
                onClick={() => setIsPopupOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="popup-body">
              <p>Need help? Our support team is here to assist you. 
                Click the email below to contact us:</p>
              <button 
                className="email-button"
                onClick={handleEmailClick}
              >
                <svg 
                  className="mail-icon" 
                  viewBox="0 0 24 24" 
                  width="16" 
                  height="16"
                >
                  <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" 
                  stroke="currentColor" 
                  fill="none" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                </svg>
                {supportEmail}
              </button>
              <p className="response-time">Our team typically responds within 24 business hours.</p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;