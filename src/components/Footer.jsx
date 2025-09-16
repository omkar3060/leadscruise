import React from 'react';
import './Footer.css';

const Footer = () => {
  const supportEmail = "support@leadscruise.com";
  const whatsappNumber = "+919028662937"; // Replace with actual support number

  // Check if current page is dashboard and not mobile
  const isDashboard = window.location.pathname.includes('/dashboard') ||
    window.location.pathname === '/dashboard';
  const isMobile = window.innerWidth <= 768;
  const showScrollMessage = isDashboard && !isMobile;

  const handleEmailClick = () => {
    window.location.href = `mailto:${supportEmail}`;
  };

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Hi, I need support with Focus Engineering products.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  // Hide footer on root route
  if (window.location.pathname === "/") {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className='footer-left'>
          {/* {showScrollMessage && (
          <div className="scroll-message">
            <svg 
              className="scroll-icon" 
              viewBox="0 0 24 24" 
              width="16" 
              height="16"
            >
              <path 
                d="M7 14l5-5 5 5" 
                stroke="currentColor" 
                fill="none" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            Scroll down to see old captured leads
          </div>
        )} */}


        </div>
        <div className="support-button-container">
          <button
            className="support-button"
            onClick={() => setIsPopupOpen(true)}
          >
            Contact Support
          </button>
        </div>
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
                Choose your preferred method to contact us:</p>
              <div className="contact-buttons">
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
                <button
                  className="whatsapp-button"
                  onClick={handleWhatsAppClick}
                >
                  <svg
                    className="whatsapp-icon"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                      fill="currentColor"
                    />
                  </svg>
                  Chat on WhatsApp
                </button>
              </div>
              <p className="response-time">Our team typically responds within 24 business hours.</p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;