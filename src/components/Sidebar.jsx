import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { FaWhatsapp } from "react-icons/fa";
import { SiGooglesheets } from "react-icons/si";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { AiOutlineHome } from "react-icons/ai";
import { BiBarChartSquare } from "react-icons/bi";
import { MdOutlineRecommend } from "react-icons/md"; // Import referral icon
import axios from "axios";
import AIIcon from '../images/AI.png';
import { HiUserGroup } from "react-icons/hi";
import { FaYoutube } from "react-icons/fa";
const Sidebar = ({ status }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Effect to check status and redirect from settings if running
  useEffect(() => {
    if (status === "Running" && location.pathname === "/settings") {
      alert("You cannot access settings while the AI is running!");
      // Redirect back to dashboard
      if (location.pathname.includes("/master")) {
        navigate("/master");
      } else {
        navigate("/dashboard");
      }
    }
  }, [status, location.pathname, navigate]);

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

  const handleNavigation = () => {
    if (location.pathname.includes("/master")) {
      navigate("/master");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.group}>
        <div className={`${styles.sidebarIcon} ${styles.tooltip}`} onClick={handleNavigation}>
          <AiOutlineHome className={styles.icon} />
          <span className={styles.tooltipText}>Home</span>
        </div>

        {location.pathname.includes("/master") && (
          <div
            className={`${styles.sidebarIcon} ${styles.tooltip}`}
            onClick={() => navigate("/master/referrals")}
          >
            <MdOutlineRecommend className={styles.icon} />
            <span className={styles.tooltipText}>Referrals</span>
          </div>
        )}

        {!location.pathname.includes("/master") && (
          <>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/ai")}
            >
              <img src={AIIcon} className={styles.icon} alt="AI" style={{
                width: "32px",
                height: "32px",
                objectFit: "contain",
              }} />
              <span className={styles.tooltipText}>AI</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/sheets")}
            >
              <SiGooglesheets className={styles.icon} />
              <span className={styles.tooltipText}>Sheets</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/analytics")}
            >
              <BiBarChartSquare className={styles.icon} />
              <span className={styles.tooltipText}>Analytics</span>
            </div>
            {<div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/whatsapp")}
            >
              <FaWhatsapp className={styles.icon} />
              <span className={styles.tooltipText}>WhatsApp</span>
            </div>}
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip} ${status === "Running" ? styles.disabled : ""
                }`}
              onClick={() => {
                console.log("Status in Sidebar:", status);
                if (status === "Running") {
                  alert(
                    "You cannot go to settings while the AI is running!"
                  );
                } else {
                  navigate("/settings");
                }
              }}
            >
              <FiSettings className={styles.icon} />
              <span className={styles.tooltipText}>Settings</span>
            </div>
            {/* <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => navigate("/team")}
            >
              <HiUserGroup className={styles.icon} />
              <span className={styles.tooltipText}>Team</span>
            </div> */}
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => window.open("https://seller.indiamart.com/", "_blank")}
            >
              <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAABaFBMVEVHcEy/SkypQ0LAn6G8YGCkWlvZMDSQdXQ+kJC5mJqXTk5+IR3fR1bTZ2+0qqueYmCRdXTSOTXGZWPWJyWbKibhlJnTIxz3297bMjfk3t6ad3N2OzmoLiioOjXnhI767Oy5l5WMMzDlzdHc09W5NS/MSEXxsLyeVVKkjYuQREC0LSi8LCWrS0eAU1S9SEOQMS+GJyOlNzHQUU7V0M/0yNPthorskqjsmaqSQ0HkboHiZ3vUu7z////ZIhynIBr99/dxGxiBHxvZJDW5IxyOHxraJSb78fGaIBu5CgOuIRrvy8v//fz419zyvMXXAgHMIhzbZGPkaHfXDADndortrq7qlZawGhLXFQnsnaLppaTjeXf56uu6WFXIFQv14uKXEwzfmJbYFxjXByPfUFXyt8XYPjqzenqIAADCIhvRf32sMi6+HBTmhIPuobfbMk3YGC/Rp6aFKymYVlR9FxOrPTrKMjXNGBHtnrMVgyB5AAAAPHRSTlMAS2EmKBvWCAIUFPH6ckt8NoM46P5G+Pev0Um3w52h4em6Qpd7/JWjSt7Ltb6d4aHe7lqz1Yraxsjj6uFWz8lJAAAB7ElEQVQokZXS53faMBAAcAyehBmS94Ds/dK958kLY4yNjcHsEUiApE2a0N1/vzKGUJJP1Sc9/XS6O0k+338Mllxm7q5xs6Xw+1AyuGjU4YHfm7wdlor7ixgeXW5MJuQHZ5BfXzyYqC1NI+lfvLRzJ6vfT1IUFWTZ/Z443TerkA2EkzSdoOlkfHX7iPg3kAkcvnGcsSxnEULlwWtyjiy3u1f4I0BpnMVYbhjC1ibBzuJWXxXMIYB+hiPrJcCjkIhPWw1uXl83TABjgCNPCy6C3X1Iep2VHKdkwonatFDdnhj0tcyDiRI3odCNCZVhGyHLBF3HqGt5fp1yO5Rl+QyjDS1rJECrgvGkxvO5DVwVgXGsQ6XcLlhNaP9uYhQu+VxOWcY56WwW19GwGtBSoan13aSdXk6RnuJW4gidtqFqjdSqIBxon1087ymK9IxxQxFSoVouV6tGX/Pw64UiSUscviIikRXgSx0V7eZVptYx3HIvJA99zIuQgbFYvNIyeb4juOX+kERxZ3qDW9DqFj9lsPE/XRS+iaIYnd7vbsruesavqG7S76K4Rt1+sPCTTB5bTvHwXFyLzR+OCUQfPV/BrStt/Ajq9uMYO0cWczp69O74+GMq9XIvws3Nc4ajYul0JBIJcPc+9u0u3yzqL+HscIfQhAbtAAAAAElFTkSuQmCC"
                className={styles.icon}
                alt="IndiaMART"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                }}
              />
              <span className={styles.tooltipText}>IndiaMART</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => window.open("https://www.tradeindia.com/join_now/upload_product.html", "_blank")}
            >
              <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAXVBMVEW+JCTZJif////0wRXYJye7IyPYJyfSJia7JibYJyfuxcTTJibcbWbegX21ChDZRTHUVFDll4/prKrMFiTRCgrAFhntsxnSMivdnJzqt7e1SD300M/jsbDgmCH46uk2uEDkAAAACnRSTlMC////0s4pJB4nEIHnagAAAPVJREFUKJGt09FygyAQBVDXmmpZFBpAMFj//zN7F6ZJG8lb7ws7eyYRd9auQ8bpnK7msjRzKRZ31cgeRUNqmVIpTN0Y0rWZFEbg/NnMXPEpb4icgk7rWWvV9/2GAiVsldMJWq21FdxR2YpSCbJF4gZM0RjUN0R6LGjQygfwyDnDvxAcpmCMZPuf+Gjkb9GMBZnYPJALOjQFiYhjvRAe5agiulSR2O9yoSXgFyckX27rpfx33Lz3TbzKe2R1+Abex9BEnx64rk/IIcwpzTdHLNvFf5DYhaUMAXPjYsCJ7pEp069gdwd6kUEW94UOdeWn949z5Hv4Bla0G+QJpP0tAAAAAElFTkSuQmCC"
                className={styles.icon}
                alt="Trade India"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                }}
              />
              <span className={styles.tooltipText}>Trade India</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => window.open("https://www.exportersindia.com/register-business-online?joinfree=sellurprdtshead", "_blank")}
            >
              <img
                src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIACAAIAMBEQACEQEDEQH/xAAXAAEAAwAAAAAAAAAAAAAAAAAFBAYH/8QALRAAAQMCBAMHBQEAAAAAAAAAAQIDBAURAAYSMSEycQcTQUJhgaEUI0NRsSL/xAAaAQACAwEBAAAAAAAAAAAAAAACAwEEBQAG/8QAKBEAAgIBBAADCQAAAAAAAAAAAQIAAxEEEiExQYHwEyIkMjRxscHh/9oADAMBAAIRAxEAPwDccdOkd6dEYdDL0pht07IW4AT7YMVuRkCCWUcEyRgIUzTJ3aBVa5m40mVCbQg95rbSDrj6b83vZPU4q1W2s+GHE3tbodDVpRZU+W/Pl4R7P2YpFJYiU2k6VVapOBqPfZFyBqPuR8/rGtpKFfdY/wAqzzN9hXCL2YVnmgUmj9n8zvW0OSUaFmY6AXnHdQusq3uePQcNsM0djvqlb1iReqrSRLPklqYxlSmN1Er+pDAKgvmSDxAPqAQPbFbVOr3My9ZjalKoAYnCWl5kSEhP3v8AQUBzJ8vxbCmGDiGDkZmXVyUV9tcFMgKU1GQNCQLk/aUoWHidRxq1j4BseuRKbfUjMuhpMjMM+PNrjHcwYq+8i09RBKl+DjtuFx4JFwNyTsM72gRSqePZ/UtbdxyZNrMn6mS3RIyiXpCdUgp/Cx5iT4FXKnqT5TiKxtG8+X3/AJOY590RcAAAAWA2AwqHKHn/ACdUKlVoWYMvONJqcTSFNOK0h0JN0kHYEXIseBB3FuNzTakVqa3GVMRbTvIYdiLxp2bJ8dLZo8SlvEWW/Ikh4J9Uto5uhUnrhBFQPBJjBvPcWo9KZpbLgStx+Q8rXIkukFx5X7P8AHADbAM5Y8wlUCIYGTP/2Q=="
                className={styles.icon}
                alt="Exporters India"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                }}
              />
              <span className={styles.tooltipText}>Exporters India</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => window.open("https://www.justdial.com/Advertise?source=77", "_blank")}
            >
              <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAALVBMVEX9//z/5dHT5fSLvuX/pmf/awL/uYRyq9YMdcD/l0dKnNU8kNH+gBz/iTT/0K28hCtuAAAAWElEQVR4AWNAA4wgQhmIXROARIUBA8NUEGMFjLHDICfyKljELDQ0FMywCeGDMEwDGK5CGSDFTAw7TMMYgVIcXR0qoVOBDPaOdgbXmDkPGBiUFBgYBRiwAACC6Rgw/7hHtwAAAABJRU5ErkJggg=="
                className={styles.icon}
                alt="Just Dial"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                }}
              />
              <span className={styles.tooltipText}>Just Dial</span>
            </div>
            <div
              className={`${styles.sidebarIcon} ${styles.tooltip}`}
              onClick={() => window.open("https://www.youtube.com/@FocusEngineeringProducts", "_blank")}
            >
              <FaYoutube className={styles.icon} style={{
                color: "#FF0000", // YouTube red color
                fontSize: "32px"
              }} />
              <span className={styles.tooltipText}>YouTube</span>
            </div>
          </>
        )}
      </div>
      <div className={`${styles.sidebarIcon} ${styles.tooltip}`} onClick={handleLogout}>
        <FiLogOut className={styles.icon} />
        <span className={styles.tooltipText}>Logout</span>
      </div>
    </div>
  );
};

export default Sidebar;
